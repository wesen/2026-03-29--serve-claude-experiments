---
Title: Per-App Manifest JSON Design and Implementation Guide
Ticket: APP-MANIFESTS
Status: active
Topics:
    - artifacts
    - golang
    - web-server
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: README.md
      Note: User-facing project overview that should be updated once manifest support ships
    - Path: cmd/serve-artifacts/cmds/list.go
      Note: Current structured output path that should expose manifest metadata
    - Path: cmd/serve-artifacts/doc/adding-artifacts.md
      Note: Help page that should document companion manifest files
    - Path: pkg/artifacts/scanner.go
      Note: Current artifact discovery and title extraction logic that needs manifest loading
    - Path: pkg/server/server.go
      Note: Server handlers that currently pass only basic artifact metadata to templates
    - Path: pkg/server/templates/index.html
      Note: |-
        Index UI that should display manifest-driven descriptions, tags, and dates
        Index UI that should display manifest-driven descriptions tags and dates
    - Path: pkg/server/templates/jsx-host.html
      Note: JSX host template already uses the artifact title and should benefit from manifest title precedence
ExternalSources: []
Summary: Detailed implementation guide for adding companion manifest JSON files per artifact, including schema, scanner changes, presentation updates, and testing strategy.
LastUpdated: 2026-03-29T09:55:53.178082505-04:00
WhatFor: Guiding implementation of richer artifact metadata via manifest files
WhenToUse: When implementing, reviewing, or extending per-app manifest support
---


# Per-App Manifest JSON Design and Implementation Guide

## Executive Summary

The current artifact server knows very little about each app. It can derive a title from an HTML `<title>` tag or from the default export name in a JSX file, but it has no place to store richer metadata such as tags, a human-written description, the original creation date, or links back to the source conversation. This design adds an optional companion file for each artifact named `<artifact-base>.manifest.json`.

The manifest becomes the canonical source for richer app metadata. The scanner remains backward-compatible: artifacts without manifests still work exactly as they do today. When a manifest is present, its `title` overrides the derived title for list/index presentation, and additional fields become available to the CLI and templates.

The recommended first implementation includes:
- A stable on-disk manifest naming convention
- A validated JSON schema for `title`, `description`, `tags`, `original_date`, and `links`
- Scanner support for loading companion manifests
- Extended `Artifact` fields so the rest of the app can consume manifest metadata naturally
- List command output additions
- Index page enhancements
- Tests and docs for missing, malformed, and partial manifests

## Problem Statement

The server currently treats each artifact as just a file with a filename, type, size, modification timestamp, and derived title. That is enough for the minimal browser experience, but it breaks down once the imports directory contains many artifacts.

The missing metadata problems are concrete:

1. Titles derived from JSX source are often generic, such as `App`, which is a poor label in the index.
2. There is no place to attach a useful description explaining what the artifact actually is.
3. Tags cannot be stored, so filtering and future grouping are impossible without inventing naming conventions.
4. The file modification time is not the same thing as the artifact’s original creation date.
5. Links back to the original Claude conversation or other references cannot be represented.

This gap matters more now that the imports set is growing. The ticket `IMPORT-CLAUDE-DEMOS` added many more artifacts, and several of them would benefit immediately from human-authored metadata. If this metadata is not modeled explicitly, the repo will drift toward filename-based organization and poor discoverability.

### Requirements

The new manifest layer should satisfy the following requirements:

- Be optional. Existing artifact files without manifests must continue to work.
- Be local and file-based. No database, no separate index file, no central registry.
- Be one manifest per artifact. The relationship should be obvious from the filenames.
- Support these fields:
  - `title`
  - `description`
  - `tags`
  - `original_date`
  - `links`
- Be readable by both humans and machines.
- Be easy to validate in tests and in future tooling.
- Avoid changing the current route model or requiring a build step.

## Proposed Solution

### File Layout

Each artifact keeps its existing file:

```text
imports/
  retro-launcher.jsx
  retro-launcher.manifest.json
  agent-workbench.html
  agent-workbench.manifest.json
```

The manifest filename convention is:

```text
<artifact-base-name>.manifest.json
```

Examples:

- `retro-launcher.jsx` -> `retro-launcher.manifest.json`
- `agent-workbench.html` -> `agent-workbench.manifest.json`

