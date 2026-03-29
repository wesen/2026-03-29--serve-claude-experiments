# serve-artifacts

A standalone Go server that serves Claude.ai artifacts (HTML and JSX) from a local directory. HTML artifacts are served directly; JSX artifacts are wrapped in a host page with React and Babel for in-browser transformation. Optional per-app manifest JSON files provide richer titles, descriptions, tags, dates, and links.

Built with the [Glazed](https://github.com/go-go-golems/glazed) command framework.

## Quick start

```bash
# Build
go build ./cmd/serve-artifacts/

# Serve artifacts from a directory
./serve-artifacts serve --dir ./imports --port 8080

# With auto-reload on file changes
./serve-artifacts serve --dir ./imports --watch

# List artifacts as a table
./serve-artifacts list --dir ./imports

# List as JSON
./serve-artifacts list --dir ./imports --output json
```

Visit `http://localhost:8080` to browse the artifact index.

## How it works

**HTML artifacts** (`.html`/`.htm`) are served directly with a small navigation bar injected before `</body>`.

**JSX artifacts** (`.jsx`) are served via a host page that:
1. Loads React 18 from esm.sh via an import map
2. Loads Babel standalone from unpkg
3. References the JSX source via `<script type="text/babel" src="/jsx/{name}">`
4. Babel transforms JSX to plain JS in the browser
5. The component is auto-mounted into `<div id="root">`

The server extracts titles from HTML `<title>` tags and JSX default exports, but companion manifest files can override those derived titles and add richer metadata.

## Adding artifacts

Drop `.html` or `.jsx` files into the artifacts directory. The server discovers them on each request — no restart needed.

Optionally add a companion manifest named `<artifact-base>.manifest.json` beside the artifact file:

```json
{
  "title": "Retro Launcher",
  "description": "Classic launcher UI for browsing apps, files, bookmarks, clipboard history, and snippets.",
  "tags": ["launcher", "retro", "desktop"],
  "original_date": "2026-03-29",
  "links": []
}
```

Manifest metadata is used by the index page, the lightweight client-side search bundle, and the `list` command output.

For detailed conventions and troubleshooting:

```bash
./serve-artifacts help adding-artifacts
```

### HTML requirements

- Complete document with `<!DOCTYPE html>` and `<body>`
- All CSS and JS inline (external CDN URLs are fine)

### JSX requirements

- Must expose a recognizable default export. Named forms such as `export default function ComponentName()` and `function ComponentName() { ... } export default ComponentName;` are supported.
- Can import from `"react"` — hooks, Fragment, etc. are all available
- All data and styles must be inline (single-file components)

## Commands

### `serve`

Starts the HTTP server.

| Flag | Default | Description |
|------|---------|-------------|
| `--dir`, `-d` | `.` | Directory containing artifacts |
| `--port`, `-p` | `8080` | Port to listen on |
| `--watch`, `-w` | `false` | Watch for file changes and auto-reload browsers |

### `list`

Lists artifacts as structured data (Glazed command — supports `--output`, `--fields`, etc.).

| Flag | Default | Description |
|------|---------|-------------|
| `--dir` | `.` | Directory containing artifacts |
| `--type` | (all) | Filter by type: `html` or `jsx` |

## Routes

| Route | Description |
|-------|-------------|
| `GET /` | Index page listing all artifacts |
| `GET /search-index.json` | Search bundle consumed by the frontend-only filter/autocomplete logic |
| `GET /view/{name}` | View an artifact (HTML served directly, JSX via host page) |
| `GET /jsx/{name}` | Raw JSX source with React import and mount code appended |
| `GET /raw/{name}` | Raw artifact file (no transformation) |
| `GET /events` | SSE endpoint for file change notifications (watch mode only) |

## Project structure

```
cmd/serve-artifacts/
  main.go                 # Root Cobra command, Glazed help system
  cmds/
    serve.go              # serve command (plain Cobra)
    list.go               # list command (Glazed)
  doc/
    doc.go                # Embedded help docs
    adding-artifacts.md   # Tutorial: adding artifacts
pkg/
  artifacts/
    scanner.go            # Directory scanner, title extraction
  server/
    server.go             # HTTP server, handlers
    watcher.go            # File watcher (fsnotify + SSE)
    templates/
      index.html          # Index page template
      jsx-host.html       # JSX artifact host page
```

## Design docs

Detailed architecture and implementation guide in the docmgr ticket:

```
ttmp/2026/03/29/SERVE-ARTIFACTS--standalone-go-server-for-claude-ai-artifacts/
  design-doc/01-artifact-server-design-and-implementation-guide.md
  reference/01-diary.md
  reference/02-jsx-template-escaping-bug-analysis.md
```
