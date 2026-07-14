package server

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
)

// indexEntry is one artifact plus the derived data search needs: its lowercased
// full-text haystack (metadata + source + transcript), the third-party libraries
// it imports, a content hash (the thumbnail cache key), and a timestamp for
// "recent" sorting.
type indexEntry struct {
	art       artifacts.Artifact
	libraries []string
	haystack  string
	hash      string
	sortTime  int64
}

// contentHash returns a short, stable hash of an artifact's source. It is the
// thumbnail cache key: an unchanged artifact keeps its hash (and its cached
// thumbnail) across restarts, while any edit yields a new hash and thus a new,
// missing thumbnail that regenerates on next request — no explicit invalidation.
func contentHash(body string) string {
	sum := sha256.Sum256([]byte(body))
	return hex.EncodeToString(sum[:])[:16]
}

// searchIndex is a cached, in-memory index rebuilt on demand (startup + file
// watch). Reads take an RLock; a rebuild swaps the slice under a Lock.
type searchIndex struct {
	mu      sync.RWMutex
	scanner *artifacts.Scanner
	entries []indexEntry
}

func newSearchIndex(sc *artifacts.Scanner) *searchIndex { return &searchIndex{scanner: sc} }

// rebuild re-scans the directory and reads each artifact's source (and transcript)
// to populate the full-text haystack and library facet. Transcript files are read
// once per conversation.
func (ix *searchIndex) rebuild() error {
	arts, err := ix.scanner.Scan()
	if err != nil {
		return err
	}
	transcriptCache := map[string]string{}
	entries := make([]indexEntry, 0, len(arts))
	for _, a := range arts {
		body := ""
		if b, err := os.ReadFile(a.Path); err == nil {
			body = string(b)
		}
		transcript := ""
		if a.TranscriptPath != "" {
			if t, ok := transcriptCache[a.TranscriptPath]; ok {
				transcript = t
			} else if b, err := os.ReadFile(a.TranscriptPath); err == nil {
				transcript = string(b)
				transcriptCache[a.TranscriptPath] = transcript
			}
		}
		parts := []string{a.Name, a.Title, a.Description, a.Filename, a.Type,
			a.Project, a.Model, a.SourceConversationTitle, a.OriginalDate}
		parts = append(parts, a.Tags...)
		parts = append(parts, body, transcript)
		entries = append(entries, indexEntry{
			art:       a,
			libraries: extractLibraries(body),
			haystack:  strings.ToLower(strings.Join(parts, "\n")),
			hash:      contentHash(body),
			sortTime:  entrySortTime(a),
		})
	}
	ix.mu.Lock()
	ix.entries = entries
	ix.mu.Unlock()
	return nil
}

// hashByName returns the content hash for an artifact name (the thumbnail cache
// key), reading from the in-memory index so /thumb never rescans.
func (ix *searchIndex) hashByName(name string) (string, bool) {
	ix.mu.RLock()
	defer ix.mu.RUnlock()
	for _, e := range ix.entries {
		if e.art.Name == name {
			return e.hash, true
		}
	}
	return "", false
}

// artifacts returns a snapshot of the indexed artifacts (for the index page and
// the legacy /search-index.json), avoiding a per-request rescan.
func (ix *searchIndex) artifactList() []artifacts.Artifact {
	ix.mu.RLock()
	defer ix.mu.RUnlock()
	out := make([]artifacts.Artifact, len(ix.entries))
	for i, e := range ix.entries {
		out[i] = e.art
	}
	return out
}

type searchQuery struct {
	Q          string
	Type       string
	Project    string
	Model      string
	Tags       []string
	Library    string
	Warnings   bool
	Favorite   bool  // only favorites of the acting user
	Collection int64 // only artifacts in this collection (0 = no filter)
	Sort       string
	Limit      int
	Offset     int
}

// userView carries the acting user's per-request organization state so the shared,
// user-agnostic index can enrich and filter results without storing user data.
type userView struct {
	favorites      map[string]bool     // favorited artifact keys
	tags           map[string][]string // artifact key -> user tags
	collectionKeys map[string]bool     // keys in the collection being filtered (nil = no filter)
}

type searchResult struct {
	Total   int                       `json:"total"`
	Results []SearchDocument          `json:"results"`
	Facets  map[string]map[string]int `json:"facets"`
}

const facetNone = "(none)"

func projectFacet(a artifacts.Artifact) string {
	if strings.TrimSpace(a.Project) == "" {
		return facetNone
	}
	return a.Project
}

// matches reports whether an entry passes the query. `skip` names a facet
// dimension to ignore, used when counting that facet (so selecting one value of a
// facet does not zero out its siblings).
// mergedTags returns the artifact's manifest tags plus the user's tags (deduped),
// which is both what the tag facet counts and what a tag filter matches against.
func (e indexEntry) mergedTags(uv userView) []string {
	out := append([]string(nil), e.art.Tags...)
	for _, t := range uv.tags[e.art.Name] {
		if !containsFold(out, t) {
			out = append(out, t)
		}
	}
	return out
}