This convention is preferable to `<artifact>.json` because it avoids collisions with JSON files that might later be used as app data rather than metadata.

### Manifest Schema

Recommended first version:

```json
{
  "title": "Retro Launcher",
  "description": "Mac-style launcher UI for browsing apps, files, bookmarks, and snippets.",
  "tags": ["retro", "launcher", "mac-ui"],
  "original_date": "2026-03-14",
  "links": [
    {
      "label": "Claude Conversation",
      "url": "https://claude.ai/chat/..."
    },
    {
      "label": "Import Ticket",
      "url": "https://example.invalid/tickets/123"
    }
  ]
}
```

### Field Semantics

- `title`
  - Optional but strongly recommended
  - Used as the display title in the index and list output
  - Overrides any title derived from the artifact file itself

- `description`
  - Optional
  - Short human-readable summary
  - Good default target length: 1-2 sentences

- `tags`
  - Optional
  - Array of strings
  - Intended for future filtering/grouping, but also immediately useful in list/index rendering

- `original_date`
  - Optional
  - Date string in `YYYY-MM-DD` format
  - Represents when the artifact was originally created, not when it was imported into the repo

- `links`
  - Optional
  - Array of objects with:
    - `label`
    - `url`
  - `label` exists because a bare URL is not sufficient for a friendly UI

### Recommended Go Types

```go
type ArtifactLink struct {
    Label string `json:"label"`
    URL   string `json:"url"`
}

type ArtifactManifest struct {
    Title       string         `json:"title"`
    Description string         `json:"description"`
    Tags        []string       `json:"tags"`
    OriginalDate string        `json:"original_date"`
    Links       []ArtifactLink `json:"links"`
}

type Artifact struct {
    Name          string
    Filename      string
    Type          string
    Title         string
    Size          int64
    ModifiedAt    time.Time
    Path          string
    Description   string
    Tags          []string
    OriginalDate  string
    Links         []ArtifactLink
    ManifestPath  string
    HasManifest   bool
}
```

This keeps the current `Artifact` shape familiar while adding fields the list command and templates can consume directly.

For the first version, `OriginalDate` can remain a string in memory as long as it is validated during manifest loading. That avoids timezone confusion and preserves the exact authored value. If later features require date sorting or range filtering, the field can be parsed into `time.Time` alongside the raw string.

## Design Decisions

### Decision 1: Use companion files instead of embedding metadata in HTML or JSX

Embedding metadata into the artifacts themselves would require different strategies for HTML and JSX. It would also mix display metadata with app code. A companion file keeps the metadata model uniform across both artifact types and avoids editing imported source unnecessarily.

### Decision 2: Manifest title overrides derived title

The derived title is still useful as a fallback, but it should not have higher priority than curated metadata. Many JSX artifacts export a generic component name like `App`, which is not useful in the UI.

Recommended precedence:

1. `manifest.title`
2. Extracted title from HTML or JSX
3. Filename base

### Decision 3: Keep manifests optional

This preserves compatibility with every existing import and lets the repo migrate gradually. Optional manifests also keep the happy path simple: drop in a new artifact first, add metadata later.

### Decision 4: Store manifests beside artifacts, not in a separate directory

Keeping related files adjacent makes manual editing and review easier. It also avoids having to maintain a global metadata index keyed by filenames, which would be fragile during renames.

### Decision 5: Validate manifests during scan

The scanner is already the system’s metadata entry point. Validating manifests there keeps the behavior centralized and avoids repeating parse logic in the list command or the HTTP layer.

Recommended behavior:

- Missing manifest: no error, no metadata
- Valid manifest: load and enrich artifact
- Invalid manifest: continue scanning, but attach a manifest error field in a future iteration

For the first implementation, there are two viable approaches:

1. Simpler but stricter: return an error from `Scan()` on invalid manifest JSON
2. Slightly larger change but better UX: add `ManifestError string` to `Artifact` and keep scanning

I recommend option 2 if implementation time allows, because a single malformed manifest should not take down the entire listing page.

## Scanner Design

### Current Behavior

Today the scanner:

- Reads top-level directory entries
- Recognizes `.html`, `.htm`, and `.jsx`
- Extracts a title from file contents
- Builds an `Artifact` slice

