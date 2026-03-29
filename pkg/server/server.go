package server

import (
	"context"
	"embed"
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
	indexTemplate   *template.Template
	jsxHostTemplate *template.Template
}

// Config holds server configuration.
type Config struct {
	Dir  string
	Port int
}

// New creates a new artifact server.
func New(cfg Config) (*Server, error) {
	scanner := artifacts.NewScanner(cfg.Dir)

	indexTmpl, err := template.New("index.html").ParseFS(templateFS, "templates/index.html")
	if err != nil {
		return nil, fmt.Errorf("parsing index template: %w", err)
	}

	jsxHostTmpl, err := template.New("jsx-host.html").ParseFS(templateFS, "templates/jsx-host.html")
	if err != nil {
		return nil, fmt.Errorf("parsing jsx-host template: %w", err)
	}

	return &Server{
		scanner:         scanner,
		dir:             cfg.Dir,
		port:            cfg.Port,
		indexTemplate:   indexTmpl,
		jsxHostTemplate: jsxHostTmpl,
	}, nil
}

// Run starts the HTTP server and blocks until the context is cancelled.
func (s *Server) Run(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", s.handleIndex)
	mux.HandleFunc("GET /view/{name}", s.handleView)
	mux.HandleFunc("GET /raw/{name}", s.handleRaw)

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
	})
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
		http.ServeFile(w, r, artifact.Path)

	case "jsx":
		jsxSource, err := os.ReadFile(artifact.Path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Escape </script> to prevent premature tag closing
		safeSource := strings.ReplaceAll(string(jsxSource), "</script>", `<\/script>`)

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		s.jsxHostTemplate.Execute(w, map[string]interface{}{
			"Title":     artifact.Title,
			"Name":      artifact.Name,
			"JSXSource": template.JS(safeSource),
		})
	}
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
