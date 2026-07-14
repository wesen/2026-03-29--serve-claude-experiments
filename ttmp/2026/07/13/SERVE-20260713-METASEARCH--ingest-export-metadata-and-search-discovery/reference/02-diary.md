# Diary — SERVE-20260713-METASEARCH

Chronological log of the implementation. Newest entries at the bottom.

## 2026-07-13 — Setup

- Created ticket and the intern design guide (`design/01-...guide.md`); uploaded the guide to reMarkable.
- Confirmed the real `meta.json` shape from an export
  (`~/Downloads/claude-downloads/<uuid>/meta.json`): keys `uuid, name, model,
  created_at, updated_at, project_uuid, artifacts[{file,path,bytes,source}],
  warnings[]`. `warnings` is conversation-level (shared by all its artifacts).
- Read the current code: `pkg/artifacts/scanner.go` (recursive `Scan`, manifest
  overlay), `pkg/artifacts/manifest.go`, `pkg/server/search.go`
  (`SearchDocument`, `buildSearchText` — excludes source), `pkg/server/server.go`
  (per-request scan, handlers), `pkg/server/templates/index.html` (client-side
  substring filter over `/search-index.json`).

Plan: Feature 1 (meta.json ingest) first, then Feature 2 (search). Commit after each.

## 2026-07-13 — Feature 1: meta.json ingest (done)

- Added provenance fields to `artifacts.Artifact` (FromExport, SourceConversationUUID/Title,
  Project, Model, ConversationCreatedAt/UpdatedAt, TranscriptPath, ClaudeURL, Warnings).
- New `pkg/artifacts/export_meta.go`: `exportMeta` struct + `loadExportMeta` +
  `dateOnly` helper.
- `Scan()` now, per artifact at `<uuid>/artifacts/<file>`, looks up
  `<uuid>/meta.json` (`lookupExportMeta`, cached per conversation dir incl. misses)
  and enriches (`enrichFromExportMeta`) BEFORE the manifest overlay. Title
  precedence: manifest > conversation name > derived > Name.
- Enriched `SearchDocument` (project, model, source_uuid, updated_at,
  warnings_count) and folded conversation title/project/model into `search_text`.
- Tests (`export_meta_test.go`): ingest happy path, manifest-title-wins,
  no-meta-keeps-derived-title. All green.
- Live check against `~/Downloads/claude-downloads`: titles are now the
  conversation names ("React dynamic windows UI for metrics", "Browser-based
  JavaScript IDE with AST parser", ...) instead of "App".

Decision: `Project` holds the raw `project_uuid` for now; resolving to a project
name needs the projects list, deferred (not required for search facets to work —
can group by uuid, and the export currently has null projects anyway).

Next: Feature 2 — cached in-memory index + `/search` endpoint (full-text over
source/transcript, facets, sort) + rebuilt UI.
