package server

import (
	"strings"
	"time"
)

// parsedQuery is the result of parsing the search box's mini query language:
// field filters (tag:, model:, type:, project:, library:, is:favorite,
// has:warnings, after:/before: dates) plus the leftover free-text terms.
type parsedQuery struct {
	Text     string   // remaining bare terms, space-joined (full-text search)
	Tags     []string // tag:foo (repeatable)
	Type     string   // type:jsx|html
	Model    string   // model:claude-...
	Project  string   // project:...
	Library  string   // library:recharts
	Favorite bool     // is:favorite
	Warnings bool     // has:warnings
	After    string   // after:/since: YYYY-MM-DD
	Before   string   // before:/until: YYYY-MM-DD
}

// parseSearchSyntax parses the query string. Recognized "key:value" tokens become
// structured filters; everything else is free text. Values may be quoted to
// include spaces (e.g. tag:"multi word"). Unknown keys are left as free text, so
// ordinary terms that contain a colon (URLs, code) are not swallowed.
func parseSearchSyntax(raw string) parsedQuery {
	var pq parsedQuery
	var free []string
	for _, tok := range tokenizeQuery(raw) {
		key, val, ok := splitField(tok)
		if !ok {
			free = append(free, tok)
			continue
		}
		switch key {
		case "tag", "tags":
			pq.Tags = append(pq.Tags, val)
		case "type":
			pq.Type = val
		case "model":
			pq.Model = val
		case "project", "proj":
			pq.Project = val
		case "library", "lib":
			pq.Library = val
		case "after", "since":
			pq.After = val
		case "before", "until":
			pq.Before = val
		case "is":
			switch strings.ToLower(val) {
			case "favorite", "favorited", "fav", "starred":
				pq.Favorite = true
			default:
				free = append(free, tok)
			}
		case "has":
			switch strings.ToLower(val) {
			case "warnings", "warning", "warn":
				pq.Warnings = true
			default:
				free = append(free, tok)
			}
		default:
			free = append(free, tok) // unknown field → literal text
		}
	}
	pq.Text = strings.Join(free, " ")
	return pq
}

// tokenizeQuery splits on whitespace but keeps double-quoted spans together, so
// tag:"multi word" and "multi word" are single tokens (quotes are removed).
func tokenizeQuery(s string) []string {
	var toks []string
	var cur strings.Builder
	inQuote := false
	flush := func() {
		if cur.Len() > 0 {
			toks = append(toks, cur.String())
			cur.Reset()
		}
	}
	for _, r := range s {
		switch {
		case r == '"':
			inQuote = !inQuote
		case (r == ' ' || r == '\t' || r == '\n') && !inQuote:
			flush()
		default:
			cur.WriteRune(r)
		}
	}
	flush()
	return toks
}

// splitField splits a "key:value" token. It reports ok=false when there is no
// colon, the token starts with a colon, or the value is empty.
func splitField(tok string) (key, val string, ok bool) {
	i := strings.IndexByte(tok, ':')
	if i <= 0 || i == len(tok)-1 {
		return "", "", false
	}
	return strings.ToLower(tok[:i]), tok[i+1:], true
}

// parseDateBound parses YYYY-MM-DD (or an RFC3339 timestamp) into a unix bound.
// For an upper bound, endOfDay pushes the date to 23:59:59 so before:2026-07-01
// includes all of that day. Returns 0 (no bound) for empty or unparseable input.
func parseDateBound(s string, endOfDay bool) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		if endOfDay {
			t = t.Add(24*time.Hour - time.Second)
		}
		return t.Unix()
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.Unix()
	}
	return 0
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// dedupeFold removes empty and case-insensitively duplicate strings, preserving
// first-seen order.
func dedupeFold(in []string) []string {
	var out []string
	for _, s := range in {
		if s != "" && !containsFold(out, s) {
			out = append(out, s)
		}
	}
	return out
}
