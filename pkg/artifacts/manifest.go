package artifacts

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
)

const manifestSuffix = ".manifest.json"

type ArtifactLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type ArtifactManifest struct {
	Title        string         `json:"title"`
	Description  string         `json:"description"`
	Tags         []string       `json:"tags"`
	OriginalDate string         `json:"original_date"`
	Links        []ArtifactLink `json:"links"`
}

func isManifestFile(name string) bool {
	return strings.HasSuffix(name, manifestSuffix)
}

func loadManifest(path string) (*ArtifactManifest, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("opening manifest: %w", err)
	}
	defer f.Close()

	var manifest ArtifactManifest
	dec := json.NewDecoder(f)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&manifest); err != nil {
		return nil, fmt.Errorf("decoding manifest: %w", err)
	}
	if dec.More() {
		return nil, fmt.Errorf("decoding manifest: unexpected trailing JSON content")
	}
	if err := validateManifest(&manifest); err != nil {
		return nil, err
	}
	return &manifest, nil
}

func validateManifest(m *ArtifactManifest) error {
	if strings.TrimSpace(m.Title) == "" && m.Title != "" {
		return fmt.Errorf("validating manifest: title must not be blank")
	}

	normalizedTags := make([]string, 0, len(m.Tags))
	for _, tag := range m.Tags {
		trimmed := strings.TrimSpace(tag)
		if trimmed == "" {
			return fmt.Errorf("validating manifest: tags must not contain blank values")
		}
		normalizedTags = append(normalizedTags, trimmed)
	}
	m.Tags = normalizedTags

	if m.OriginalDate != "" {
		if _, err := time.Parse("2006-01-02", m.OriginalDate); err != nil {
			return fmt.Errorf("validating manifest: original_date must use YYYY-MM-DD: %w", err)
		}
	}

	for i, link := range m.Links {
		if strings.TrimSpace(link.Label) == "" {
			return fmt.Errorf("validating manifest: links[%d].label must not be blank", i)
		}
		if strings.TrimSpace(link.URL) == "" {
			return fmt.Errorf("validating manifest: links[%d].url must not be blank", i)
		}
		u, err := url.Parse(link.URL)
		if err != nil {
			return fmt.Errorf("validating manifest: links[%d].url parse error: %w", i, err)
		}
		if u.Scheme != "http" && u.Scheme != "https" {
			return fmt.Errorf("validating manifest: links[%d].url must use http or https", i)
		}
		m.Links[i].Label = strings.TrimSpace(link.Label)
		m.Links[i].URL = strings.TrimSpace(link.URL)
	}

	m.Title = strings.TrimSpace(m.Title)
	m.Description = strings.TrimSpace(m.Description)

	return nil
}

func applyManifest(a *Artifact, m *ArtifactManifest) {
	if m.Title != "" {
		a.Title = m.Title
	}
	a.Description = m.Description
	a.Tags = append([]string(nil), m.Tags...)
	a.OriginalDate = m.OriginalDate
	a.Links = append([]ArtifactLink(nil), m.Links...)
}
