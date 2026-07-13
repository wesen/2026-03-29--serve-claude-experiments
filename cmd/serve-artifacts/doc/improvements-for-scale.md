# Improvements for managing thousands of artifacts

This document is a prioritized set of suggestions for growing `serve-artifacts`
from "renders a folder of demos" into a tool for browsing, searching, annotating,
and organizing thousands of Claude artifacts. It is written after wiring the
server to a bulk conversation export (the `<uuid>/artifacts/<file>` layout).

The guiding constraint is scale: at 1000s of artifacts the current design (scan
the directory on every request, render one flat index, metadata only in
per-file manifest JSON) stops being pleasant. Most of the high-value work is a
consequence of one decision — **introduce a persistent index** — so that comes
first.

---

## 0. The foundational change: a persistent index (SQLite)

Today every request re-walks the tree, re-reads each file to extract a title,
and re-parses every manifest. That is fine for 20 files and quadratic-feeling
at 2000. It also means there is nowhere to put user data (favorites, tags,
notes, collections) except more files.

Introduce a SQLite index (e.g. `~/.serve-artifacts/index.db`) that is the source
of truth for everything the UI needs, kept in sync by the existing file watcher:

- `artifacts(id, rel_path, type, title, component_name, size, content_hash,
  source_conversation_uuid, source_project, model, created_at, exported_at,
  indexed_at, mtime, runtime_ok, warnings_json)`
- `artifact_fts` — full-text index over title + description + source code +
  transcript (SQLite FTS5)
- `tags(id, name)`, `artifact_tags(artifact_id, tag_id)`
- `collections(id, name, kind /* manual | smart */, query_json, created_at)`,
  `collection_items(collection_id, artifact_id, position)`
- `favorites(artifact_id, created_at)`, `views(artifact_id, viewed_at)`,
  `notes(artifact_id, body, updated_at)`, `ratings(artifact_id, stars)`

Everything below becomes cheap once this exists. Indexing is incremental: hash
each file, only re-extract when the hash changes. Serving reads the DB, not the
filesystem.

This is the single change that unblocks search, organization, and metadata
editing without inventing a new file format for each.

---

## 1. Ingest the export's own metadata (biggest quick win)

The bulk exporter already writes a `meta.json` next to each conversation's
`artifacts/` folder (conversation uuid, name, model, created/updated dates,
project, per-artifact list, and reconstruction warnings). Right now the server
ignores it and shows `App` for any artifact whose default export is named `App`.

Ingest `meta.json` during scan so every artifact inherits, for free:

- the **conversation title** as a much better default title than the component
  name (e.g. "Minimal timezone-aware calendar" instead of "Calendar"),
- the **project**, **model**, and **dates**,
- a link back to the source conversation transcript (`conversation.md`) and,
  where derivable, the `claude.ai/chat/<uuid>` URL,
- the **reconstruction warnings**, so an artifact that may be incomplete can be
  badged as such instead of silently looking fine.

This turns a wall of `App / App / App` into a browsable, titled, dated,
project-grouped library with almost no UI work.

---

## 2. Search & discovery

The core need at scale. With the FTS index in place:

- **Global search box** (title, description, tags, source code, transcript),
  with typeahead and result highlighting. `/` to focus, like the exporter's UX.
- **Faceted filtering** in a sidebar: type (jsx/html), project, tags, model,
  date range, library used (recharts/d3/…), "has runtime error", "has
  reconstruction warning", size buckets. Facets show counts.
- **Sort**: recently exported, recently viewed, most viewed, title, size,
  favorites first.
- **Saved searches** that become *smart collections* (see §3).
- **"Uses library X"** filter, derived from the artifact's bare imports — also
  drives the import-map completeness work in §7.
- Later: **semantic / similar** ("more like this") via embeddings over the
  source + transcript, for when keyword search is not enough.

---

## 3. Organization: tags, favorites, collections/playlists

All backed by the DB, all editable in the UI (no file editing):

- **Tags**: free-form, multi-select, autocomplete from existing tags. Tag chips
  on cards double as one-click filters. Bulk-tag a multi-selection.
- **Favorites / bookmarks**: a star toggle; a "Favorites" pin in the sidebar.
- **Collections / playlists**: manually curated, *ordered* lists ("Best UIs",
  "Client demo", "Charting experiments"). Drag to reorder. An artifact can be in
  many collections. A collection has its own shareable URL and can be presented
  as a slideshow/gallery.
