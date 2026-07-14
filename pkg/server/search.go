package server

import (
	"strings"

	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
)

type SearchDocument struct {
	Name          string   `json:"name"`
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Tags          []string `json:"tags"`
	OriginalDate  string   `json:"original_date"`
	Filename      string   `json:"filename"`
	Type          string   `json:"type"`
	ViewURL       string   `json:"view_url"`
	SearchText    string   `json:"search_text"`
	Project       string   `json:"project,omitempty"`
	Model         string   `json:"model,omitempty"`
	SourceUUID    string   `json:"source_uuid,omitempty"`
	UpdatedAt     string   `json:"updated_at,omitempty"`
	WarningsCount int      `json:"warnings_count"`
	Favorite      bool     `json:"favorite"`
	UserTags      []string `json:"user_tags,omitempty"`
	Hash          string   `json:"hash,omitempty"`      // content hash; the thumbnail cache key
	RenderOK      *bool    `json:"render_ok,omitempty"` // nil = not yet rendered; set from thumbnail render status
}

func buildSearchDocument(a artifacts.Artifact) SearchDocument {
	return SearchDocument{
		Name:          a.Name,
		Title:         a.Title,
		Description:   a.Description,
		Tags:          append([]string(nil), a.Tags...),
		OriginalDate:  a.OriginalDate,
		Filename:      a.Filename,
		Type:          a.Type,
		ViewURL:       "/view/" + a.Name,
		SearchText:    buildSearchText(a),
		Project:       a.Project,
		Model:         a.Model,
		SourceUUID:    a.SourceConversationUUID,
		UpdatedAt:     a.ConversationUpdatedAt,
		WarningsCount: len(a.Warnings),
	}
}

func buildSearchDocuments(arts []artifacts.Artifact) []SearchDocument {
	docs := make([]SearchDocument, 0, len(arts))
	for _, a := range arts {
		docs = append(docs, buildSearchDocument(a))
	}
	return docs
}

func buildSearchText(a artifacts.Artifact) string {
	parts := []string{a.Name, a.Title, a.Description, a.Filename, a.Type, a.OriginalDate,
		a.SourceConversationTitle, a.Project, a.Model}
	parts = append(parts, a.Tags...)
	return strings.ToLower(strings.Join(parts, " "))
}
