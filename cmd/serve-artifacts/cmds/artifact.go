package cmds

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-go-golems/glazed/pkg/cli"
	"github.com/go-go-golems/glazed/pkg/cmds"
	"github.com/go-go-golems/glazed/pkg/cmds/fields"
	"github.com/go-go-golems/glazed/pkg/cmds/schema"
	"github.com/go-go-golems/glazed/pkg/cmds/values"
	"github.com/go-go-golems/glazed/pkg/middlewares"
	"github.com/go-go-golems/glazed/pkg/settings"
	"github.com/go-go-golems/glazed/pkg/types"
	"github.com/spf13/cobra"
)

// apiFlags are the connection flags every artifact verb shares.
func apiFlags() []*fields.Definition {
	return []*fields.Definition{
		fields.New("api", fields.TypeString, fields.WithDefault(""),
			fields.WithHelp("Server base URL (default $SERVE_ARTIFACTS_API or http://localhost:8080)")),
		fields.New("token", fields.TypeString, fields.WithDefault(""),
			fields.WithHelp("Bearer token for write access (default $SERVE_ARTIFACTS_TOKEN)")),
	}
}

// apiConn is the decoded connection settings shared by all verbs.
type apiConn struct {
	API   string `glazed:"api"`
	Token string `glazed:"token"`
}

// artifactPath builds a /api/... path for an artifact name, escaping each segment
// while preserving the slashes that separate nested-name components.
func artifactPath(prefix, name string) string {
	segs := strings.Split(name, "/")
	for i, s := range segs {
		segs[i] = url.PathEscape(s)
	}
	return prefix + strings.Join(segs, "/")
}

// NewArtifactCobraCommand assembles the `artifact` command group (list, get,
// source, set-meta, push) with each child wired to Cobra via Glazed.
func NewArtifactCobraCommand() (*cobra.Command, error) {
	parent := &cobra.Command{
		Use:   "artifact",
		Short: "Manage artifacts via a running serve-artifacts API",
		Long: `Talk to a running serve-artifacts server's HTTP API to list, view, modify,
and push artifacts. Set the server with --api or $SERVE_ARTIFACTS_API.`,
	}

	builders := []func() (cmds.Command, error){
		func() (cmds.Command, error) { return NewArtifactListCommand() },
		func() (cmds.Command, error) { return NewArtifactGetCommand() },
		func() (cmds.Command, error) { return NewArtifactSourceCommand() },
		func() (cmds.Command, error) { return NewArtifactSetMetaCommand() },
		func() (cmds.Command, error) { return NewArtifactPushCommand() },
	}
	for _, b := range builders {
		c, err := b()
		if err != nil {
			return nil, err
		}
		cc, err := cli.BuildCobraCommand(c, cli.WithParserConfig(cli.CobraParserConfig{AppName: "serve-artifacts"}))
		if err != nil {
			return nil, err
		}
		parent.AddCommand(cc)
	}
	return parent, nil
}

// ---- artifact list -------------------------------------------------------

type ArtifactListCommand struct{ *cmds.CommandDescription }

var _ cmds.GlazeCommand = (*ArtifactListCommand)(nil)

type artifactListSettings struct {
	apiConn
	Query string `glazed:"query"`
	Type  string `glazed:"type"`
	Tag   string `glazed:"tag"`
	Limit int    `glazed:"limit"`
}

