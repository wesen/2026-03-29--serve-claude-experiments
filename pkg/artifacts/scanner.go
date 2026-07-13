package artifacts

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Artifact represents a single Claude artifact file.
type Artifact struct {
	Name          string         // filename without extension, e.g., "business-app"
	Filename      string         // full filename, e.g., "business-app.jsx"
	Type          string         // "html" or "jsx"
	Title         string         // extracted from <title> tag, component name, or manifest title
	Size          int64          // file size in bytes
	ModifiedAt    time.Time      // last modification time
	Path          string         // absolute path on disk
	Description   string         // manifest description
	Tags          []string       // manifest tags
	OriginalDate  string         // manifest original date in YYYY-MM-DD format
	Links         []ArtifactLink // manifest links
	ManifestPath  string         // absolute path to manifest, if present
	HasManifest   bool           // whether a companion manifest file was found
	ManifestError string         // validation or parse error for the manifest, if any
}

// Scanner reads a directory for artifact files.
type Scanner struct {
	dir string
}

// NewScanner creates a scanner for the given directory.
func NewScanner(dir string) *Scanner {
	return &Scanner{dir: dir}
}

// Scan walks the directory tree (recursively) and returns all artifacts. An
// artifact's Name is its slash-separated path relative to the root, without the
// extension — so a top-level "business-app.jsx" keeps Name "business-app" (as
// before), while a nested "abc123/artifacts/Calendar.jsx" gets a unique Name
// "abc123/artifacts/Calendar". Companion manifests are matched by the same
// relative key within the same directory.
func (s *Scanner) Scan() ([]Artifact, error) {
	type fileEntry struct {
		rel  string // slash path relative to root, without extension
		abs  string
		name string // base filename
		typ  string
		info os.FileInfo
	}

	var files []fileEntry
	manifests := make(map[string]string) // rel-without-suffix -> manifest abs path

	err := filepath.WalkDir(s.dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries rather than aborting the whole scan
		}
		if d.IsDir() {
			if path != s.dir && shouldSkipDir(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		rel, relErr := filepath.Rel(s.dir, path)
		if relErr != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		abs, _ := filepath.Abs(path)

		if isManifestFile(d.Name()) {
			key := strings.TrimSuffix(rel, manifestSuffix)
			manifests[key] = abs
			return nil
		}

		var typ string
		switch filepath.Ext(d.Name()) {
		case ".html", ".htm":
			typ = "html"
		case ".jsx":
			typ = "jsx"
		default:
			return nil
		}
		info, infoErr := d.Info()
		if infoErr != nil {
			return nil
		}
		files = append(files, fileEntry{
			rel:  strings.TrimSuffix(rel, filepath.Ext(d.Name())),
			abs:  abs,
			name: d.Name(),
			typ:  typ,
			info: info,
		})
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("scanning artifact directory: %w", err)
	}

	var artifacts []Artifact
	for _, fe := range files {
		title := extractTitle(fe.abs, fe.typ)
		if title == "" {
			title = path.Base(fe.rel)
		}
		artifact := Artifact{
			Name:       fe.rel,
			Filename:   fe.name,
			Type:       fe.typ,
			Title:      title,
			Size:       fe.info.Size(),
			ModifiedAt: fe.info.ModTime(),
			Path:       fe.abs,
		}
		if manifestPath, ok := manifests[fe.rel]; ok {
			artifact.HasManifest = true
			artifact.ManifestPath = manifestPath
			manifest, err := loadManifest(manifestPath)
			if err != nil {
				artifact.ManifestError = err.Error()
			} else {
				applyManifest(&artifact, manifest)
			}
		}
		artifacts = append(artifacts, artifact)
	}
	return artifacts, nil
}

// shouldSkipDir skips noise directories during the recursive walk.
func shouldSkipDir(name string) bool {
	switch name {
	case "node_modules", ".git", ".svn", "__pycache__":
		return true
	}
	return strings.HasPrefix(name, ".")
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

var exportDefaultFunctionRe = regexp.MustCompile(`(?m)export\s+default\s+function\s+([A-Za-z_]\w*)`)
var exportDefaultClassRe = regexp.MustCompile(`(?m)export\s+default\s+class\s+([A-Za-z_]\w*)`)
var exportDefaultIdentifierRe = regexp.MustCompile(`(?m)export\s+default\s+([A-Za-z_]\w*)\s*;`)

func extractJSXComponentName(path string) string {
	content, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return extractJSXComponentNameFromSource(string(content))
}

func extractJSXComponentNameFromSource(source string) string {
	if m := exportDefaultFunctionRe.FindStringSubmatch(source); len(m) > 1 {
		return m[1]
	}
	if m := exportDefaultClassRe.FindStringSubmatch(source); len(m) > 1 {
		return m[1]
	}
	if m := exportDefaultIdentifierRe.FindStringSubmatch(source); len(m) > 1 {
		name := m[1]
		if hasNamedJSXExport(source, name) {
			return name
		}
	}
	return ""
}

func hasNamedJSXExport(source string, name string) bool {
	quoted := regexp.QuoteMeta(name)
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?m)function\s+` + quoted + `\s*\(`),
		regexp.MustCompile(`(?m)(?:const|let|var)\s+` + quoted + `\b`),
		regexp.MustCompile(`(?m)class\s+` + quoted + `\b`),
	}
	for _, pattern := range patterns {
		if pattern.MatchString(source) {
			return true
		}
	}
	return false
}
