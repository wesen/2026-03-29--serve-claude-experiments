# Diary

## Goal

Capture the implementation of ticket SERVE-20260713-METASEARCH: ingesting the
Claude conversation export's `meta.json` so artifacts inherit real metadata
(feature 1), and adding full-text + faceted search over a cached index (feature
2), plus a follow-up UI change. Records what changed, why, what worked, what
broke, and how to review each step.

## Step 1: Ticket, intern design guide, and reMarkable upload

Set up the ticket and produced the intern-facing analysis/design/implementation
guide before writing any code, so the two features had a written contract to
build against. Read the existing `serve-artifacts` code first (scanner, manifest,
server handlers, search.go, index template) to ground the design in what is
actually there.

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket to do 1. (ingest the exports own metadata) and 2. (search discovery).

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

Then work on the tasks one by one, keeping a detailed diary as you work (see skill). commit at appropriateintervals"

**Assistant interpretation:** Create a docmgr ticket for two features (meta.json ingest, search/discovery), write a thorough intern-level design guide (prose, bullets, pseudocode, diagrams, API/file references), store it in the ticket and upload to reMarkable, then implement the two features one at a time keeping a diary and committing at sensible boundaries.

**Inferred user intent:** Turn `serve-artifacts` from a demo viewer into something usable at the scale of thousands of exported artifacts, starting with the two foundational features, with durable documentation and a reviewable trail.

