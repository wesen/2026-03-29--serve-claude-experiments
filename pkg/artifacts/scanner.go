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

	// Provenance, ingested from a conversation export's meta.json when the
	// artifact lives at "<conversation-uuid>/artifacts/<file>". Empty otherwise.
	FromExport              bool     // true when a sibling export meta.json was found
	SourceConversationUUID  string   // meta.json uuid
	SourceConversationTitle string   // meta.json name (the conversation title)
	Project                 string   // meta.json project_uuid (empty when unfiled)
	Model                   string   // meta.json model
	ConversationCreatedAt   string   // meta.json created_at (RFC3339)
	ConversationUpdatedAt   string   // meta.json updated_at (RFC3339)
	TranscriptPath          string   // abs path to <uuid>/conversation.md, if present
	ClaudeURL               string   // https://claude.ai/chat/<uuid>
	Warnings                []string // conversation reconstruction warnings
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

	metaCache := make(map[string]*exportMeta) // conversation dir -> parsed meta.json (nil = none)

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

		// Provenance: an artifact at "<uuid>/artifacts/<file>" is described by
		// "<uuid>/meta.json". Enrich BEFORE the manifest overlay so a manifest
		// title still wins (precedence: manifest > conversation name > derived).
		if meta := lookupExportMeta(fe.abs, metaCache); meta != nil {
			enrichFromExportMeta(&artifact, meta, filepath.Dir(filepath.Dir(fe.abs)))
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

// lookupExportMeta returns the conversation export meta.json for an artifact at
// "<conversation>/artifacts/<file>", or nil when the artifact is not laid out
// that way or has no meta.json. Results (including misses) are cached per
// conversation directory so each meta.json is read at most once per scan.
func lookupExportMeta(absFilePath string, cache map[string]*exportMeta) *exportMeta {
	artifactsDir := filepath.Dir(absFilePath)
	if filepath.Base(artifactsDir) != "artifacts" {
		return nil
	}
	convDir := filepath.Dir(artifactsDir)
	if cached, seen := cache[convDir]; seen {
		return cached
	}
	var meta *exportMeta
	if m, err := loadExportMeta(filepath.Join(convDir, "meta.json")); err == nil {
		meta = m
	}
	cache[convDir] = meta
	return meta
}

// enrichFromExportMeta copies conversation provenance onto the artifact. It sets
// the title from the conversation name only when no better (manifest) title has
// been applied yet — the manifest overlay runs afterwards and still wins.
func enrichFromExportMeta(a *Artifact, meta *exportMeta, convDir string) {
	a.FromExport = true
	a.SourceConversationUUID = meta.UUID
	a.SourceConversationTitle = meta.Name
	a.Project = meta.ProjectUUID
	a.Model = plausibleModel(meta.Model, meta.UpdatedAt)
	a.ConversationCreatedAt = meta.CreatedAt
	a.ConversationUpdatedAt = meta.UpdatedAt
	a.Warnings = append([]string(nil), meta.Warnings...)
	if meta.UUID != "" {
		a.ClaudeURL = "https://claude.ai/chat/" + meta.UUID
	}
	if transcript := filepath.Join(convDir, "conversation.md"); fileExists(transcript) {
		a.TranscriptPath = transcript
	}
	if a.OriginalDate == "" {
		a.OriginalDate = dateOnly(meta.CreatedAt)
	}
	// Conversation name is a better default than a component/HTML-derived title.
	if strings.TrimSpace(meta.Name) != "" {
		a.Title = meta.Name
	}
}

var modelDateSuffixRe = regexp.MustCompile(`-(\d{8})$`)

// plausibleModel drops a model whose embedded release date (…-YYYYMMDD) is after
// the conversation's last activity. claude.ai reports the account's *current*
// default model for old conversations, not the one actually used, so such a
// model is impossible and misleading (e.g. a 2024-12-07 conversation labeled
// claude-sonnet-4-5-20250929). Models without a date suffix are left as-is.
func plausibleModel(model, updatedAt string) string {
	m := modelDateSuffixRe.FindStringSubmatch(model)
	if m == nil || len(updatedAt) < 10 {
		return model
	}
	conv := strings.ReplaceAll(updatedAt[:10], "-", "") // YYYYMMDD
	if m[1] > conv {
		return ""
	}
	return model
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
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
