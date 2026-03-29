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
	"strings"
	"time"

	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
)

//go:embed templates
var templateFS embed.FS

// Server serves Claude artifacts over HTTP.
type Server struct {
	scanner         *artifacts.Scanner
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
	Dir   string
	Port  int
	Watch bool
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

	return &Server{
		scanner:         scanner,
		dir:             cfg.Dir,
		port:            cfg.Port,
		watch:           cfg.Watch,
		watcher:         w,
		precompiled:     precompiled,
		indexTemplate:   indexTmpl,
		jsxHostTemplate: jsxHostTmpl,
	}, nil
}

// reloadScript is injected into served pages when watch mode is enabled.
const reloadScript = `<script>
(function(){var es=new EventSource("/events");es.onmessage=function(e){if(e.data==="reload")location.reload()};es.onerror=function(){setTimeout(function(){location.reload()},2000)};})();
</script>`

// Run starts the HTTP server and blocks until the context is cancelled.
func (s *Server) Run(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", s.handleIndex)
	mux.HandleFunc("GET /search-index.json", s.handleSearchIndex)
	mux.HandleFunc("GET /view/{name}", s.handleView)
	mux.HandleFunc("GET /raw/{name}", s.handleRaw)
	mux.HandleFunc("GET /compiled/{name}.js", s.handleCompiledJSX)
	mux.HandleFunc("GET /jsx/{name}", s.handleJSX)

	if s.watch && s.watcher != nil {
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
	arts, err := s.scanner.Scan()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	s.indexTemplate.Execute(w, map[string]interface{}{
		"Artifacts": arts,
		"Dir":       s.dir,
		"Watch":     s.watch,
	})
}

func (s *Server) handleSearchIndex(w http.ResponseWriter, r *http.Request) {
	arts, err := s.scanner.Scan()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(buildSearchDocuments(arts)); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
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
			scriptSrc = "/compiled/" + artifact.Name + ".js"
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
