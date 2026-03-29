package jsx

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/evanw/esbuild/pkg/api"
)

const BundleManifestVersion = 1

type BundleManifest struct {
	Version     int           `json:"version"`
	GeneratedAt string        `json:"generated_at"`
	SourceDir   string        `json:"source_dir"`
	Entries     []BundleEntry `json:"entries"`
}

type BundleEntry struct {
	Name         string `json:"name"`
	Filename     string `json:"filename"`
	ScriptFile   string `json:"script_file"`
	SourceSHA256 string `json:"source_sha256"`
}

func SourceSHA256(source []byte) string {
	sum := sha256.Sum256(source)
	return hex.EncodeToString(sum[:])
}

func CompileModule(moduleSource string, sourcefile string) (string, error) {
	result := api.Transform(moduleSource, api.TransformOptions{
		Loader:      api.LoaderJSX,
		Format:      api.FormatESModule,
		Target:      api.ES2020,
		JSX:         api.JSXTransform,
		JSXFactory:  "React.createElement",
		JSXFragment: "React.Fragment",
		Sourcefile:  sourcefile,
	})
	if len(result.Errors) > 0 {
		return "", fmt.Errorf("compiling JSX module: %s", result.Errors[0].Text)
	}
	return string(result.Code), nil
}

func GenerateBundle(sourceDir string, outputDir string) (*BundleManifest, error) {
	entries, err := os.ReadDir(sourceDir)
	if err != nil {
		return nil, fmt.Errorf("reading source dir: %w", err)
	}

	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return nil, fmt.Errorf("creating output dir: %w", err)
	}
	if err := clearBundleOutput(outputDir); err != nil {
		return nil, err
	}

	manifest := &BundleManifest{
		Version:     BundleManifestVersion,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		SourceDir:   sourceDir,
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".jsx" {
			continue
		}

		name := strings.TrimSuffix(entry.Name(), ".jsx")
		sourcePath := filepath.Join(sourceDir, entry.Name())
		sourceBytes, err := os.ReadFile(sourcePath)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", sourcePath, err)
		}

		moduleSource, err := BuildModuleSource(string(sourceBytes))
		if err != nil {
			return nil, fmt.Errorf("building JSX module for %s: %w", sourcePath, err)
		}
		compiled, err := CompileModule(moduleSource, entry.Name())
		if err != nil {
			return nil, fmt.Errorf("compiling %s: %w", sourcePath, err)
		}

		scriptFile := name + ".js"
		if err := os.WriteFile(filepath.Join(outputDir, scriptFile), []byte(compiled), 0o644); err != nil {
			return nil, fmt.Errorf("writing %s: %w", scriptFile, err)
		}

		manifest.Entries = append(manifest.Entries, BundleEntry{
			Name:         name,
			Filename:     entry.Name(),
			ScriptFile:   scriptFile,
			SourceSHA256: SourceSHA256(sourceBytes),
		})
	}

	slices.SortFunc(manifest.Entries, func(a, b BundleEntry) int {
		return strings.Compare(a.Name, b.Name)
	})

	manifestPath := filepath.Join(outputDir, "manifest.json")
	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshalling manifest: %w", err)
	}
	manifestBytes = append(manifestBytes, '\n')
	if err := os.WriteFile(manifestPath, manifestBytes, 0o644); err != nil {
		return nil, fmt.Errorf("writing manifest: %w", err)
	}

	return manifest, nil
}

func clearBundleOutput(outputDir string) error {
	entries, err := os.ReadDir(outputDir)
	if err != nil {
		return fmt.Errorf("reading output dir: %w", err)
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if filepath.Ext(name) != ".js" && name != "manifest.json" {
			continue
		}
		if err := os.Remove(filepath.Join(outputDir, name)); err != nil {
			return fmt.Errorf("removing stale bundle artifact %s: %w", name, err)
		}
	}
	return nil
}
