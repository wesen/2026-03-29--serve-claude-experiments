package artifacts

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// Sentinel errors for corpus writes. Handlers map these to specific HTTP status
// codes (400 for a bad name/type, 409 for a collision) rather than a blanket 500.
var (
	ErrBadArtifactName = errors.New("bad artifact name")
	ErrUnsupportedType = errors.New("unsupported artifact type")
	ErrArtifactExists  = errors.New("artifact already exists")
)

// ValidateManifest checks a manifest against the same rules the loader enforces
// (non-blank present title, non-blank tags, YYYY-MM-DD date, http(s) links). It
// normalizes the manifest in place (trims whitespace on title/description/tags/
// links). Callers that write a manifest should validate first so the next scan
// does not surface a ManifestError.
func ValidateManifest(m *ArtifactManifest) error { return validateManifest(m) }

// LoadManifest reads and validates a manifest file. It is the exported form of
// the loader used during scanning, so the PATCH (merge) path can read the current
// manifest before overlaying changes.
func LoadManifest(path string) (*ArtifactManifest, error) { return loadManifest(path) }

// ManifestPathFor returns the sidecar manifest path for an artifact: the artifact
// file's path with its extension replaced by ".manifest.json". This is exactly the
// key the scanner matches on — the artifact's relative path minus its extension
// equals the manifest's relative path minus ".manifest.json" — so a manifest
// written here is picked up on the next scan and applied to this artifact.
func ManifestPathFor(a *Artifact) string {
	ext := filepath.Ext(a.Filename)
	base := strings.TrimSuffix(a.Filename, ext)
	return filepath.Join(filepath.Dir(a.Path), base+manifestSuffix)
}

// WriteManifest validates m and writes it as indented JSON to path, atomically
// (temp file + rename) so a concurrent scan never reads a half-written file.
func WriteManifest(path string, m *ArtifactManifest) error {
	if err := ValidateManifest(m); err != nil {
		return err
	}
	b, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling manifest: %w", err)
	}
	return WriteFileAtomic(path, append(b, '\n'))
}

// ExtensionForType maps an artifact type ("html", "jsx") to its file extension.
// Unknown types return ErrUnsupportedType — push only accepts renderable types.
func ExtensionForType(typ string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(typ)) {
	case "html":
		return ".html", nil
	case "jsx":
		return ".jsx", nil
	default:
		return "", fmt.Errorf("%q: %w", typ, ErrUnsupportedType)
	}
}

// SafeArtifactPath resolves an artifact Name (slash path without extension, e.g.
// "demos/pricing") plus an extension to an absolute path under root, rejecting any
// name that is empty, absolute, or escapes root via "..". This is the single guard
// against path traversal on push; call it before any stat or write.
func SafeArtifactPath(root, name, ext string) (string, error) {
	name = strings.TrimSpace(name)
	// Reject empty and absolute names outright; an absolute name is never a valid
	// artifact key and force-rooting it would silently relocate it under root.
	if name == "" || strings.HasPrefix(name, "/") {
		return "", ErrBadArtifactName
	}
	// Clean the *relative* name (do NOT prefix "/", which would clamp a traversal
	// to root and hide it). A name whose net effect climbs above root cleans to a
	// path that is "." or begins with "..".
	clean := path.Clean(name)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", ErrBadArtifactName
	}
	abs := filepath.Join(root, filepath.FromSlash(clean)+ext)
	// Defense in depth: confirm the resolved path is still under root.
	rp, err := filepath.Rel(root, abs)
	if err != nil || rp == ".." || strings.HasPrefix(rp, ".."+string(filepath.Separator)) {
		return "", ErrBadArtifactName
	}
	return abs, nil
}

// WriteFileAtomic writes data to path via a temp file in the same directory
// followed by a rename, which is atomic within a filesystem. The parent directory
// is created if needed.
func WriteFileAtomic(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("creating directory: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}
