package artifacts

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScannerAppliesManifestMetadata(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeTestFile(t, filepath.Join(dir, "demo.jsx"), `export default function DemoApp() { return <div>Hello</div>; }`)
	writeTestFile(t, filepath.Join(dir, "demo.manifest.json"), `{
  "title": "Demo App",
  "description": "A small demo artifact.",
  "tags": ["demo", "react"],
  "original_date": "2026-03-29",
  "links": [
    { "label": "Source", "url": "https://example.com/demo" }
  ]
}`)

	arts, err := NewScanner(dir).Scan()
	if err != nil {
		t.Fatalf("Scan returned error: %v", err)
	}
	if len(arts) != 1 {
		t.Fatalf("expected 1 artifact, got %d", len(arts))
	}

	a := arts[0]
	if !a.HasManifest {
		t.Fatalf("expected artifact to report HasManifest")
	}
	if a.ManifestError != "" {
		t.Fatalf("expected no manifest error, got %q", a.ManifestError)
	}
	if a.Title != "Demo App" {
		t.Fatalf("expected manifest title override, got %q", a.Title)
	}
	if a.Description != "A small demo artifact." {
		t.Fatalf("unexpected description: %q", a.Description)
	}
	if a.OriginalDate != "2026-03-29" {
		t.Fatalf("unexpected original date: %q", a.OriginalDate)
	}
	if len(a.Tags) != 2 || a.Tags[0] != "demo" || a.Tags[1] != "react" {
		t.Fatalf("unexpected tags: %#v", a.Tags)
	}
	if len(a.Links) != 1 || a.Links[0].Label != "Source" {
		t.Fatalf("unexpected links: %#v", a.Links)
	}
}

func TestScannerKeepsArtifactWhenManifestInvalid(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeTestFile(t, filepath.Join(dir, "demo.html"), "<!DOCTYPE html><html><head><title>Fallback</title></head><body>Hello</body></html>")
	writeTestFile(t, filepath.Join(dir, "demo.manifest.json"), `{
  "title": "Broken Demo",
  "original_date": "03/29/2026"
}`)

	arts, err := NewScanner(dir).Scan()
	if err != nil {
		t.Fatalf("Scan returned error: %v", err)
	}
	if len(arts) != 1 {
		t.Fatalf("expected 1 artifact, got %d", len(arts))
	}

	a := arts[0]
	if !a.HasManifest {
		t.Fatalf("expected artifact to report HasManifest")
	}
	if a.ManifestError == "" {
		t.Fatalf("expected manifest error to be recorded")
	}
	if a.Title != "Fallback" {
		t.Fatalf("expected scanner-derived title fallback, got %q", a.Title)
	}
}

func TestLoadManifestRejectsUnknownFields(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "demo.manifest.json")
	writeTestFile(t, path, `{
  "title": "Demo",
  "unknown": true
}`)

	_, err := loadManifest(path)
	if err == nil {
		t.Fatalf("expected error for unknown field")
	}
}

func writeTestFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("writing %s: %v", path, err)
	}
}
