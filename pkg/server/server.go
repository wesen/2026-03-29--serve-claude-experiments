package server

import (
	"archive/zip"
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/alecthomas/chroma/v2"
	chromahtml "github.com/alecthomas/chroma/v2/formatters/html"
	"github.com/alecthomas/chroma/v2/lexers"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
	"github.com/go-go-golems/serve-artifacts/pkg/userdata"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
)

// DefaultUserID is the single hardcoded account used until a real identity
// provider is integrated. The schema is already multi-user; only currentUser
// needs to change to support real accounts.
const DefaultUserID = "default"

// currentUser resolves the acting user for a request. This is the single seam a
// future IdP replaces (reading a session cookie / bearer token); today it always
// returns the default account.
func currentUser(_ *http.Request) string { return DefaultUserID }

//go:embed templates
var templateFS embed.FS

// Server serves Claude artifacts over HTTP.
type Server struct {
	scanner            *artifacts.Scanner
	index              *searchIndex
	store              *userdata.Store
	thumbs             *thumbCache
	dir                string
	port               int
	watch              bool
	watcher            *watcher
	precompiled        *precompiledBundle
	indexTemplate      *template.Template
	jsxHostTemplate    *template.Template
	artifactTemplate   *template.Template
	transcriptTemplate *template.Template
	markdown           goldmark.Markdown
}

// Config holds server configuration.
type Config struct {
	Dir             string
	Port            int
	Watch           bool
	DBPath          string // SQLite path for user data; empty = default under the config dir
	ThumbsDir       string // thumbnail cache dir; empty = default under the user cache dir
	NoThumbs        bool   // disable thumbnail generation entirely
	ChromeNoSandbox bool   // add --no-sandbox (required to render as root in a container)
}

var templateFuncs = template.FuncMap{
	"humanSize": func(b int64) string {
		const unit = 1024
		if b < unit {
			return fmt.Sprintf("%d B", b)
		}
		div, exp := int64(unit), 0
		for n := b / unit; n >= unit; n /= unit {
			div *= unit
			exp++
		}
		return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
	},
}

// New creates a new artifact server.
func New(cfg Config) (*Server, error) {
	scanner := artifacts.NewScanner(cfg.Dir)

	indexTmpl, err := template.New("index.html").Funcs(templateFuncs).ParseFS(templateFS, "templates/index.html")
	if err != nil {
		return nil, fmt.Errorf("parsing index template: %w", err)
	}

	jsxHostTmpl, err := template.New("jsx-host.html").ParseFS(templateFS, "templates/jsx-host.html")
	if err != nil {
		return nil, fmt.Errorf("parsing jsx-host template: %w", err)
	}

	artifactTmpl, err := template.New("artifact.html").Funcs(templateFuncs).ParseFS(templateFS, "templates/artifact.html")
	if err != nil {
		return nil, fmt.Errorf("parsing artifact template: %w", err)
	}

	transcriptTmpl, err := template.New("transcript.html").ParseFS(templateFS, "templates/transcript.html")
	if err != nil {
		return nil, fmt.Errorf("parsing transcript template: %w", err)
	}

	precompiled, err := loadEmbeddedPrecompiledBundle()
	if err != nil {
		return nil, err
	}

	var w *watcher
	if cfg.Watch {
		w = newWatcher(cfg.Dir)
	}

	dbPath := cfg.DBPath
	if dbPath == "" {
		dbPath = defaultDBPath()
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("creating db directory: %w", err)
	}
	store, err := userdata.Open(dbPath)
	if err != nil {
		return nil, err
	}
	if err := store.EnsureUser(DefaultUserID, "Default"); err != nil {
		return nil, err
	}
	log.Printf("User data (favorites/tags/collections): %s", dbPath)

	var thumbs *thumbCache
	if !cfg.NoThumbs {
		thumbsDir := cfg.ThumbsDir
		if thumbsDir == "" {
			thumbsDir = defaultThumbsDir()
		}
		baseURL := fmt.Sprintf("http://localhost:%d", cfg.Port)
		thumbs, err = newThumbCache(thumbsDir, baseURL, newChromedpEngine(cfg.ChromeNoSandbox), defaultThumbConcurrency())
		if err != nil {
			return nil, err
		}
		log.Printf("Thumbnails: %s (Chrome starts on first request)", thumbsDir)
	}

	return &Server{
		scanner:            scanner,
		index:              newSearchIndex(scanner),
		store:              store,
		thumbs:             thumbs,
		dir:                cfg.Dir,
		port:               cfg.Port,
		watch:              cfg.Watch,
		watcher:            w,
		precompiled:        precompiled,
		indexTemplate:      indexTmpl,
		jsxHostTemplate:    jsxHostTmpl,
		artifactTemplate:   artifactTmpl,
		transcriptTemplate: transcriptTmpl,
		markdown:           goldmark.New(goldmark.WithExtensions(extension.GFM)),
	}, nil
}