func (e indexEntry) matches(q searchQuery, uv userView, skip string) bool {
	a := e.art
	if skip != "type" && q.Type != "" && a.Type != q.Type {
		return false
	}
	if skip != "project" && q.Project != "" && projectFacet(a) != q.Project {
		return false
	}
	if skip != "model" && q.Model != "" && a.Model != q.Model {
		return false
	}
	if skip != "tag" {
		merged := e.mergedTags(uv)
		for _, want := range q.Tags {
			if !containsFold(merged, want) {
				return false
			}
		}
	}
	if skip != "library" && q.Library != "" && !containsFold(e.libraries, q.Library) {
		return false
	}
	if skip != "warnings" && q.Warnings && len(a.Warnings) == 0 {
		return false
	}
	if skip != "favorite" && q.Favorite && !uv.favorites[a.Name] {
		return false
	}
	if skip != "collection" && q.Collection != 0 && !uv.collectionKeys[a.Name] {
		return false
	}
	if q.Q != "" {
		for _, term := range strings.Fields(strings.ToLower(q.Q)) {
			if !strings.Contains(e.haystack, term) {
				return false
			}
		}
	}
	return true
}

func (ix *searchIndex) search(q searchQuery, uv userView) searchResult {
	ix.mu.RLock()
	defer ix.mu.RUnlock()

	matched := make([]indexEntry, 0)
	for _, e := range ix.entries {
		if e.matches(q, uv, "") {
			matched = append(matched, e)
		}
	}
	sortEntries(matched, q.Sort)
	total := len(matched)

	facets := map[string]map[string]int{
		"type": {}, "project": {}, "model": {}, "library": {}, "tag": {}, "favorite": {},
	}
	for _, e := range ix.entries {
		if e.matches(q, uv, "type") {
			facets["type"][e.art.Type]++
		}
		if e.matches(q, uv, "project") {
			facets["project"][projectFacet(e.art)]++
		}
		if e.matches(q, uv, "model") && e.art.Model != "" {
			facets["model"][e.art.Model]++
		}
		if e.matches(q, uv, "library") {
			for _, l := range e.libraries {
				facets["library"][l]++
			}
		}
		if e.matches(q, uv, "tag") {
			for _, t := range e.mergedTags(uv) {
				facets["tag"][t]++
			}
		}
		if e.matches(q, uv, "favorite") && uv.favorites[e.art.Name] {
			facets["favorite"]["true"]++
		}
	}

	// page
	lo := q.Offset
	if lo < 0 || lo > len(matched) {
		lo = len(matched)
	}
	hi := len(matched)
	if q.Limit > 0 && lo+q.Limit < hi {
		hi = lo + q.Limit
	}
	docs := make([]SearchDocument, 0, hi-lo)
	for _, e := range matched[lo:hi] {
		d := buildSearchDocument(e.art)
		d.Hash = e.hash
		d.Favorite = uv.favorites[e.art.Name]
		d.Tags = e.mergedTags(uv)
		d.UserTags = append([]string(nil), uv.tags[e.art.Name]...)
		docs = append(docs, d)
	}
	return searchResult{Total: total, Results: docs, Facets: facets}
}

func sortEntries(entries []indexEntry, mode string) {
	switch mode {
	case "title":
		sort.SliceStable(entries, func(i, j int) bool {
			return strings.ToLower(entries[i].art.Title) < strings.ToLower(entries[j].art.Title)
		})
	case "size":
		sort.SliceStable(entries, func(i, j int) bool { return entries[i].art.Size > entries[j].art.Size })
	case "-size":
		sort.SliceStable(entries, func(i, j int) bool { return entries[i].art.Size < entries[j].art.Size })
	case "name":
		sort.SliceStable(entries, func(i, j int) bool { return entries[i].art.Name < entries[j].art.Name })
	default: // "recent"
		sort.SliceStable(entries, func(i, j int) bool {
			if entries[i].sortTime != entries[j].sortTime {
				return entries[i].sortTime > entries[j].sortTime
			}
			return strings.ToLower(entries[i].art.Title) < strings.ToLower(entries[j].art.Title)
		})
	}
}

func entrySortTime(a artifacts.Artifact) int64 {
	for _, ts := range []string{a.ConversationUpdatedAt, a.ConversationCreatedAt} {
		if t, err := time.Parse(time.RFC3339, ts); err == nil {
			return t.Unix()
		}
	}
	return a.ModifiedAt.Unix()
}

var bareImportRe = regexp.MustCompile(`(?m)from\s+['"]([^./][^'"]*)['"]`)

// extractLibraries returns the distinct third-party module specifiers a source
// imports (bare, non-relative, not react/react-dom). Roots like "recharts" and
// "@scope/pkg" are kept; deep paths ("d3/foo") are reduced to their package root.
func extractLibraries(source string) []string {
	seen := map[string]bool{}
	var out []string
	for _, m := range bareImportRe.FindAllStringSubmatch(source, -1) {
		spec := m[1]
		root := packageRoot(spec)
		if root == "" || root == "react" || root == "react-dom" {
			continue
		}
		if !seen[root] {
			seen[root] = true
			out = append(out, root)
		}
	}
	sort.Strings(out)
	return out
}

func packageRoot(spec string) string {
	parts := strings.Split(spec, "/")
	if strings.HasPrefix(spec, "@") && len(parts) >= 2 {
		return parts[0] + "/" + parts[1]
	}
	return parts[0]
}

func containsFold(list []string, want string) bool {
	for _, x := range list {
		if strings.EqualFold(x, want) {
			return true
		}
	}
	return false
}
