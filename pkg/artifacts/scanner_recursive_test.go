package artifacts

import (
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func TestScanRecursesSubdirectories(t *testing.T) {
	root := t.TempDir()
	// top-level artifact keeps a bare name
	writeFile(t, filepath.Join(root, "top.jsx"), "export default function Top(){ return <div/>; }")
	// nested artifacts (mirrors the claude-download layout) get relative-path names
	nested := filepath.Join(root, "abc123", "artifacts")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(nested, "Calendar.jsx"), "export default function Calendar(){ return <div/>; }")
	writeFile(t, filepath.Join(nested, "page.html"), "<title>My Page</title>")
	// noise dir should be skipped
	nm := filepath.Join(root, "node_modules")
	if err := os.MkdirAll(nm, 0o755); err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(nm, "ignored.jsx"), "export default function X(){ return <div/>; }")

	arts, err := NewScanner(root).Scan()
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	got := make([]string, 0, len(arts))
	for _, a := range arts {
		got = append(got, a.Name)
	}
	sort.Strings(got)
	want := []string{"abc123/artifacts/Calendar", "abc123/artifacts/page", "top"}
	if len(got) != len(want) {
		t.Fatalf("names = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("names = %v, want %v", got, want)
		}
	}

	// FindByName resolves a nested key
	a, err := NewScanner(root).FindByName("abc123/artifacts/Calendar")
	if err != nil {
		t.Fatalf("FindByName nested: %v", err)
	}
	if a.Title != "Calendar" || a.Type != "jsx" {
		t.Fatalf("nested artifact wrong: %+v", a)
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
