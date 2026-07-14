package server

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
	"github.com/go-go-golems/serve-artifacts/pkg/userdata"
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
	scanner         *artifacts.Scanner
	index           *searchIndex
	store           *userdata.Store
	dir             string
	port            int
	watch           bool
	watcher         *watcher
	precompiled     *precompiledBundle
	indexTemplate   *template.Template
	jsxHostTemplate *template.Template
}

// Config holds server configuration.
type Config struct {
	Dir    string
	Port   int
	Watch  bool
	DBPath string // SQLite path for user data; empty = default under the config dir
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

	return &Server{
		scanner:         scanner,
		index:           newSearchIndex(scanner),
		store:           store,
		dir:             cfg.Dir,
		port:            cfg.Port,
		watch:           cfg.Watch,
		watcher:         w,
		precompiled:     precompiled,
		indexTemplate:   indexTmpl,
		jsxHostTemplate: jsxHostTmpl,
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
	// {name...} matches multi-segment names so artifacts in nested subdirectories
	// (e.g. "<uuid>/artifacts/Calendar") resolve.
	mux.HandleFunc("GET /view/{name...}", s.handleView)
	mux.HandleFunc("GET /raw/{name...}", s.handleRaw)
	mux.HandleFunc("GET /compiled/{name...}", s.handleCompiledJSX)
	mux.HandleFunc("GET /jsx/{name...}", s.handleJSX)

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

	go func() {
		<-ctx.Done()
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
	query := searchQuery{
		Q:          q.Get("q"),
		Type:       q.Get("type"),
		Project:    q.Get("project"),
		Model:      q.Get("model"),
		Tags:       q["tag"],
		Library:    q.Get("library"),
		Warnings:   q.Get("warnings") == "true",
		Favorite:   q.Get("favorite") == "true",
		Collection: int64(atoiDefault(q.Get("collection"), 0)),
		Sort:       q.Get("sort"),
		Limit:      atoiDefault(q.Get("limit"), 60),
		Offset:     atoiDefault(q.Get("offset"), 0),
	}
	uv := s.userView(currentUser(r), query.Collection)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(s.index.search(query, uv)); err != nil {
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
		// Inject a floating back-to-index nav bar before </body>
		navBar := `<div style="position:fixed;top:8px;right:8px;z-index:99999;font-family:'Geneva','Helvetica Neue',sans-serif;font-size:11px;background:#fff;border:2px solid #000;box-shadow:2px 2px 0 #000;padding:4px 10px;cursor:pointer;opacity:0.7;transition:opacity 0.2s" onmouseover="this.style.opacity='1';this.style.background='#000';this.style.color='#fff'" onmouseout="this.style.opacity='0.7';this.style.background='#fff';this.style.color='#000'"><a href="/" style="text-decoration:none;color:inherit">&#x25C0; Index</a></div>`
		inject := navBar
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