### Proposed Behavior

The scanner should add a manifest indexing pass before artifact assembly.

#### Pseudocode

```go
func (s *Scanner) Scan() ([]Artifact, error) {
    entries := os.ReadDir(s.dir)

    manifests := map[string]string{}
    for _, entry := range entries {
        if entry.IsDir() {
            continue
        }
        if strings.HasSuffix(entry.Name(), ".manifest.json") {
            base := strings.TrimSuffix(entry.Name(), ".manifest.json")
            manifests[base] = absPath(entry.Name())
        }
    }

    artifacts := []Artifact{}
    for _, entry := range entries {
        if !isArtifactFile(entry.Name()) {
            continue
        }

        artifact := buildBasicArtifact(entry)

        if manifestPath, ok := manifests[artifact.Name]; ok {
            manifest := loadManifest(manifestPath)
            applyManifest(&artifact, manifest, manifestPath)
        }

        artifacts = append(artifacts, artifact)
    }

    return artifacts, nil
}
```

### New Helper Functions

Add focused helpers in `pkg/artifacts/scanner.go` or a new sibling file such as `pkg/artifacts/manifest.go`:

- `isManifestFile(name string) bool`
- `loadManifest(path string) (*ArtifactManifest, error)`
- `validateManifest(m *ArtifactManifest) error`
- `applyManifest(a *Artifact, m *ArtifactManifest, path string)`

I recommend moving manifest-specific logic into `pkg/artifacts/manifest.go` to keep `scanner.go` readable.

## CLI and HTTP Integration

### List Command

The list command in [list.go](/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/cmd/serve-artifacts/cmds/list.go) should expose the new metadata as structured fields.

Recommended added columns:

- `description`
- `tags`
- `original_date`
- `has_manifest`
- `manifest_path`
- `links`

For table output, Glazed can render `tags` and `links` as JSON-ish values or flattened strings. A reasonable first version is:

- `tags`: comma-separated string
- `links`: count or JSON string

For `--output json`, preserve richer structure where possible.

### Index Template

The index page in [index.html](/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/index.html) should show manifest metadata without becoming visually noisy.

Recommended display changes:

- Primary title uses `artifact.Title`
- Optional second line for `Description`
- Meta row shows:
  - filename
  - artifact type
  - original date if present
  - file size
- Tags render as small chips
- Links render as a compact “Links” block only when present

Example sketch:

```html
<div class="artifact-info">
  <a href="/view/{{.Name}}">{{.Title}}</a>
  {{if .Description}}<div class="artifact-description">{{.Description}}</div>{{end}}
  <div class="artifact-meta">
    {{.Filename}}
    {{if .OriginalDate}} &middot; created {{.OriginalDate}}{{end}}
    &middot; {{.Size | humanSize}}
  </div>
  {{if .Tags}}
  <div class="artifact-tags">
    {{range .Tags}}<span class="tag">{{.}}</span>{{end}}
  </div>
  {{end}}
</div>
```

### View Pages

The view routes do not need a major redesign for the first version.

- JSX view pages already use `artifact.Title` in the HTML `<title>` element, so manifest title precedence will improve them automatically.
- Raw HTML artifacts are served directly, so their internal `<title>` remains unchanged unless the server starts rewriting `<head>`. That is acceptable for the first version because the manifest title primarily targets the index and list experience.

If richer in-view metadata is desired later, a separate metadata sidebar or wrapper route can be added in a future ticket.

## Validation Rules

Recommended validation:

- `title`
  - must be non-empty if present after trimming spaces
- `description`
  - any string allowed
- `tags`
  - array entries must be non-empty, trimmed strings
  - optional normalization rule: lower-case tags on load
- `original_date`
  - if present, must parse with `time.Parse("2006-01-02", value)`
- `links`
  - each entry must have non-empty `label`
  - each entry must have non-empty `url`
  - `url` must parse as `http` or `https`

The scanner should reject unknown top-level JSON types such as `tags: "retro"` instead of quietly accepting malformed input.

## Alternatives Considered

### Alternative 1: Single top-level `manifests.json` index

Rejected because:

- It becomes a central registry that must be updated on every rename
- It is harder to review next to the artifact it describes
- It creates merge pressure as the import set grows

### Alternative 2: YAML manifests

