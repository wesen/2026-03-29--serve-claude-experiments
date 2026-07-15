package artifacts

import (
	"os"
	"path/filepath"
	"testing"
)

// writeExportTree builds a minimal conversation-export layout under root.
func writeExportTree(t *testing.T, root, uuid, name, jsxBody string, withManifestTitle string) string {
	t.Helper()
	convDir := filepath.Join(root, uuid)
	artDir := filepath.Join(convDir, "artifacts")
	if err := os.MkdirAll(artDir, 0o755); err != nil {
		t.Fatal(err)
	}
	meta := `{"uuid":"` + uuid + `","name":"` + name + `","model":"claude-opus-4-8",` +
		`"created_at":"2026-07-06T16:49:56Z","updated_at":"2026-07-06T17:03:21Z",` +
		`"project_uuid":"proj-1","artifacts":[{"file":"artifacts/Widget.jsx"}],"warnings":["w1"]}`
	writeFile(t, filepath.Join(convDir, "meta.json"), meta)
	writeFile(t, filepath.Join(convDir, "conversation.md"), "# transcript")
	writeFile(t, filepath.Join(artDir, "Widget.jsx"), jsxBody)
	if withManifestTitle != "" {
		writeFile(t, filepath.Join(artDir, "Widget.manifest.json"), `{"title":"`+withManifestTitle+`"}`)
	}
	return convDir
}

func TestIngestExportMeta(t *testing.T) {
	root := t.TempDir()
	writeExportTree(t, root, "uuid-abc", "Minimal timezone-aware calendar",
		"export default function Widget(){ return <div/>; }", "")

	arts, err := NewScanner(root).Scan()
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(arts) != 1 {
		t.Fatalf("expected 1 artifact, got %d", len(arts))
	}
	a := arts[0]
	if !a.FromExport {
		t.Fatal("FromExport should be true")
	}
	if a.Title != "Minimal timezone-aware calendar" {
		t.Fatalf("Title should come from conversation name, got %q", a.Title)
	}
	if a.Project != "proj-1" || a.Model != "claude-opus-4-8" {
		t.Fatalf("project/model not ingested: %+v", a)
	}
	if a.SourceConversationUUID != "uuid-abc" || a.ClaudeURL != "https://claude.ai/chat/uuid-abc" {
		t.Fatalf("uuid/url wrong: %+v", a)
	}
	if a.OriginalDate != "2026-07-06" {
		t.Fatalf("OriginalDate should derive from created_at, got %q", a.OriginalDate)
	}
	if len(a.Warnings) != 1 || a.Warnings[0] != "w1" {
		t.Fatalf("warnings not propagated: %+v", a.Warnings)
	}
	if a.TranscriptPath == "" {
		t.Fatal("TranscriptPath should be set when conversation.md exists")
	}
}

func TestManifestTitleWinsOverConversationName(t *testing.T) {
	root := t.TempDir()
	writeExportTree(t, root, "uuid-xyz", "Conversation Name",
		"export default function Widget(){ return <div/>; }", "Manifest Title")
	arts, err := NewScanner(root).Scan()
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if arts[0].Title != "Manifest Title" {
		t.Fatalf("manifest title must win, got %q", arts[0].Title)
	}
	// provenance still ingested
	if arts[0].SourceConversationTitle != "Conversation Name" {
		t.Fatalf("provenance should still be ingested, got %q", arts[0].SourceConversationTitle)
	}
}

func TestNoMetaKeepsDerivedTitle(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "loose.jsx"), "export default function LooseThing(){ return <div/>; }")
	arts, err := NewScanner(root).Scan()
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if arts[0].Title != "LooseThing" || arts[0].FromExport {
		t.Fatalf("non-export artifact should keep derived title and FromExport=false: %+v", arts[0])
	}
}
