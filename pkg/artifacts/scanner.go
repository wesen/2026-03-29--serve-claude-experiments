package artifacts

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Artifact represents a single Claude artifact file.
type Artifact struct {
	Name       string    // filename without extension, e.g., "business-app"
	Filename   string    // full filename, e.g., "business-app.jsx"
	Type       string    // "html" or "jsx"
	Title      string    // extracted from <title> tag or component name
	Size       int64     // file size in bytes
	ModifiedAt time.Time // last modification time
	Path       string    // absolute path on disk
}

// Scanner reads a directory for artifact files.
type Scanner struct {
	dir string
}

// NewScanner creates a scanner for the given directory.
func NewScanner(dir string) *Scanner {
	return &Scanner{dir: dir}
}

// Scan reads the directory and returns all artifacts.
func (s *Scanner) Scan() ([]Artifact, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, fmt.Errorf("reading artifact directory: %w", err)
	}

	var artifacts []Artifact
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := filepath.Ext(entry.Name())
		var artifactType string
		switch ext {
		case ".html", ".htm":
			artifactType = "html"
		case ".jsx":
			artifactType = "jsx"
		default:
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		name := strings.TrimSuffix(entry.Name(), ext)
		absPath, _ := filepath.Abs(filepath.Join(s.dir, entry.Name()))
		title := extractTitle(absPath, artifactType)
		if title == "" {
			title = name
		}

		artifacts = append(artifacts, Artifact{
			Name:       name,
			Filename:   entry.Name(),
			Type:       artifactType,
			Title:      title,
			Size:       info.Size(),
			ModifiedAt: info.ModTime(),
			Path:       absPath,
		})
	}
	return artifacts, nil
}

// FindByName finds an artifact by its name (filename without extension).
func (s *Scanner) FindByName(name string) (*Artifact, error) {
	artifacts, err := s.Scan()
	if err != nil {
		return nil, err
	}
	for _, a := range artifacts {
		if a.Name == name {
			return &a, nil
		}
	}
	return nil, fmt.Errorf("artifact not found: %s", name)
}

func extractTitle(path string, artifactType string) string {
	switch artifactType {
	case "html":
		return extractHTMLTitle(path)
	case "jsx":
		return extractJSXComponentName(path)
	default:
		return ""
	}
}

var titleRe = regexp.MustCompile(`<title>([^<]+)</title>`)

func extractHTMLTitle(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()

	buf := make([]byte, 4096)
	n, _ := f.Read(buf)
	content := string(buf[:n])

	if m := titleRe.FindStringSubmatch(content); len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	return ""
}

var exportDefaultRe = regexp.MustCompile(`export\s+default\s+function\s+(\w+)`)

func extractJSXComponentName(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		if m := exportDefaultRe.FindStringSubmatch(scanner.Text()); len(m) > 1 {
			return m[1]
		}
	}
	return ""
}
