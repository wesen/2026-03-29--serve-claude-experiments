package server

import (
	"html/template"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
	"github.com/go-go-golems/serve-artifacts/pkg/jsx"
)

func TestPrecompiledBundleResolve(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	source := `export default function DemoApp() { return <div>Hello</div>; }`
	path := filepath.Join(dir, "demo.jsx")
	if err := os.WriteFile(path, []byte(source), 0o644); err != nil {
		t.Fatalf("writing source file: %v", err)
	}

	artifact := &artifacts.Artifact{
		Name: "demo",
		Type: "jsx",
		Path: path,
	}

	t.Run("matching hash", func(t *testing.T) {
		t.Parallel()

		bundle := &precompiledBundle{
			entries: map[string]jsx.BundleEntry{
				"demo": {
					Name:         "demo",
					ScriptFile:   "demo.js",
					SourceSHA256: jsx.SourceSHA256([]byte(source)),
				},
			},
		}

		entry, err := bundle.resolve(artifact)
		if err != nil {
			t.Fatalf("resolve returned error: %v", err)
		}
		if entry == nil || entry.Name != "demo" {
			t.Fatalf("expected matching entry, got %#v", entry)
		}
	})

	t.Run("mismatched hash", func(t *testing.T) {
		t.Parallel()

		bundle := &precompiledBundle{
			entries: map[string]jsx.BundleEntry{
				"demo": {
					Name:         "demo",
					ScriptFile:   "demo.js",
					SourceSHA256: "not-a-real-hash",
				},
			},
		}

		entry, err := bundle.resolve(artifact)
		if err != nil {
			t.Fatalf("resolve returned error: %v", err)
		}
		if entry != nil {
			t.Fatalf("expected nil entry for mismatched hash, got %#v", entry)
		}
	})
}

func TestHandleViewSwitchesBetweenPrecompiledAndFallback(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	source := `export default function DemoApp() { return <div>Hello</div>; }`
	path := filepath.Join(dir, "demo.jsx")
	if err := os.WriteFile(path, []byte(source), 0o644); err != nil {
		t.Fatalf("writing source file: %v", err)
	}

	jsxHostTmpl, err := template.New("jsx-host.html").ParseFS(templateFS, "templates/jsx-host.html")
	if err != nil {
		t.Fatalf("parsing template: %v", err)
	}

	newServer := func(hash string) *Server {
		return &Server{
			scanner:         artifacts.NewScanner(dir),
			precompiled:     &precompiledBundle{entries: map[string]jsx.BundleEntry{"demo": {Name: "demo", ScriptFile: "demo.js", SourceSHA256: hash}}},
			jsxHostTemplate: jsxHostTmpl,
		}
	}

	t.Run("precompiled mode", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest("GET", "/view/demo", nil)
		req.SetPathValue("name", "demo")
		rec := httptest.NewRecorder()

		newServer(jsx.SourceSHA256([]byte(source))).handleView(rec, req)
		body := rec.Body.String()
		if !strings.Contains(body, `src="/compiled/demo.js"`) {
			t.Fatalf("expected compiled script src, got %q", body)
		}
		if strings.Contains(body, "babel.min.js") {
			t.Fatalf("did not expect Babel in precompiled mode, got %q", body)
		}
	})

	t.Run("fallback mode", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest("GET", "/view/demo", nil)
		req.SetPathValue("name", "demo")
		rec := httptest.NewRecorder()

		newServer("stale-hash").handleView(rec, req)
		body := rec.Body.String()
		if !strings.Contains(body, `src="/jsx/demo"`) {
			t.Fatalf("expected fallback jsx script src, got %q", body)
		}
		if !strings.Contains(body, "babel.min.js") {
			t.Fatalf("expected Babel in fallback mode, got %q", body)
		}
	})
}
