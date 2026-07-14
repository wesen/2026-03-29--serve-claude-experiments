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

## 2026-07-13 — Feature 2: search & discovery (done)

- New `pkg/server/index.go`: cached in-memory `searchIndex` (RWMutex). `rebuild()`
  scans + reads each artifact's source and transcript into a lowercased haystack,
  and extracts third-party libraries from bare imports. Built at Run() start;
  rebuilt on watcher change (added `onChange` hook to the watcher, invoked in
  `broadcast()`).
- `search(query)` supports free-text (AND over whitespace terms, over
  metadata+source+transcript), filters (type/project/model/tag/library/warnings),
  sort (recent/title/size/-size/name), and paging. Facets are counted per
  dimension against the results filtered by all OTHER dimensions, so selecting one
  value doesn't zero out its siblings.
- `GET /search` endpoint returns `{total, results, facets}`. `handleIndex` and
  `/search-index.json` now read the cached index (no per-request scan).
- Rewrote `templates/index.html` into a search-driven UI (retro chrome kept):
  debounced search box, sort dropdown, facet sidebar with counts + active state,
  result count, clickable tag chips, warning badges, view/claude.ai links, and a
  "Load more" pager.
- Tests (`index_test.go`): extractLibraries (+scoped roots), text/type/library/
  warnings/tag filters, and facet-excludes-own-dimension. All green.
- Live against `~/Downloads/claude-downloads` (21 artifacts): `/search` returns
  correct totals + facets (type/model/library); `q=recharts` matches the artifact
  that imports recharts (full-text over SOURCE works); browser UI renders 21 cards
  + facet sidebar, search "calendar"→2, click html facet→3. Zero console errors
  (besides favicon).

Scaling note: the index holds every artifact's lowercased source (and transcript)
in memory — fine for thousands at tens of MB, but the SQLite/FTS foundation
(improvements-for-scale §0) remains the path for very large libraries. Also the
fsnotify watcher only watches the top-level dir (pre-existing), so nested export
changes won't trigger a rebuild until that is made recursive.

Both tasks complete. Full suite green; verified live.

## 2026-07-13 — UI: remove window chrome (per request)

- Removed the retro "classic Mac" window chrome from `index.html`: dropped the
  `.window`/`.titlebar`/`.close-box` CSS and the gray desktop background; the page
  is now a plain white, centered `.content` container. Cards/facets/badges kept.
- Rebuilt, verified live: no `.window`/`.titlebar` in the DOM, white body
  background, 21 cards + facets still render and filter correctly.
