package cmds

import (
	"context"

	"github.com/go-go-golems/glazed/pkg/cmds"
	"github.com/go-go-golems/glazed/pkg/cmds/fields"
	"github.com/go-go-golems/glazed/pkg/cmds/schema"
	"github.com/go-go-golems/glazed/pkg/cmds/values"
	"github.com/go-go-golems/glazed/pkg/middlewares"
	"github.com/go-go-golems/glazed/pkg/settings"
	"github.com/go-go-golems/glazed/pkg/types"
	"github.com/go-go-golems/serve-artifacts/pkg/artifacts"
)

type ListCommand struct {
	*cmds.CommandDescription
}

type ListSettings struct {
	Dir        string `glazed:"dir"`
	FilterType string `glazed:"type"`
}

func NewListCommand() (*ListCommand, error) {
	glazedSection, err := settings.NewGlazedSchema()
	if err != nil {
		return nil, err
	}

	return &ListCommand{
		CommandDescription: cmds.NewCommandDescription(
			"list",
			cmds.WithShort("List all artifacts in a directory"),
			cmds.WithLong(`List all Claude.ai artifacts found in a directory.

Outputs artifact metadata as structured data (table, JSON, YAML, CSV, etc.).

Examples:
  serve-artifacts list --dir ./imports
  serve-artifacts list --dir ./imports --output json
  serve-artifacts list --dir ./imports --type jsx
  serve-artifacts list --dir ./imports --fields name,type,title`),
			cmds.WithFlags(
				fields.New("dir", fields.TypeString,
					fields.WithDefault("."),
					fields.WithHelp("Directory containing artifacts"),
				),
				fields.New("type", fields.TypeString,
					fields.WithDefault(""),
					fields.WithHelp("Filter by type (html, jsx)"),
				),
			),
			cmds.WithSections(glazedSection),
		),
	}, nil
}

func (c *ListCommand) RunIntoGlazeProcessor(
	ctx context.Context,
	vals *values.Values,
	gp middlewares.Processor,
) error {
	s := &ListSettings{}
	if err := vals.DecodeSectionInto(schema.DefaultSlug, s); err != nil {
		return err
	}

	scanner := artifacts.NewScanner(s.Dir)
	arts, err := scanner.Scan()
	if err != nil {
		return err
	}

	for _, a := range arts {
		if s.FilterType != "" && a.Type != s.FilterType {
			continue
		}
		row := types.NewRow(
			types.MRP("name", a.Name),
			types.MRP("filename", a.Filename),
			types.MRP("type", a.Type),
			types.MRP("title", a.Title),
			types.MRP("size", a.Size),
			types.MRP("modified", a.ModifiedAt),
		)
		if err := gp.AddRow(ctx, row); err != nil {
			return err
		}
	}
	return nil
}
