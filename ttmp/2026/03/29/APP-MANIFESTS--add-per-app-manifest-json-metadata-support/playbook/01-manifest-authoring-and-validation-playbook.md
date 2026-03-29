---
Title: Manifest Authoring and Validation Playbook
Ticket: APP-MANIFESTS
Status: active
Topics:
    - artifacts
    - golang
    - web-server
DocType: playbook
Intent: long-term
Owners: []
RelatedFiles:
    - Path: imports/retro-launcher.manifest.json
      Note: Representative manifest file for manual authoring
    - Path: pkg/artifacts/manifest.go
      Note: Validation rules enforced during scanning
    - Path: pkg/server/search.go
      Note: Search bundle generation consumed by the frontend filter
    - Path: pkg/server/templates/index.html
      Note: First-pass metadata rendering and autocomplete filter field
    - Path: cmd/serve-artifacts/doc/adding-artifacts.md
      Note: User-facing help page for artifact and manifest authoring
ExternalSources: []
Summary: Repeatable playbook for authoring artifact manifests, validating scanner output, and smoke-testing the first-pass metadata/search UI.
LastUpdated: 2026-03-29T10:21:02.341096417-04:00
WhatFor: Providing a repeatable operator workflow for manifest edits and first-pass search/index validation
WhenToUse: When adding or updating manifests, checking metadata output, or manually smoke-testing the artifact browser
---

# Manifest Authoring and Validation Playbook

## Purpose

This playbook describes the repeatable workflow for:

- authoring or editing companion manifest files
- validating manifest parsing and scanner output
- smoke-testing the first-pass metadata UI
- checking the frontend-only search bundle and filter field

It is intentionally optimized for the current local filesystem-based workflow in `imports/`.

## Environment Assumptions

- Repository root: `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments`
- Artifact files live in `imports/`
- Companion manifests use the naming convention `<artifact-base>.manifest.json`
- Go toolchain is installed and `go test ./...` works
- `tmux` is available if you run the local server manually
- The current search experience is frontend-only and consumes `/search-index.json`

## Commands

### 1. Check current repository and ticket state

```bash
git status --short
docmgr task list --ticket APP-MANIFESTS
docmgr doctor --ticket APP-MANIFESTS --stale-after 30
```

### 2. Add or edit a manifest

Example target:

```bash
${EDITOR:-vi} imports/retro-launcher.manifest.json
```

Minimal manifest shape:

```json
{
  "title": "Retro Launcher",
  "description": "Classic launcher UI for browsing apps, files, bookmarks, clipboard history, and snippets from a unified palette.",
  "tags": ["launcher", "retro", "desktop", "productivity"],
  "original_date": "2026-03-29",
  "links": []
}
```

### 3. Validate parsing and structured output

```bash
go test ./...
go run ./cmd/serve-artifacts list --dir ./imports --output json
go run ./cmd/serve-artifacts list --dir ./imports --fields name,title,description,tags,original_date,has_manifest,manifest_error
```

What to check:

- `title` reflects the manifest override
- `description`, `tags`, and `original_date` are present
- `has_manifest` is `true`
- `manifest_error` is empty for valid manifests

### 4. Rebuild and run the server in tmux

```bash
go build -o ./serve-artifacts ./cmd/serve-artifacts
tmux kill-session -t serve-artifacts-manifests || true
tmux new-session -d -s serve-artifacts-manifests \
  'cd /home/manuel/code/wesen/2026-03-29--serve-claude-experiments && ./serve-artifacts serve --dir ./imports --port 8092'
```

### 5. Smoke-test the index and search bundle

```bash
curl -sf http://127.0.0.1:8092/ | sed -n '1,220p'
curl -sf http://127.0.0.1:8092/search-index.json | sed -n '1,120p'
```

What to look for in `/`:

- search/filter input with `id="artifact-filter"`
- datalist with `id="artifact-suggestions"`
- manifest-driven description text
- `created YYYY-MM-DD` metadata line
- tag chips

What to look for in `/search-index.json`:

- `title`
- `description`
- `tags`
- `original_date`
- `view_url`
- `search_text`

### 6. Shut the validation server down

```bash
tmux kill-session -t serve-artifacts-manifests
```

### 7. Record the work

```bash
git add imports/*.manifest.json README.md cmd/serve-artifacts/doc/adding-artifacts.md
git commit -m "Update artifact manifests"

docmgr changelog update --ticket APP-MANIFESTS \
  --entry "Updated artifact manifests and revalidated manifest/search behavior." \
  --file-note "/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/retro-launcher.manifest.json:Representative manifest change"
```

## Exit Criteria

- `go test ./...` passes
- `go run ./cmd/serve-artifacts list --dir ./imports --output json` shows manifest metadata
- `/search-index.json` returns populated search documents
- the index page renders manifest descriptions/tags/date and the filter field
- `docmgr doctor --ticket APP-MANIFESTS --stale-after 30` passes
- any tmux validation session is shut down after testing

## Notes

### Current architecture choice

The current implementation keeps artifact source files on disk and uses manifests only for metadata. Search is intentionally frontend-only for now: the server emits `/search-index.json`, and the browser does the filtering locally.

### Future option: precompile JSX at build time

Precompiling JSX during binary build is feasible, but it is a moderate refactor rather than a one-line optimization.

Easy part:

- replace runtime Babel in the served page with already-transformed JavaScript
- optionally embed a precompiled artifact bundle into the binary for artifacts known at build time

Harder part:

- the current server deliberately supports dropping new `.jsx` files into `imports/` at runtime
- build-time compilation only sees files that exist during the build
- the watcher currently just reloads changed files; it does not run a compile pipeline

So there are two realistic options:

1. Hybrid mode, recommended:
   - precompile known JSX artifacts during `go build`
   - keep the current runtime path for dynamically added files
   - watcher behavior stays almost the same because new files still fall back to runtime transform

2. Full compile pipeline:
   - add a local compiler step for runtime file changes
   - watcher must trigger recompilation and cache invalidation
   - server serves compiled output instead of source-plus-Babel

Impact estimate:

- Hybrid mode: medium effort, because it needs a compiled artifact cache plus a fallback path
- Full replacement of runtime Babel while preserving dynamic file drops: medium-high effort, because the watcher becomes part of a real build pipeline

If this becomes a real implementation goal, the next clean step is a dedicated design ticket for “precompiled JSX artifacts with runtime fallback”.
