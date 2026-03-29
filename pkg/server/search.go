package server

import (
	"strings"

	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
)

type SearchDocument struct {
	Name         string   `json:"name"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Tags         []string `json:"tags"`
	OriginalDate string   `json:"original_date"`
	Filename     string   `json:"filename"`
	Type         string   `json:"type"`
	ViewURL      string   `json:"view_url"`
	SearchText   string   `json:"search_text"`
}

func buildSearchDocuments(arts []artifacts.Artifact) []SearchDocument {
	docs := make([]SearchDocument, 0, len(arts))
	for _, a := range arts {
		docs = append(docs, SearchDocument{
			Name:         a.Name,
			Title:        a.Title,
			Description:  a.Description,
			Tags:         append([]string(nil), a.Tags...),
			OriginalDate: a.OriginalDate,
			Filename:     a.Filename,
			Type:         a.Type,
			ViewURL:      "/view/" + a.Name,
			SearchText:   buildSearchText(a),
		})
	}
	return docs
}

func buildSearchText(a artifacts.Artifact) string {
	parts := []string{a.Name, a.Title, a.Description, a.Filename, a.Type, a.OriginalDate}
	parts = append(parts, a.Tags...)
	return strings.ToLower(strings.Join(parts, " "))
}
