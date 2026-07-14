package server

import (
	"reflect"
	"testing"
	"time"
)

func TestParseSearchSyntax(t *testing.T) {
	pq := parseSearchSyntax(`tag:eink tag:"multi word" model:claude-fable-5 type:jsx is:favorite has:warnings before:2026-07-01 after:2026-06-01 hello world`)
	if pq.Text != "hello world" {
		t.Fatalf("Text = %q, want %q", pq.Text, "hello world")
	}
	if !reflect.DeepEqual(pq.Tags, []string{"eink", "multi word"}) {
		t.Fatalf("Tags = %v", pq.Tags)
	}
	if pq.Model != "claude-fable-5" || pq.Type != "jsx" {
		t.Fatalf("Model/Type = %q/%q", pq.Model, pq.Type)
	}
	if !pq.Favorite || !pq.Warnings {
		t.Fatalf("Favorite/Warnings = %v/%v", pq.Favorite, pq.Warnings)
	}
	if pq.Before != "2026-07-01" || pq.After != "2026-06-01" {
		t.Fatalf("date bounds = %q / %q", pq.Before, pq.After)
	}
}

func TestParseSearchSyntaxLeavesUnknownAndColonTermsAsText(t *testing.T) {
	// Unknown keys and URLs are free text, not swallowed as filters.
	pq := parseSearchSyntax(`https://example.com foo:bar plain`)
	if pq.Text != "https://example.com foo:bar plain" {
		t.Fatalf("Text = %q", pq.Text)
	}
	if len(pq.Tags) != 0 || pq.Model != "" {
		t.Fatalf("unexpected fields parsed: %+v", pq)
	}
	// is:something-unknown stays as text, too.
	if got := parseSearchSyntax(`is:banana`).Text; got != "is:banana" {
		t.Fatalf("is:banana Text = %q", got)
	}
}

func TestParseDateBound(t *testing.T) {
	lo := parseDateBound("2026-06-01", false)
	hi := parseDateBound("2026-06-01", true)
	if lo == 0 || hi == 0 {
		t.Fatal("expected non-zero bounds")
	}
	// endOfDay is 23:59:59 later than start of day.
	if hi-lo != int64((24*time.Hour-time.Second)/time.Second) {
		t.Fatalf("endOfDay delta = %d", hi-lo)
	}
	if parseDateBound("not-a-date", false) != 0 {
		t.Fatal("garbage date should yield 0")
	}
}

func TestDedupeFold(t *testing.T) {
	got := dedupeFold([]string{"eink", "", "EINK", "demo", "Demo"})
	if !reflect.DeepEqual(got, []string{"eink", "demo"}) {
		t.Fatalf("dedupeFold = %v", got)
	}
}