func NewArtifactListCommand() (*ArtifactListCommand, error) {
	glazedSection, err := settings.NewGlazedSchema()
	if err != nil {
		return nil, err
	}
	flags := append(apiFlags(),
		fields.New("query", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Full-text query (same syntax as the search box)")),
		fields.New("type", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Filter by type (html, jsx)")),
		fields.New("tag", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Filter by tag")),
		fields.New("limit", fields.TypeInteger, fields.WithDefault(200), fields.WithHelp("Maximum results")),
	)
	return &ArtifactListCommand{cmds.NewCommandDescription("list",
		cmds.WithShort("List artifacts from a running server"),
		cmds.WithFlags(flags...),
		cmds.WithSections(glazedSection),
	)}, nil
}

func (c *ArtifactListCommand) RunIntoGlazeProcessor(ctx context.Context, vals *values.Values, gp middlewares.Processor) error {
	s := &artifactListSettings{}
	if err := vals.DecodeSectionInto(schema.DefaultSlug, s); err != nil {
		return err
	}
	client := newAPIClient(s.API, s.Token)

	q := url.Values{}
	if s.Query != "" {
		q.Set("q", s.Query)
	}
	if s.Type != "" {
		q.Set("type", s.Type)
	}
	if s.Tag != "" {
		q.Set("tag", s.Tag)
	}
	q.Set("limit", strconv.Itoa(s.Limit))

	var out struct {
		Total   int              `json:"total"`
		Results []map[string]any `json:"results"`
	}
	if err := client.getJSON(ctx, "/api/artifacts?"+q.Encode(), &out); err != nil {
		return err
	}
	for _, r := range out.Results {
		row := types.NewRow(
			types.MRP("name", r["name"]),
			types.MRP("type", r["type"]),
			types.MRP("title", r["title"]),
			types.MRP("tags", joinAny(r["tags"])),
			types.MRP("model", r["model"]),
			types.MRP("project", r["project"]),
			types.MRP("date", r["original_date"]),
		)
		if err := gp.AddRow(ctx, row); err != nil {
			return err
		}
	}
	return nil
}

// ---- artifact get --------------------------------------------------------

type ArtifactGetCommand struct{ *cmds.CommandDescription }

var _ cmds.GlazeCommand = (*ArtifactGetCommand)(nil)

type artifactGetSettings struct {
	apiConn
	Name string `glazed:"name"`
}

func NewArtifactGetCommand() (*ArtifactGetCommand, error) {
	glazedSection, err := settings.NewGlazedSchema()
	if err != nil {
		return nil, err
	}
	flags := append(apiFlags(),
		fields.New("name", fields.TypeString, fields.WithRequired(true), fields.WithHelp("Artifact name (slash path without extension)")),
	)
	return &ArtifactGetCommand{cmds.NewCommandDescription("get",
		cmds.WithShort("Show one artifact's metadata"),
		cmds.WithFlags(flags...),
		cmds.WithSections(glazedSection),
	)}, nil
}

func (c *ArtifactGetCommand) RunIntoGlazeProcessor(ctx context.Context, vals *values.Values, gp middlewares.Processor) error {
	s := &artifactGetSettings{}
	if err := vals.DecodeSectionInto(schema.DefaultSlug, s); err != nil {
		return err
	}
	client := newAPIClient(s.API, s.Token)

	var out struct {
		Artifact  map[string]any `json:"artifact"`
		Project   string         `json:"project"`
		CreatedAt string         `json:"created_at"`
		ClaudeURL string         `json:"claude_url"`
	}
	if err := client.getJSON(ctx, artifactPath("/api/artifact/", s.Name), &out); err != nil {
		return err
	}
	a := out.Artifact
	row := types.NewRow(
		types.MRP("name", a["name"]),
		types.MRP("type", a["type"]),
		types.MRP("title", a["title"]),
		types.MRP("description", a["description"]),
		types.MRP("tags", joinAny(a["tags"])),
		types.MRP("model", a["model"]),
		types.MRP("project", out.Project),
		types.MRP("date", a["original_date"]),
		types.MRP("claude_url", out.ClaudeURL),
	)
	return gp.AddRow(ctx, row)
}

// ---- artifact source -----------------------------------------------------

type ArtifactSourceCommand struct{ *cmds.CommandDescription }

var _ cmds.WriterCommand = (*ArtifactSourceCommand)(nil)

type artifactSourceSettings struct {
	apiConn
	Name string `glazed:"name"`
}

func NewArtifactSourceCommand() (*ArtifactSourceCommand, error) {
	flags := append(apiFlags(),
		fields.New("name", fields.TypeString, fields.WithRequired(true), fields.WithHelp("Artifact name (slash path without extension)")),
	)
	return &ArtifactSourceCommand{cmds.NewCommandDescription("source",
		cmds.WithShort("Print an artifact's raw source to stdout"),
		cmds.WithFlags(flags...),
	)}, nil
}

func (c *ArtifactSourceCommand) RunIntoWriter(ctx context.Context, vals *values.Values, w io.Writer) error {
	s := &artifactSourceSettings{}
	if err := vals.DecodeSectionInto(schema.DefaultSlug, s); err != nil {
		return err
	}
	client := newAPIClient(s.API, s.Token)
	resp, err := client.do(ctx, "GET", artifactPath("/api/source/", s.Name), nil, "")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("%s: %s", resp.Status, serverErrorMessage(resp.Body))
	}
	_, err = io.Copy(w, resp.Body)
	return err
}

// ---- artifact set-meta ---------------------------------------------------

type ArtifactSetMetaCommand struct{ *cmds.CommandDescription }

var _ cmds.WriterCommand = (*ArtifactSetMetaCommand)(nil)

type artifactSetMetaSettings struct {
	apiConn
	Name        string   `glazed:"name"`
	Title       string   `glazed:"title"`
	Description string   `glazed:"description"`
	Tags        []string `glazed:"tag"`
	Date        string   `glazed:"date"`
	Replace     bool     `glazed:"replace"`
}

func NewArtifactSetMetaCommand() (*ArtifactSetMetaCommand, error) {
	flags := append(apiFlags(),
		fields.New("name", fields.TypeString, fields.WithRequired(true), fields.WithHelp("Artifact name (slash path without extension)")),
		fields.New("title", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Set the title")),
		fields.New("description", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Set the description")),
		fields.New("tag", fields.TypeStringList, fields.WithDefault([]string{}), fields.WithHelp("Set tags (repeatable)")),
		fields.New("date", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Set original date (YYYY-MM-DD)")),
		fields.New("replace", fields.TypeBool, fields.WithDefault(false), fields.WithHelp("Replace the whole manifest (PUT) instead of merging (PATCH)")),
	)
	return &ArtifactSetMetaCommand{cmds.NewCommandDescription("set-meta",
		cmds.WithShort("Modify an artifact's metadata manifest"),
		cmds.WithLong(`Modify an artifact's metadata by writing its manifest sidecar.

By default only the fields you pass are changed (a PATCH merge); unset fields are
left as they are. With --replace the whole manifest is replaced (a PUT), so any
field you do not pass is cleared.`),
		cmds.WithFlags(flags...),
	)}, nil
}

func (c *ArtifactSetMetaCommand) RunIntoWriter(ctx context.Context, vals *values.Values, w io.Writer) error {
	s := &artifactSetMetaSettings{}
	if err := vals.DecodeSectionInto(schema.DefaultSlug, s); err != nil {
		return err
	}
	client := newAPIClient(s.API, s.Token)

	// Merge (PATCH): send only the fields the user provided. Replace (PUT): send
	// every field, so omissions clear.
	m := map[string]any{}
	if s.Replace || s.Title != "" {
		m["title"] = s.Title
	}
	if s.Replace || s.Description != "" {
		m["description"] = s.Description
	}
	if s.Replace || len(s.Tags) > 0 {
		m["tags"] = s.Tags
	}
	if s.Replace || s.Date != "" {
		m["original_date"] = s.Date
	}

	method := "PATCH"
	if s.Replace {
		method = "PUT"
	}
	var out struct {
		Artifact map[string]any `json:"artifact"`
	}
	if err := client.sendJSON(ctx, method, artifactPath("/api/manifest/", s.Name), m, &out); err != nil {
		return err
	}
	fmt.Fprintf(w, "updated %s\n  title: %v\n  tags:  %s\n", s.Name, out.Artifact["title"], joinAny(out.Artifact["tags"]))
	return nil
}

// ---- artifact push -------------------------------------------------------

type ArtifactPushCommand struct{ *cmds.CommandDescription }

var _ cmds.WriterCommand = (*ArtifactPushCommand)(nil)

type artifactPushSettings struct {
	apiConn
	File        string   `glazed:"file"`
	Name        string   `glazed:"name"`
	Type        string   `glazed:"type"`
	Title       string   `glazed:"title"`
	Description string   `glazed:"description"`
	Tags        []string `glazed:"tag"`
	Date        string   `glazed:"date"`
	Overwrite   bool     `glazed:"overwrite"`
}

func NewArtifactPushCommand() (*ArtifactPushCommand, error) {
	flags := append(apiFlags(),
		fields.New("file", fields.TypeString, fields.WithRequired(true), fields.WithHelp("Path to the artifact source file (.html or .jsx)")),
		fields.New("name", fields.TypeString, fields.WithRequired(true), fields.WithHelp("Target artifact name (slash path without extension)")),
		fields.New("type", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Artifact type (html|jsx); inferred from the file extension if empty")),
		fields.New("title", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Seed the manifest title")),
		fields.New("description", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Seed the manifest description")),
		fields.New("tag", fields.TypeStringList, fields.WithDefault([]string{}), fields.WithHelp("Seed manifest tags (repeatable)")),
		fields.New("date", fields.TypeString, fields.WithDefault(""), fields.WithHelp("Seed the manifest original date (YYYY-MM-DD)")),
		fields.New("overwrite", fields.TypeBool, fields.WithDefault(false), fields.WithHelp("Overwrite an existing artifact of the same name")),
	)
	return &ArtifactPushCommand{cmds.NewCommandDescription("push",
		cmds.WithShort("Push a new artifact to the server"),
		cmds.WithFlags(flags...),
	)}, nil
}

func (c *ArtifactPushCommand) RunIntoWriter(ctx context.Context, vals *values.Values, w io.Writer) error {
	s := &artifactPushSettings{}
	if err := vals.DecodeSectionInto(schema.DefaultSlug, s); err != nil {
		return err
	}
	client := newAPIClient(s.API, s.Token)

	src, err := os.ReadFile(s.File)
	if err != nil {
		return fmt.Errorf("reading source file: %w", err)
	}
	typ := s.Type
	if typ == "" {
		switch strings.ToLower(filepath.Ext(s.File)) {
		case ".html", ".htm":
			typ = "html"
		case ".jsx":
			typ = "jsx"
		default:
			return fmt.Errorf("cannot infer type from %q; pass --type html|jsx", s.File)
		}
	}

	body := map[string]any{
		"name":      s.Name,
		"type":      typ,
		"source":    string(src),
		"overwrite": s.Overwrite,
	}
	if man := seedManifest(s.Title, s.Description, s.Tags, s.Date); man != nil {
		body["manifest"] = man
	}

	var out struct {
		Artifact map[string]any `json:"artifact"`
	}
	if err := client.sendJSON(ctx, "POST", "/api/artifacts", body, &out); err != nil {
		return err
	}
	fmt.Fprintf(w, "created %s (%s)\n  view: %v\n", s.Name, typ, out.Artifact["view_url"])
	return nil
}

// seedManifest builds an optional manifest object from the push metadata flags,
// returning nil when none were set (so no sidecar is written).
func seedManifest(title, desc string, tags []string, date string) map[string]any {
	if title == "" && desc == "" && len(tags) == 0 && date == "" {
		return nil
	}
	m := map[string]any{}
	if title != "" {
		m["title"] = title
	}
	if desc != "" {
		m["description"] = desc
	}
	if len(tags) > 0 {
		m["tags"] = tags
	}
	if date != "" {
		m["original_date"] = date
	}
	return m
}

// joinAny renders a JSON value that may be a []any of strings (tags) as a
// comma-separated string for tabular/text output.
func joinAny(v any) string {
	switch t := v.(type) {
	case []any:
		parts := make([]string, 0, len(t))
		for _, x := range t {
			parts = append(parts, fmt.Sprint(x))
		}
		return strings.Join(parts, ", ")
	case []string:
		return strings.Join(t, ", ")
	case nil:
		return ""
	default:
		return fmt.Sprint(v)
	}
}