Rejected for now because:

- The request is specifically for JSON
- JSON is easier to validate with strict struct decoding in Go
- JSON avoids introducing another authoring format into this repo

### Alternative 3: Frontmatter inside HTML/JSX files

Rejected because:

- It couples metadata with imported app source
- It would require different parsing strategies for HTML and JSX
- It increases the temptation to hand-edit imported artifacts

### Alternative 4: Add manifest support only to the CLI, not the server

Rejected because:

- The index page is where richer metadata is most visible and useful
- Hiding manifest support behind `list --output json` would undercut the feature’s value

## Implementation Plan

### Phase 1: Schema and artifact model

1. Add `ArtifactLink` and `ArtifactManifest` types.
2. Extend `Artifact` with manifest-derived fields.
3. Add manifest parsing and validation helpers.

### Phase 2: Scanner integration

1. Index `.manifest.json` files by basename.
2. Load the companion manifest for each artifact if present.
3. Apply title precedence and additional metadata fields.
4. Decide and implement invalid-manifest behavior.

### Phase 3: Presentation layer

1. Extend `list.go` with new fields.
2. Update `pkg/server/templates/index.html` to show description, tags, and original date.
3. Ensure JSX host pages pick up the manifest title automatically through existing title usage.

### Phase 4: Documentation and tests

1. Add unit tests for:
   - valid manifest loading
   - missing manifest fallback
   - invalid date
   - invalid links
   - manifest title precedence
2. Update [README.md](/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/README.md) and [adding-artifacts.md](/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/cmd/serve-artifacts/doc/adding-artifacts.md).
3. Add at least one sample manifest in `imports/` during implementation or test fixtures.

## Suggested Test Matrix

| Case | Artifact file | Manifest file | Expected result |
|------|---------------|---------------|-----------------|
| No manifest | `foo.jsx` | none | Artifact still appears with derived title |
| Valid manifest | `foo.jsx` | valid JSON | Manifest title/description/tags visible |
| HTML with manifest | `foo.html` | valid JSON | Index uses manifest metadata |
| Invalid JSON | `foo.manifest.json` | malformed | Scanner behavior matches chosen error policy |
| Bad date | valid JSON | `original_date: "03/29/2026"` | Validation error |
| Bad link | valid JSON | missing `label` or bad `url` | Validation error |

## Rollout Notes

This feature should be implemented as an additive change:

- No existing artifacts need to be edited immediately.
- The ticket `IMPORT-CLAUDE-DEMOS` becomes the first strong consumer once manifests are added beside imported apps.
- The UI should remain readable when no manifest metadata exists.

## Open Questions

1. Should invalid manifests fail the entire scan or surface as per-artifact warnings?
2. Should `tags` be normalized to lower-case during load, or should the repo preserve authored case?
3. Should the server eventually expose a dedicated route such as `/manifest/{name}` for debugging and automation?
4. Do we want a JSON Schema file checked into the repo for editor validation, or is Go-side validation sufficient for the first pass?

## Recommended First Pass

If implementation time is tight, ship this reduced slice first:

1. Support `<artifact>.manifest.json`
2. Parse and validate `title`, `description`, `tags`, `original_date`, and `links`
3. Apply manifest title precedence
4. Show description/tags/date in the index page
5. Emit manifest metadata in `serve-artifacts list --output json`
6. Document the manifest format in the help page

That delivers the feature’s core value without expanding the route surface or inventing filtering UI prematurely.

## References

- [scanner.go](/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/artifacts/scanner.go)
- [list.go](/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/cmd/serve-artifacts/cmds/list.go)
- [index.html](/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/index.html)
- [server.go](/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/server.go)
- [adding-artifacts.md](/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/cmd/serve-artifacts/doc/adding-artifacts.md)

## Problem Statement

<!-- Describe the problem this design addresses -->

## Proposed Solution

<!-- Describe the proposed solution in detail -->

## Design Decisions

<!-- Document key design decisions and rationale -->

## Alternatives Considered

<!-- List alternative approaches that were considered and why they were rejected -->

## Implementation Plan

<!-- Outline the steps to implement this design -->

## Open Questions

<!-- List any unresolved questions or concerns -->

## References

<!-- Link to related documents, RFCs, or external resources -->
