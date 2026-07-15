package artifacts

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestExtensionForType(t *testing.T) {
	cases := map[string]struct {
		want string
		err  error
	}{
		"html":  {".html", nil},
		"HTML":  {".html", nil},
		" jsx ": {".jsx", nil},
		"png":   {"", ErrUnsupportedType},
		"":      {"", ErrUnsupportedType},
	}
	for in, c := range cases {
		got, err := ExtensionForType(in)
		if c.err != nil {
			if !errors.Is(err, c.err) {
				t.Errorf("ExtensionForType(%q) err = %v, want %v", in, err, c.err)
			}
			continue
		}
		if err != nil || got != c.want {
			t.Errorf("ExtensionForType(%q) = %q,%v want %q", in, got, err, c.want)
		}
	}
}

func TestSafeArtifactPath(t *testing.T) {
	root := "/srv/artifacts"
	good := map[string]string{
		"demos/pricing":      "/srv/artifacts/demos/pricing.html",
		"top":                "/srv/artifacts/top.html",
		"a/b/c":              "/srv/artifacts/a/b/c.html",
		"./demos/x":          "/srv/artifacts/demos/x.html",
		"nested/./mid/../ok": "/srv/artifacts/nested/ok.html",
	}
	for name, want := range good {
		got, err := SafeArtifactPath(root, name, ".html")
		if err != nil || got != want {
			t.Errorf("SafeArtifactPath(%q) = %q,%v want %q", name, got, err, want)
		}
	}

	bad := []string{"", "   ", "..", "../escape", "a/../../escape", "/etc/passwd", "foo/../../bar"}
	for _, name := range bad {
		if _, err := SafeArtifactPath(root, name, ".html"); !errors.Is(err, ErrBadArtifactName) {
			t.Errorf("SafeArtifactPath(%q) err = %v, want ErrBadArtifactName", name, err)
		}
	}
}

func TestManifestPathFor(t *testing.T) {
	a := &Artifact{Filename: "Calendar.jsx", Path: "/srv/x/abc/artifacts/Calendar.jsx"}
	want := "/srv/x/abc/artifacts/Calendar.manifest.json"
	if got := ManifestPathFor(a); got != want {
		t.Fatalf("ManifestPathFor = %q, want %q", got, want)
	}
}

func TestWriteAndLoadManifest(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "x.manifest.json")

	m := &ArtifactManifest{
		Title:        "  Hello  ", // trimmed by validation
		Description:  "desc",
		Tags:         []string{"a", " b "},
		OriginalDate: "2024-11-02",
		Links:        []ArtifactLink{{Label: "L", URL: "https://example.com"}},
	}
	if err := WriteManifest(p, m); err != nil {
		t.Fatalf("WriteManifest: %v", err)
	}
	got, err := LoadManifest(p)
	if err != nil {
		t.Fatalf("LoadManifest: %v", err)
	}
	if got.Title != "Hello" {
		t.Errorf("title = %q, want trimmed Hello", got.Title)
	}
	if len(got.Tags) != 2 || got.Tags[1] != "b" {
		t.Errorf("tags = %v, want normalized [a b]", got.Tags)
	}
}

func TestWriteManifestRejectsInvalid(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "bad.manifest.json")

	// A bad date must be rejected and no file written.
	m := &ArtifactManifest{OriginalDate: "11/02/2024"}
	if err := WriteManifest(p, m); err == nil {
		t.Fatal("WriteManifest accepted an invalid date")
	}
	if _, err := os.Stat(p); !os.IsNotExist(err) {
		t.Fatalf("invalid manifest left a file on disk: %v", err)
	}
}

func TestWriteFileAtomicCreatesParents(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "deep/nested/file.html")
	if err := WriteFileAtomic(p, []byte("<html></html>")); err != nil {
		t.Fatalf("WriteFileAtomic: %v", err)
	}
	b, err := os.ReadFile(p)
	if err != nil || string(b) != "<html></html>" {
		t.Fatalf("readback = %q,%v", b, err)
	}
	if _, err := os.Stat(p + ".tmp"); !os.IsNotExist(err) {
		t.Fatalf("temp file left behind: %v", err)
	}
}