- **Smart collections**: a saved query ("project = EINK-OS AND tag = final") that
  stays live as new artifacts are exported.
- **Bulk operations**: checkbox multi-select → tag, add-to-collection, favorite,
  hide/archive, export-as-zip.

---

## 4. In-UI metadata editing & annotation

"Add information about them" without hand-editing manifest files:

- Inline-edit **title, description, tags** from the detail page and from cards.
- **Notes / annotations** per artifact (freeform markdown), and a **rating**.
- Writes go to the DB; optionally **also** write back a `*.manifest.json` so the
  metadata travels with the files and survives a re-index (DB as cache, files as
  portable truth — pick one as canonical; recommend DB canonical + optional
  export to manifests).

---

## 5. UI/UX for browsing at scale

- **Thumbnail gallery** — the single biggest UX win. Render each artifact once
  in headless Chromium, screenshot it, cache the PNG (invalidate on content
  hash). Visual browsing of 1000s beats a text list by a wide margin. Generate
  lazily on first view + a background backfill job.
- **Virtualized / paginated grid** — never render 2000 cards at once; windowed
  scroll or server-side pagination.
- **Grid ↔ list toggle**, with density options; list view shows title, project,
  date, tags, size.
- **Rich detail page**: live preview pane + metadata + source (syntax
  highlighted) + the linked conversation transcript + "open in claude.ai" +
  favorite/tag/collection controls.
- **Responsive preview**: toggle device widths (phone/tablet/desktop) and a
  fullscreen mode; useful for judging a UI artifact.
- **Command palette (⌘K)** and **keyboard nav** (j/k to move, o to open, f to
  favorite, t to tag) — power-user throughput over thousands.
- **Project / date grouping** and breadcrumbs; a left rail of projects.
- **Dark mode**.

---

## 6. Performance & reliability at scale

- **Cache the scan**; serve from the DB. Re-index incrementally on watcher
  events, not per request.
- **Health checks**: a background job loads each artifact in headless Chromium
  and records `runtime_ok` + the first console error. Surface a "broken" badge
  and a "Broken" facet. (This is exactly how the recharts/`import React`
  failures were found manually — automate it.)
- **Dedup**: identical artifacts re-exported across conversations share a
  `content_hash`; show one entry with N sources, or group them.
- **Versions**: when the same logical artifact is re-exported with changes, keep
  a version history rather than colliding names.

---

## 7. Tighter integration with the export/runtime pipeline

- **Watch the downloads directory** so newly exported conversations appear
  automatically (the watcher already exists; point it at the export root).
- **Import-map completeness**: from the "uses library X" data (§2), detect bare
  specifiers not covered by the import map and either auto-add an `esm.sh` entry
  or warn in the UI. This generalizes the manual recharts fix.
- **Surface reconstruction warnings** (from `meta.json`) as an artifact badge and
  a facet, so partially-reconstructed artifacts are visible, not silently
  trusted.
- **Link artifact → conversation → project** end to end, so from any artifact you
  can jump to its transcript and its sibling artifacts.

---

## 8. Sharing & export (later)

- Shareable read-only links for a single artifact or a collection.
- Export a collection as a **static site** or a **zip** (artifacts + an index
  page), for handing off a curated set.
- Public/private visibility if this ever becomes multi-user.

---

## Suggested sequencing

1. **SQLite index + incremental scan** (§0) and **ingest `meta.json`** (§1) —
   foundation; immediately fixes titles/dates/projects and removes per-request
   scanning.
2. **Search + facets** (§2) and **tags + favorites + collections** (§3) — the
   day-to-day management surface.
3. **Thumbnail gallery + virtualized grid + detail page** (§5) — the visual
   browsing experience.
4. **Health checks + dedup + import-map completeness** (§6, §7) — reliability at
   scale.
5. **Metadata write-back, semantic search, sharing** (§4 tail, §2 tail, §8) —
   polish and reach.

The through-line: adopt a persistent index, feed it the metadata the exporter
already produces, then layer search/organization/visual-browsing on top. Almost
every feature the user asked for (search, adding information, bookmarks,
playlists, tags) is a small amount of UI over that index.
