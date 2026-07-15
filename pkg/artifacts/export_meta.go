package artifacts

import (
	"encoding/json"
	"os"
	"strings"
)

// exportMeta mirrors the meta.json a Claude conversation export writes next to an
// artifacts/ directory (see the surf-cli `claude export` verb).
type exportMeta struct {
	UUID        string               `json:"uuid"`
	Name        string               `json:"name"`
	Model       string               `json:"model"`
	CreatedAt   string               `json:"created_at"`
	UpdatedAt   string               `json:"updated_at"`
	ProjectUUID string               `json:"project_uuid"`
	Artifacts   []exportMetaArtifact `json:"artifacts"`
	Warnings    []string             `json:"warnings"`
}

type exportMetaArtifact struct {
	File   string `json:"file"`
	Path   string `json:"path"`
	Bytes  int64  `json:"bytes"`
	Source string `json:"source"`
}

// loadExportMeta parses a conversation export's meta.json. Unknown fields are
// tolerated (the exporter may add fields over time).
func loadExportMeta(path string) (*exportMeta, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m exportMeta
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// dateOnly returns the YYYY-MM-DD prefix of an RFC3339-ish timestamp.
func dateOnly(ts string) string {
	if len(ts) >= 10 && strings.Count(ts[:10], "-") == 2 {
		return ts[:10]
	}
	return ""
}