**Commit (code):** bf867ce — "feat: ingest conversation export meta.json …" (the guide + diary landed with feature 1's commit)

### What I did
- Created ticket `SERVE-20260713-METASEARCH` (`docmgr ticket create-ticket`).
- Added the design doc (`docmgr doc add --doc-type design`) and wrote `design/01-export-metadata-ingest-and-search-analysis-design-and-implementation-guide.md`.
- Uploaded the guide bundle to reMarkable (`/ai/2026/07/13/SERVE-20260713-METASEARCH`).
- Read `pkg/artifacts/scanner.go`, `pkg/artifacts/manifest.go`, `pkg/server/server.go`, `pkg/server/search.go`, `pkg/server/templates/index.html`, and confirmed the real `meta.json` shape from `~/Downloads/claude-downloads/<uuid>/meta.json`.

### Why
- Writing the design first fixed the association rule (`<uuid>/artifacts/<file>` ↔ `<uuid>/meta.json`), the title-precedence rule, and the search index shape before code, avoiding rework.

### What worked
- The guide accurately reflects the code; the two features slotted into it without redesign.

### What didn't work
- N/A (documentation step).

### What I learned
- The scanner runs `Scan()` per request with no cache, and `search_text` excludes source — both of which feature 2 has to change.
- `meta.json.warnings` is conversation-level (shared by all its artifacts), not per-artifact.

### What was tricky to build
- Deciding the title precedence up front (manifest > conversation name > derived) so existing manifest-annotated demos in `imports/` keep working while exported artifacts gain real titles.

### What warrants a second pair of eyes
- Whether `Project` should stay a raw `project_uuid` or resolve to a name (deferred; see Step 2).

### What should be done in the future
- Resolve `project_uuid` to a project name once a projects list is available.

### Code review instructions
- Read `design/01-...guide.md` end to end; it is the spec for Steps 2–3.

### Technical details
- Real `meta.json` keys: `uuid, name, model, created_at, updated_at, project_uuid, artifacts[{file,path,bytes,source}], warnings[]`.

## Step 2: Ingest export meta.json (feature 1)

Made every artifact under `<uuid>/artifacts/` inherit its conversation's identity
by reading the sibling `<uuid>/meta.json`. This is what turns a wall of `App`
titles into real, dated, project-tagged entries and gives feature 2 something
worth filtering on.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement feature 1 — associate each exported artifact with its conversation's meta.json and enrich the artifact with title/project/model/dates/warnings/transcript link; keep non-export artifacts unchanged.

**Inferred user intent:** Browsable, meaningfully-labeled artifacts.

**Commit (code):** bf867ce — "feat: ingest conversation export meta.json (SERVE-20260713-METASEARCH task 1)"

### What I did
- Added provenance fields to `artifacts.Artifact` (`FromExport`, `SourceConversationUUID/Title`, `Project`, `Model`, `ConversationCreatedAt/UpdatedAt`, `TranscriptPath`, `ClaudeURL`, `Warnings`).
- New `pkg/artifacts/export_meta.go` (`exportMeta` struct, `loadExportMeta`, `dateOnly`).
- Wired `lookupExportMeta` (cached per conversation dir, misses included) + `enrichFromExportMeta` into `Scan()`, applied before the manifest overlay.
- Enriched `SearchDocument` (project, model, source_uuid, updated_at, warnings_count) and folded conversation title/project/model into `search_text`.
- Tests in `export_meta_test.go`; ran `go test ./...`.

### Why
- The association is a pure function of the on-disk layout, so it needs no configuration and works the moment you point the server at an export directory.

### What worked
- `serve-artifacts list --dir ~/Downloads/claude-downloads` shows conversation titles ("React dynamic windows UI for metrics", "Browser-based JavaScript IDE with AST parser") instead of `App`.
- All three tests pass (ingest, manifest-title-wins, no-meta-keeps-derived-title).

### What didn't work
- Editor diagnostics reported `undefined: ArtifactLink/isManifestFile/...` — stale gopls (the module is outside the workspace); `go build`/`go test` were clean. Ignored.

### What I learned
- Applying meta.json enrichment *before* the manifest overlay makes the precedence fall out naturally: the manifest overlay runs last and still wins.

### What was tricky to build
- Title precedence. Symptom: naively setting `Title = meta.name` would clobber an explicit manifest title. Cause: two metadata sources with different priority. Solution: set the derived title, then override with `meta.name` only, then let the existing manifest overlay run afterwards (so manifest > meta > derived).

### What warrants a second pair of eyes
- The `<uuid>/artifacts/<file>` → `<uuid>/meta.json` path logic in `lookupExportMeta` (relies on the parent dir being literally named `artifacts`).

### What should be done in the future
- Resolve `project_uuid` → project name (needs the projects list; the current export has null projects anyway).

### Code review instructions
- Start at `pkg/artifacts/scanner.go` (`Scan`, `lookupExportMeta`, `enrichFromExportMeta`) and `pkg/artifacts/export_meta.go`.
- Validate: `go test ./pkg/artifacts/` and `./serve-artifacts list --dir ~/Downloads/claude-downloads --output json`.

### Technical details
- `enrichFromExportMeta` sets `OriginalDate` from `dateOnly(created_at)` only when empty, and `Title = meta.Name` only when non-blank.

## Step 3: Search & discovery over a cached index (feature 2)

Replaced the browser-side substring filter with real server-side search: a cached
in-memory index over metadata + source + transcript, faceted filtering, and
sorting, exposed via `GET /search` and a rebuilt UI.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement feature 2 — full-text (including source/transcript), facets (type/project/model/tag/library/warnings), and sort, with a UI, scaling past a flat client-side filter.

**Inferred user intent:** Find and organize among thousands of artifacts.

**Commit (code):** 1ceeac4 — "feat: search & discovery over a cached index (SERVE-20260713-METASEARCH task 2)"

### What I did
- New `pkg/server/index.go`: `searchIndex` (RWMutex), `rebuild()` (scan + read source/transcript into a lowercased haystack + extract libraries), `search(query)` (filters, facets, sort, paging), `extractLibraries`/`packageRoot`.
- Added an `onChange` hook to the watcher (`pkg/server/watcher.go`), invoked in `broadcast()`, so the index rebuilds on file change.
- Built the index at `Run()` start; added `handleSearch` (`GET /search`), and switched `handleIndex` and `/search-index.json` to read the cached index.
- Rewrote `templates/index.html` into a search-driven UI (search box, sort, facet sidebar with counts, clickable tags, warning badges, load-more).
- Tests in `index_test.go`; ran `go test ./...`; verified live in a browser via Playwright.

### Why
- Full-text over source requires reading every file; doing it server-side over a cached index keeps the client payload small and removes the per-request scan.

### What worked
- `/search` returns correct totals and facets; `q=recharts` matches the one artifact that imports recharts in source (full-text over code works).
- Browser UI renders 21 cards + facet sidebar; typing "calendar" → 2 results, clicking the `html` facet → 3.

### What didn't work
- First `go test` failed to compile: `index_test.go:87: redundant and: r.Facets[...] != 0 && r.Facets[...] != 0` — a leftover dead assertion. Removed the block; tests passed.

### What I learned
- Correct faceting requires counting each facet against the results filtered by all *other* dimensions, otherwise selecting a value zeroes out its siblings.

### What was tricky to build
- Facet counts. Symptom: selecting `type=jsx` would make the type facet show only `jsx`, hiding `html` and making it un-unselectable. Cause: counting a facet under its own filter. Solution: `matches(entry, q, skip)` takes a dimension to ignore; each facet is counted with `skip` set to itself, results with `skip=""`. Verified by `TestFacetExcludesOwnDimension`.

### What warrants a second pair of eyes
- Memory footprint: the index holds every artifact's lowercased source and transcript in RAM. Fine for thousands (tens of MB); a very large library wants the SQLite/FTS foundation instead.
- Concurrency: `rebuild()` swaps the slice under `Lock`; reads take `RLock`. Confirm no reader holds a reference across a rebuild (it copies out under the lock).

### What should be done in the future
- Move to a persistent SQLite/FTS index (improvements-for-scale §0) for very large libraries.
- Make the fsnotify watcher recursive; it currently watches only the top-level dir, so nested export changes won't trigger a rebuild.

### Code review instructions
- Start at `pkg/server/index.go` (`search`, `matches`, `sortEntries`, `extractLibraries`) and `handleSearch` in `pkg/server/server.go`.
- Validate: `go test ./pkg/server/`; then `serve --dir ~/Downloads/claude-downloads` and `curl '/search?q=recharts'`, `curl '/search?type=html'`.

### Technical details
- `GET /search?q=&type=&project=&model=&tag=&library=&warnings=&sort=&limit=&offset=` → `{total, results:[SearchDocument], facets:{type,project,model,library,tag}}`.
- Library facet from `from ['"]([^./][^'"]*)['"]`, dropping `react*`, reducing to package root (`@scope/pkg`).

## Step 4: Remove the window chrome CSS

Stripped the retro "classic Mac" window frame from the index UI in response to a
direct request, leaving a plain white centered layout.

### Prompt Context

**User prompt (verbatim):** "remove the window chrome CSS"

**Assistant interpretation:** Delete the `.window`/`.titlebar`/`.close-box` framing (and the gray desktop background) from `index.html`, keeping the functional content.

**Inferred user intent:** A cleaner, un-skinned page.

**Commit (code):** 1ceeac4 — folded into the feature 2 commit.

### What I did
- Removed the `.window`/`.titlebar`/`.close-box`/`.title` CSS and the gray `repeating-linear-gradient` desktop background; body is now white and `.content` is a centered `max-width` container.
- Removed the `<div class="window">`/`<div class="titlebar">` markup and the orphaned closing `</div>`.
- Rebuilt, restarted, verified live.

### Why
- Direct user request.

### What worked
- Served HTML contains no `.window`/`.titlebar`; body background is white; 21 cards + facets still render and filter.

### What didn't work
- Removing the opening wrappers left an unbalanced `</div>`; fixed by deleting the trailing one.

### What I learned
- N/A.

### What was tricky to build
- N/A (mechanical markup/CSS removal); the only sharp edge was tag balance after deleting the wrappers.

### What warrants a second pair of eyes
- N/A.

### What should be done in the future
- N/A.

### Code review instructions
- Diff `pkg/server/templates/index.html`; load `http://localhost:8099/` and confirm no window frame and the grid still renders.

### Technical details
- N/A.
