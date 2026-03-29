package server

import (
	"embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
	"github.com/go-go-golems/serve-artifacts/pkg/jsx"
)

//go:generate go run ../../cmd/precompile-jsx-bundle --dir ../../imports --out ./precompiled

//go:embed precompiled
var precompiledFS embed.FS

type precompiledBundle struct {
	entries map[string]jsx.BundleEntry
}

func loadEmbeddedPrecompiledBundle() (*precompiledBundle, error) {
	manifestBytes, err := precompiledFS.ReadFile("precompiled/manifest.json")
	if err != nil {
		return nil, fmt.Errorf("reading embedded precompiled manifest: %w", err)
	}

	var manifest jsx.BundleManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		return nil, fmt.Errorf("parsing embedded precompiled manifest: %w", err)
	}

	entries := make(map[string]jsx.BundleEntry, len(manifest.Entries))
	for _, entry := range manifest.Entries {
		entries[entry.Name] = entry
	}
	return &precompiledBundle{entries: entries}, nil
}

func (b *precompiledBundle) resolve(artifact *artifacts.Artifact) (*jsx.BundleEntry, error) {
	if b == nil || artifact == nil || artifact.Type != "jsx" {
		return nil, nil
	}

	entry, ok := b.entries[artifact.Name]
	if !ok {
		return nil, nil
	}

	sourceBytes, err := os.ReadFile(artifact.Path)
	if err != nil {
		return nil, err
	}
	if jsx.SourceSHA256(sourceBytes) != entry.SourceSHA256 {
		return nil, nil
	}

	return &entry, nil
}

func (b *precompiledBundle) script(name string) ([]byte, error) {
	entry, ok := b.entries[name]
	if !ok {
		return nil, fmt.Errorf("precompiled artifact not found: %s", name)
	}
	return precompiledFS.ReadFile(filepath.ToSlash(filepath.Join("precompiled", entry.ScriptFile)))
}