// defaultDBPath returns the default SQLite location under the user config dir.
func defaultDBPath() string {
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		return filepath.Join(".", ".serve-artifacts", "userdata.db")
	}
	return filepath.Join(base, "serve-artifacts", "userdata.db")
}

// reloadScript is injected into served pages when watch mode is enabled.
const reloadScript = `<script>
(function(){var es=new EventSource("/events");es.onmessage=function(e){if(e.data==="reload")location.reload()};es.onerror=function(){setTimeout(function(){location.reload()},2000)};})();
</script>`

// Run starts the HTTP server and blocks until the context is cancelled.
func (s *Server) Run(ctx context.Context) error {
	// Build the search index up front so /search and the index page read from
	// memory instead of re-scanning the tree on every request.
	if err := s.index.rebuild(); err != nil {
		return fmt.Errorf("building search index: %w", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", s.handleIndex)
	mux.HandleFunc("GET /search-index.json", s.handleSearchIndex)
	mux.HandleFunc("GET /search", s.handleSearch)
	mux.HandleFunc("POST /api/favorite", s.handleFavorite)
	mux.HandleFunc("POST /api/tags/add", s.handleTagAdd)
	mux.HandleFunc("POST /api/tags/remove", s.handleTagRemove)
	mux.HandleFunc("GET /api/collections", s.handleCollectionsList)
	mux.HandleFunc("POST /api/collections", s.handleCollectionCreate)
	mux.HandleFunc("DELETE /api/collections/{id}", s.handleCollectionDelete)
	mux.HandleFunc("POST /api/collections/{id}/items", s.handleCollectionAddItem)
	mux.HandleFunc("DELETE /api/collections/{id}/items", s.handleCollectionRemoveItem)
	// {name...} matches multi-segment names so artifacts in nested subdirectories
	// (e.g. "<uuid>/artifacts/Calendar") resolve.
	mux.HandleFunc("GET /view/{name...}", s.handleView)
	mux.HandleFunc("GET /raw/{name...}", s.handleRaw)
	mux.HandleFunc("GET /compiled/{name...}", s.handleCompiledJSX)
	mux.HandleFunc("GET /jsx/{name...}", s.handleJSX)
	mux.HandleFunc("GET /thumb/{name...}", s.handleThumb)
	mux.HandleFunc("POST /thumb/{name...}", s.handleThumbSave)
	mux.HandleFunc("POST /api/thumb/rerender/{name...}", s.handleThumbRerender)
	mux.HandleFunc("GET /artifact/{name...}", s.handleArtifactPage)
	mux.HandleFunc("GET /api/artifact/{name...}", s.handleArtifactJSON)
	mux.HandleFunc("GET /transcript/{name...}", s.handleTranscript)
	mux.HandleFunc("GET /highlight/{name...}", s.handleHighlight)
	mux.HandleFunc("GET /session/{name...}", s.handleSession)

	if s.watch && s.watcher != nil {
		// Rebuild the index whenever the directory changes, before clients reload.
		s.watcher.onChange = func() {
			if err := s.index.rebuild(); err != nil {
				log.Printf("index rebuild error: %v", err)
			}
		}
		mux.HandleFunc("GET /events", s.watcher.handleSSE)
		go func() {
			if err := s.watcher.start(ctx); err != nil {
				log.Printf("Watcher error: %v", err)
			}
		}()
		log.Printf("Watch mode enabled — pages will auto-reload on changes")
	}

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", s.port),
		Handler: mux,
	}

	// Kick off a background backfill so scrolling the gallery is smooth: render
	// any thumbnail whose <hash>.png is missing, throttled by the same semaphore
	// as live requests so it never competes with them.
	if s.thumbs != nil {
		go s.backfillThumbnails(ctx)
	}

	go func() {
		<-ctx.Done()
		if s.thumbs != nil {
			s.thumbs.close()
		}
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
	}()

	log.Printf("Serving artifacts from %s on http://localhost:%d", s.dir, s.port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	arts := s.index.artifactList()
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	s.indexTemplate.Execute(w, map[string]interface{}{
		"Artifacts": arts,
		"Count":     len(arts),
		"Dir":       s.dir,
		"Watch":     s.watch,
	})
}

func (s *Server) handleSearchIndex(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(buildSearchDocuments(s.index.artifactList())); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// handleSearch runs a query against the cached index and returns
// {total, results, facets}. All query parameters are optional.
func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	// The search box supports a mini query language (tag:, model:, before:, ...);
	// parse it and merge with the explicit facet/date params the UI also sends.
	pq := parseSearchSyntax(q.Get("q"))
	tags := append(append([]string{}, q["tag"]...), pq.Tags...)
	query := searchQuery{
		Q:          pq.Text,
		Type:       firstNonEmpty(pq.Type, q.Get("type")),
		Project:    firstNonEmpty(pq.Project, q.Get("project")),
		Model:      firstNonEmpty(pq.Model, q.Get("model")),
		Tags:       dedupeFold(tags),
		Library:    firstNonEmpty(pq.Library, q.Get("library")),
		Warnings:   q.Get("warnings") == "true" || pq.Warnings,
		Favorite:   q.Get("favorite") == "true" || pq.Favorite,
		Collection: int64(atoiDefault(q.Get("collection"), 0)),
		After:      parseDateBound(firstNonEmpty(pq.After, q.Get("after")), false),
		Before:     parseDateBound(firstNonEmpty(pq.Before, q.Get("before")), true),
		Sort:       q.Get("sort"),
		Limit:      atoiDefault(q.Get("limit"), 60),
		Offset:     atoiDefault(q.Get("offset"), 0),
	}
	uv := s.userView(currentUser(r), query.Collection)
	res := s.index.search(query, uv)
	// Attach the mounted-cleanly bit for any artifact rendered this run (§6
	// health check reuses the thumbnail render pass). Left nil when unknown.
	if s.thumbs != nil {
		for i := range res.Results {
			if ok, known := s.thumbs.renderStatus(res.Results[i].Hash); known {
				v := ok
				res.Results[i].RenderOK = &v
			}
		}
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(res); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// userView loads the acting user's favorites and tags (and, when a collection is
// being filtered, its item set) for enriching/filtering a search.
func (s *Server) userView(user string, collection int64) userView {
	uv := userView{}
	uv.favorites, _ = s.store.Favorites(user)
	uv.tags, _ = s.store.TagsByArtifact(user)
	if collection != 0 {
		if keys, err := s.store.CollectionItems(user, collection); err == nil {
			uv.collectionKeys = map[string]bool{}
			for _, k := range keys {
				uv.collectionKeys[k] = true
			}
		}
	}
	return uv
}

// handleFavorite toggles or sets an artifact's favorite state for the acting user.
// POST /api/favorite?key=...&on=true|false (omit on to toggle).
func (s *Server) handleFavorite(w http.ResponseWriter, r *http.Request) {
	key := r.FormValue("key")
	if key == "" {
		http.Error(w, "key required", http.StatusBadRequest)
		return
	}
	user := currentUser(r)
	var on bool
	switch r.FormValue("on") {
	case "true":
		on = true
	case "false":
		on = false
	default: // toggle
		cur, _ := s.store.IsFavorite(user, key)
		on = !cur
	}
	if err := s.store.SetFavorite(user, key, on); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"key": key, "favorite": on})
}

// handleTagAdd / handleTagRemove add or remove a user tag on an artifact.
// POST /api/tags/add|remove?key=&tag=
func (s *Server) handleTagAdd(w http.ResponseWriter, r *http.Request) { s.tagOp(w, r, true) }

func (s *Server) handleTagRemove(w http.ResponseWriter, r *http.Request) { s.tagOp(w, r, false) }

func (s *Server) tagOp(w http.ResponseWriter, r *http.Request, add bool) {
	key := r.FormValue("key")
	tag := strings.TrimSpace(r.FormValue("tag"))
	if key == "" || tag == "" {
		http.Error(w, "key and tag required", http.StatusBadRequest)
		return
	}
	user := currentUser(r)
	var err error
	if add {
		err = s.store.AddTag(user, key, tag)
	} else {
		err = s.store.RemoveTag(user, key, tag)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tags, _ := s.store.TagsFor(user, key)
	writeJSON(w, map[string]any{"key": key, "tags": tags})
}

// ---- collections --------------------------------------------------------

func (s *Server) handleCollectionsList(w http.ResponseWriter, r *http.Request) {
	cols, err := s.store.ListCollections(currentUser(r))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if cols == nil {
		cols = []userdata.Collection{}
	}
	writeJSON(w, cols)
}

func (s *Server) handleCollectionCreate(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		http.Error(w, "name required", http.StatusBadRequest)
		return
	}
	id, err := s.store.CreateCollection(currentUser(r), name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"id": id, "name": name})
}

func (s *Server) handleCollectionDelete(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	if err := s.store.DeleteCollection(currentUser(r), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

func (s *Server) handleCollectionAddItem(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	key := r.FormValue("key")
	if key == "" {
		http.Error(w, "key required", http.StatusBadRequest)
		return
	}
	if err := s.store.AddToCollection(currentUser(r), id, key); err != nil {
		collectionErr(w, err)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

// collectionErr maps a not-found/not-owned collection to 404 (a client error)
// and anything else to 500.
func collectionErr(w http.ResponseWriter, err error) {
	if errors.Is(err, userdata.ErrCollectionNotFound) {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	http.Error(w, err.Error(), http.StatusInternalServerError)
}

func (s *Server) handleCollectionRemoveItem(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	key := r.URL.Query().Get("key") // DELETE: key comes via query
	if key == "" {
		http.Error(w, "key required", http.StatusBadRequest)
		return
	}
	if err := s.store.RemoveFromCollection(currentUser(r), id, key); err != nil {
		collectionErr(w, err)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

func pathID(r *http.Request) (int64, error) {
	return strconv.ParseInt(r.PathValue("id"), 10, 64)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

func atoiDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

func (s *Server) handleView(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	// embed=1 is passed by the detail-page iframe; it suppresses the floating
	// back-to-index nav bar, which is redundant (and covers content) inside a frame.
	embed := r.URL.Query().Get("embed") == "1"

	artifact, err := s.scanner.FindByName(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	switch artifact.Type {
	case "html":
		htmlContent, err := os.ReadFile(artifact.Path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Inject a floating back-to-index nav bar before </body> (unless embedded).
		inject := ""
		if !embed {
			inject = `<div style="position:fixed;top:8px;right:8px;z-index:99999;font-family:'Geneva','Helvetica Neue',sans-serif;font-size:11px;background:#fff;border:2px solid #000;box-shadow:2px 2px 0 #000;padding:4px 10px;cursor:pointer;opacity:0.7;transition:opacity 0.2s" onmouseover="this.style.opacity='1';this.style.background='#000';this.style.color='#fff'" onmouseout="this.style.opacity='0.7';this.style.background='#fff';this.style.color='#000'"><a href="/" style="text-decoration:none;color:inherit">&#x25C0; Index</a></div>`
		}
		if s.watch {
			inject += reloadScript
		}
		modified := strings.Replace(string(htmlContent), "</body>", inject+"</body>", 1)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(modified))

	case "jsx":
		scriptSrc := "/jsx/" + artifact.Name
		scriptType := "text/babel"
		loadBabel := true
		if entry, err := s.precompiled.resolve(artifact); err == nil && entry != nil {
			scriptSrc = "/compiled/" + artifact.Name
			scriptType = "module"
			loadBabel = false
		} else if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		s.jsxHostTemplate.Execute(w, map[string]interface{}{
			"Title":      artifact.Title,
			"Name":       artifact.Name,
			"Watch":      s.watch,
			"Embed":      embed,
			"ScriptSrc":  scriptSrc,
			"ScriptType": scriptType,
			"LoadBabel":  loadBabel,
		})
	}
}

func (s *Server) handleCompiledJSX(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	artifact, err := s.scanner.FindByName(name)
	if err != nil || artifact.Type != "jsx" {
		http.NotFound(w, r)
		return
	}

	entry, err := s.precompiled.resolve(artifact)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if entry == nil {
		http.NotFound(w, r)
		return
	}

	script, err := s.precompiled.script(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
	w.Write(script)
}

// handleJSX serves JSX source with auto-mount code appended.
// This endpoint exists to avoid Go's html/template escaping — the JSX source
// is served as plain text/javascript and never passes through a template.
func (s *Server) handleJSX(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	artifact, err := s.scanner.FindByName(name)
	if err != nil || artifact.Type != "jsx" {
		http.NotFound(w, r)
		return
	}

	jsxSource, err := os.ReadFile(artifact.Path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	mountedSource, err := mountJSXSource(string(jsxSource))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
	w.Write([]byte(mountedSource))
}

func (s *Server) handleRaw(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	artifact, err := s.scanner.FindByName(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, artifact.Path)
}

// handleThumb serves a PNG thumbnail for an artifact, generated on demand and
// cached by content hash. On any failure (no Chrome, render error) it serves a
// neutral placeholder rather than an HTTP error, so the gallery degrades
// gracefully. Responses carry an ETag of the content hash so an unchanged
// artifact revalidates to 304 while an edited one (new hash) is refetched.
func (s *Server) handleThumb(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if s.thumbs == nil {
		servePlaceholderThumb(w)
		return
	}
	hash, ok := s.index.hashByName(name)
	if !ok {
		// The index may not yet know a just-added artifact; hash from disk.
		art, err := s.scanner.FindByName(name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		b, err := os.ReadFile(art.Path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		hash = contentHash(string(b))
	}
	etag := s.thumbs.etag(hash)
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	png, err := s.thumbs.get(r.Context(), name, hash)
	if err != nil {
		log.Printf("thumbnail %s: %v", name, err)
		servePlaceholderThumb(w)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("ETag", etag)
	w.Write(png)
}

func servePlaceholderThumb(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(placeholderPNG())
}

// thumbHash resolves an artifact name to its content hash (the thumbnail cache
// key), preferring the in-memory index and falling back to hashing the file.
func (s *Server) thumbHash(name string) (string, bool) {
	if h, ok := s.index.hashByName(name); ok {
		return h, true
	}
	art, err := s.scanner.FindByName(name)
	if err != nil {
		return "", false
	}
	b, err := os.ReadFile(art.Path)
	if err != nil {
		return "", false
	}
	return contentHash(string(b)), true
}

// handleThumbSave stores a user-supplied PNG (captured from the live artifact in
// the browser) as the artifact's thumbnail, replacing a mediocre auto-generated
// one. The body is the raw PNG bytes.
func (s *Server) handleThumbSave(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if s.thumbs == nil {
		http.Error(w, "thumbnails disabled", http.StatusServiceUnavailable)
		return
	}
	hash, ok := s.thumbHash(name)
	if !ok {
		http.NotFound(w, r)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 25<<20)) // 25 MB cap
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.thumbs.saveUploaded(hash, body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "hash": hash})
}

// handleThumbRerender discards the cached thumbnail and renders a fresh one
// server-side (real headless Chrome), for artifacts a client-side capture can't
// handle (e.g. WebGL) or when the base render was captured too early.
func (s *Server) handleThumbRerender(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if s.thumbs == nil {
		http.Error(w, "thumbnails disabled", http.StatusServiceUnavailable)
		return
	}
	hash, ok := s.thumbHash(name)
	if !ok {
		http.NotFound(w, r)
		return
	}
	if err := s.thumbs.invalidate(hash); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if _, err := s.thumbs.get(r.Context(), name, hash); err != nil {
		writeJSON(w, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, map[string]any{"ok": true, "hash": hash})
}

// backfillThumbnails pre-renders any missing thumbnail after startup so the
// gallery is warm. It walks the index, skips artifacts whose <hash>.png already
// exists, and renders the rest through the same bounded/singleflighted path as
// live requests (so it never competes with them). Re-run is safe and cheap.
func (s *Server) backfillThumbnails(ctx context.Context) {
	// Give the HTTP listener a moment to come up (renders navigate to /view).
	select {
	case <-ctx.Done():
		return
	case <-time.After(500 * time.Millisecond):
	}
	arts := s.index.artifactList()
	rendered := 0
	for _, a := range arts {
		if ctx.Err() != nil {
			return
		}
		hash, ok := s.index.hashByName(a.Name)
		if !ok {
			continue
		}
		if _, cached := s.thumbs.cachedPath(hash); cached {
			continue
		}
		if _, err := s.thumbs.get(ctx, a.Name, hash); err != nil {
			// A single failure (e.g. no Chrome) makes the whole backfill pointless.
			log.Printf("thumbnail backfill stopped after %d rendered: %v", rendered, err)
			return
		}
		rendered++
	}
	if rendered > 0 {
		log.Printf("thumbnail backfill complete: %d rendered", rendered)
	}
}

// handleArtifactJSON returns a single artifact's SearchDocument (enriched with
// the acting user's favorite/tags and render status) plus transcript
// availability and warnings, for the detail page.
func (s *Server) handleArtifactJSON(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	art, err := s.scanner.FindByName(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	doc := buildSearchDocument(*art)
	if hash, ok := s.index.hashByName(name); ok {
		doc.Hash = hash
		if s.thumbs != nil {
			if okr, known := s.thumbs.renderStatus(hash); known {
				doc.RenderOK = &okr
			}
		}
	}
	user := currentUser(r)
	doc.Favorite, _ = s.store.IsFavorite(user, name)
	userTags, _ := s.store.TagsFor(user, name)
	doc.UserTags = userTags
	doc.Tags = mergeTags(art.Tags, userTags)
	writeJSON(w, map[string]any{
		"artifact":       doc,
		"has_transcript": art.TranscriptPath != "",
		"claude_url":     art.ClaudeURL,
		"warnings":       art.Warnings,
		"size":           art.Size,
		"project":        art.Project,
		"created_at":     art.ConversationCreatedAt,
	})
}

// mergeTags returns manifest tags plus user tags, deduped case-insensitively.
func mergeTags(manifest, user []string) []string {
	out := append([]string(nil), manifest...)
	for _, t := range user {
		if !containsFold(out, t) {
			out = append(out, t)
		}
	}
	return out
}

// handleTranscript renders the ingested conversation.md transcript to a readable
// HTML page (markdown via goldmark, GFM). Returns 404 when no transcript exists.
func (s *Server) handleTranscript(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	art, err := s.scanner.FindByName(name)
	if err != nil || art.TranscriptPath == "" {
		http.NotFound(w, r)
		return
	}
	src, err := os.ReadFile(art.TranscriptPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	var body bytes.Buffer
	if err := s.markdown.Convert(src, &body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	title := art.SourceConversationTitle
	if title == "" {
		title = art.Title
	}
	enc := encodePathSegments(art.Name)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	s.transcriptTemplate.Execute(w, map[string]interface{}{
		"Title":     title,
		"Body":      template.HTML(body.String()), //nolint:gosec // goldmark output, raw HTML not enabled
		"DetailURL": "/artifact/" + enc,
		"Enc":       enc,
	})
}

// encodePathSegments URL-escapes each slash-separated segment of an artifact
// name so it can be placed in a URL path (spaces and other characters are
// escaped, but the slashes that separate segments are preserved).
func encodePathSegments(name string) string {
	parts := strings.Split(name, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}

// handleHighlight returns the artifact's source as a self-contained,
// syntax-highlighted HTML fragment (chroma with inline styles, so no external
// stylesheet is needed). The detail page injects it into the source panel.
func (s *Server) handleHighlight(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	art, err := s.scanner.FindByName(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	src, err := os.ReadFile(art.Path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	lexer := lexers.Match(art.Filename)
	if lexer == nil {
		lexer = lexers.Analyse(string(src))
	}
	if lexer == nil {
		lexer = lexers.Fallback
	}
	lexer = chroma.Coalesce(lexer)
	style := styles.Get("github")
	if style == nil {
		style = styles.Fallback
	}
	formatter := chromahtml.New(chromahtml.WithClasses(false), chromahtml.TabWidth(2))
	iterator, err := lexer.Tokenise(nil, string(src))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := formatter.Format(w, style, iterator); err != nil {
		log.Printf("highlight %s: %v", name, err)
	}
}

// handleSession streams the whole conversation directory (transcript,
// conversation.json, meta.json, and all reconstructed artifacts) as a zip, so
// the entire session can be downloaded in one click. Returns 404 for artifacts
// that did not come from a conversation export.
func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	art, err := s.scanner.FindByName(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	convDir := ""
	switch {
	case art.TranscriptPath != "":
		convDir = filepath.Dir(art.TranscriptPath)
	case art.FromExport:
		// Artifacts live at <convDir>/artifacts/<file>; go up two levels.
		convDir = filepath.Dir(filepath.Dir(art.Path))
	default:
		http.Error(w, "no conversation session for this artifact", http.StatusNotFound)
		return
	}
	base := art.SourceConversationUUID
	if base == "" {
		base = filepath.Base(convDir)
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", base+".zip"))
	zw := zip.NewWriter(w)
	defer zw.Close()
	_ = filepath.WalkDir(convDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		rel, rerr := filepath.Rel(convDir, path)
		if rerr != nil {
			return nil
		}
		f, cerr := zw.Create(filepath.ToSlash(filepath.Join(base, rel)))
		if cerr != nil {
			return nil
		}
		src, oerr := os.Open(path)
		if oerr != nil {
			return nil
		}
		defer src.Close()
		_, _ = io.Copy(f, src)
		return nil
	})
}

// handleArtifactPage renders the detail page for one artifact: a live preview
// (iframe of /view) plus a metadata panel and highlighted source. All dynamic
// data is fetched client-side from /api/artifact and /raw so the page reuses the
// same enrichment the search results use.
func (s *Server) handleArtifactPage(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	art, err := s.scanner.FindByName(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	s.artifactTemplate.Execute(w, map[string]interface{}{
		"Name":     art.Name,
		"Title":    art.Title,
		"Type":     art.Type,
		"Filename": art.Filename,
		"Watch":    s.watch,
	})
}
