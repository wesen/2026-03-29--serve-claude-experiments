package jsx

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGenerateBundle(t *testing.T) {
	t.Parallel()

	sourceDir := t.TempDir()
	outputDir := t.TempDir()

	source := `export default function DemoApp() {
  return <div>Hello</div>;
}`
	if err := os.WriteFile(filepath.Join(sourceDir, "demo.jsx"), []byte(source), 0o644); err != nil {
		t.Fatalf("writing source file: %v", err)
	}

	manifest, err := GenerateBundle(sourceDir, outputDir)
	if err != nil {
		t.Fatalf("GenerateBundle returned error: %v", err)
	}
	if len(manifest.Entries) != 1 {
		t.Fatalf("expected one manifest entry, got %d", len(manifest.Entries))
	}
	entry := manifest.Entries[0]
	if entry.Name != "demo" {
		t.Fatalf("expected entry name demo, got %q", entry.Name)
	}
	if entry.SourceSHA256 != SourceSHA256([]byte(source)) {
		t.Fatalf("unexpected source hash: %q", entry.SourceSHA256)
	}

	compiledBytes, err := os.ReadFile(filepath.Join(outputDir, entry.ScriptFile))
	if err != nil {
		t.Fatalf("reading compiled output: %v", err)
	}
	compiled := string(compiledBytes)
	for _, want := range []string{
		`import React from "react";`,
		`import { createRoot } from "react-dom/client";`,
		`React.createElement("div", null, "Hello")`,
	} {
		if !strings.Contains(compiled, want) {
			t.Fatalf("expected compiled output to contain %q, got %q", want, compiled)
		}
	}

	manifestBytes, err := os.ReadFile(filepath.Join(outputDir, "manifest.json"))
	if err != nil {
		t.Fatalf("reading manifest: %v", err)
	}
	if !strings.Contains(string(manifestBytes), `"name": "demo"`) {
		t.Fatalf("expected manifest to contain entry for demo, got %q", string(manifestBytes))
	}
}
