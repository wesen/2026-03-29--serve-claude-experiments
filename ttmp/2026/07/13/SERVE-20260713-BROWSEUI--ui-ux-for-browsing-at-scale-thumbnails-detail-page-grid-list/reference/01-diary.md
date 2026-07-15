---
Title: Diary
Ticket: SERVE-20260713-BROWSEUI
Status: active
Topics:
    - serve-artifacts
    - ui
    - thumbnails
    - browsing
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: cmd/serve-artifacts/cmds/serve.go
    - Path: pkg/server/index.go
    - Path: pkg/server/search.go
    - Path: pkg/server/server.go
    - Path: pkg/server/templates/artifact.html
    - Path: pkg/server/templates/index.html
    - Path: pkg/server/thumbnail.go
    - Path: repo://pkg/server/templates/jsx-host.html
      Note: Tailwind + embed-nav gating (Steps 9,10)
    - Path: repo://pkg/userdata/store.go
      Note: ErrCollectionNotFound sentinel (Step 12)
ExternalSources: []
Summary: 'Implementation diary for the visual-browsing layer of serve-artifacts: content hash, thumbnail service (chromedp render, content-hash cache, bounded pool + singleflight), lazy gallery, background backfill + renderOK, artifact detail page, grid/list toggle, and follow-on polish.'
LastUpdated: 2026-07-14T00:00:00Z
WhatFor: Record the step-by-step implementation of the BROWSEUI ticket (thumbnails, detail page, grid/list).
WhenToUse: Read before resuming or reviewing the BROWSEUI implementation.
---


# Diary

## Goal

Capture the step-by-step implementation of the BROWSEUI ticket: the visual-browsing layer of `serve-artifacts`. The plan follows the design guide's implementation sequence (§VI): (1) content hash, (2) thumbnail service, (3) gallery UI, (4) backfill + renderOK, (5) detail page, (6) grid/list toggle, (7) follow-ons. Each step is committed independently; this diary records intent, what changed, what was tricky, and how to review.

## Step 1: Content hash on the index and SearchDocument

The thumbnail cache is keyed by content, not by name, so that an edited artifact automatically gets a fresh (missing) thumbnail with no explicit invalidation. This step adds a stable content hash to each indexed artifact and threads it out to the JSON that the front end and the thumbnail endpoint consume. It is deliberately small and unblocks everything downstream.

### Prompt Context

**User prompt (verbatim):** "Implement docmgr ticket ttmp/2026/07/13/SERVE-20260713-BROWSEUI" — followed by: "Keep a detailed diary as you work (see skill for diary format), and commit at appropriate itnervals"

**Assistant interpretation:** Implement the BROWSEUI ticket end to end (thumbnails, detail page, grid/list, follow-ons) per the design guide, keeping a strict-format diary and committing per step.

**Inferred user intent:** Turn the already-written design guide into working, reviewed, committed code, with a durable record of the implementation journey.

**Commit (code):** 2a68d2c — "feat: content hash on index + SearchDocument (SERVE-20260713-BROWSEUI task 1)"

### What I did
- Added `contentHash(body string) string` in `pkg/server/index.go` — `sha256` truncated to 16 hex chars.
- Added a `hash` field to `indexEntry`, populated in `rebuild()` from the body it already reads.
- Added `searchIndex.hashByName(name) (string, bool)` so `/thumb` can resolve a cache key from memory without rescanning.
- Set `d.Hash = e.hash` when building result docs in `search()`.
- Added `Hash string` and `RenderOK *bool` (nil until rendered) to `SearchDocument` in `pkg/server/search.go`.

### Why
- Content-addressed thumbnails invalidate themselves: the path is `<thumbs>/<hash>.png`, so a changed artifact points at a path that does not exist yet and regenerates. No cache-busting code is needed.
- `hashByName` keeps the `/thumb` handler off the scanner's per-request `Scan()` path.

### What worked
- `go build ./...` and `go test ./pkg/... -count=1` both green; no existing test needed changes because the new fields are additive and `omitempty`.

### What didn't work
- N/A — clean step.

### What I learned
- `rebuild()` already reads every artifact body for the haystack, so hashing is free there; computing it anywhere else would re-read files.

### What was tricky to build
- Nothing structurally tricky. The only judgment call was where to expose the hash: I chose to enrich the doc in `search()` (like `Favorite`/`Tags` already are) rather than inside `buildSearchDocument(a Artifact)`, because the hash lives on the `indexEntry`, not the `Artifact`.

### What warrants a second pair of eyes
- Hash length (16 hex = 64 bits). Collision risk across a few thousand artifacts is negligible; flagged only for completeness.

### What should be done in the future
- `RenderOK` is declared here but not populated until Step 4.

### Code review instructions
- Start at `pkg/server/index.go`: `contentHash`, `indexEntry.hash`, `hashByName`, and the `d.Hash = e.hash` line in `search()`.
- Validate: `go test ./pkg/... -count=1`; `curl localhost:PORT/search | jq '.results[0].hash'` returns a 16-char hex string.

### Technical details
- `contentHash`: `sum := sha256.Sum256([]byte(body)); return hex.EncodeToString(sum[:])[:16]`.

## Step 2: Thumbnail service (chromedp render, content-hash cache, bounded pool + singleflight)

This is the core of the ticket. A thumbnail is a screenshot of the artifact actually running, so generating one means driving a headless browser to `/view/<name>`, waiting for the component to mount, screenshotting, downscaling, and caching the PNG by content hash. The service adds `GET /thumb/{name...}` backed by a `thumbCache` (disk cache + bounded worker pool + singleflight) and a `chromedpEngine` behind a `Thumbnailer` interface. It also captures console errors to compute a `renderOK` bit and runs a startup background backfill — folding in the design's Step 4, since backfill and renderOK are the same subsystem.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Build the thumbnail generation/caching subsystem and its endpoint, with the concurrency protections the design mandates.

**Inferred user intent:** A gallery that scales to thousands of artifacts, where each artifact shows a real picture of itself, generated safely and only once.

**Commit (code):** 56f57d0 — "feat: thumbnail service — chromedp render, content-hash cache, bounded pool + singleflight (tasks 2+4)"

### What I did
- Added `pkg/server/thumbnail.go`: `Thumbnailer` interface (`Render(ctx, viewURL, hash) ([]byte, bool, error)` + `Close()`), `chromedpEngine` (a lazily-started long-lived headless Chrome, a fresh tab per render), and `thumbCache` (`get`, `cachedPath`, `renderStatus`, atomic writes, `downscalePNG` via `x/image/draw`, a lazy placeholder PNG, `defaultThumbsDir`, `defaultThumbConcurrency`).
- Wired into `server.go`: `thumbs *thumbCache` field, `Config.ThumbsDir`/`NoThumbs`, `handleThumb` (ETag = content hash → 304), `backfillThumbnails`, `renderStatus` enrichment of `SearchDocument.RenderOK` in `handleSearch`, engine `Close()` on shutdown.
- Added `--thumbs` and `--no-thumbnails` flags to `serve.go`.
- Added `go get github.com/chromedp/chromedp`; `go mod tidy`.
- Unit-tested cache/singleflight/error/downscale with a fake engine (`thumbnail_test.go`).

### Why
- **Content-hash key**: self-invalidating cache (Step 1).
- **Singleflight + semaphore**: a gallery of 60 cards requesting one missing thumbnail must trigger exactly one render, and total concurrent renders must be bounded (each is a headless page).
- **Long-lived browser, tab per render**: launching Chrome per render is far slower; a shared browser with a fresh tab per screenshot amortizes startup.
- **Graceful degradation**: `/thumb` serves a placeholder (never an HTTP error) when Chrome is missing or a render fails, so the gallery still loads.

### What worked
- Live smoke test: `/thumb/<jsx artifact>` returned a 480×302 PNG (84 KB), ETag revalidation returned 304, `render_ok=true` propagated to `/search`, and the backfill rendered artifacts in the background. `go test ./... -count=1` green.

### What didn't work
- First `go build` after adding the import failed: `runtime redeclared in this block` — I imported both stdlib `runtime` (for `GOMAXPROCS`) and `github.com/chromedp/cdproto/runtime` (for console events). Fixed by aliasing the cdproto import as `cdpruntime`.
- `go build` also initially reported `updates to go.mod needed; to update it: go mod tidy` — resolved by running `go mod tidy`.

### What I learned
- chromedp's `chromedp.Poll` with `WithPollingTimeout` is a clean way to wait for a mount condition (`#root` has children for JSX, or no `#root` for HTML) without hard-coding a sleep; on timeout it errors, so it must be run in its own best-effort `chromedp.Run` whose error is ignored before the screenshot.

### What was tricky to build
- **Context parenting.** A render tab must be parented to the *browser* context (so it reuses the running Chrome), but must also honor the caller's timeout/cancel context. Parenting to the caller's ctx would spawn a new browser; parenting only to the browser ignores cancellation. Solution: `chromedp.NewContext(browserCtx)` for the tab, then `context.AfterFunc(ctx, cancelTab)` to propagate the caller's cancellation/timeout onto the tab. Symptom before the fix was a confused triple-nested context that would have leaked or ignored timeouts.
- **Re-check inside the flight.** `singleflight.Do` collapses concurrent calls, but a *sequential* second caller could still race a just-finished writer; the flight body re-checks `cachedPath` before rendering so a duplicate never double-renders.

### What warrants a second pair of eyes
- The `chromedpEngine` context/cancellation logic (`start` once, tab-per-render, `AfterFunc`) — concurrency-critical.
- `renderOK` is stored in an in-memory `map[hash]bool` only for hashes rendered this run; it is not persisted, so `render_ok` is nil until an artifact is rendered. That is intentional (the backfill warms it) but worth confirming it matches the intended §6 semantics.
- The runtime Chrome dependency and the JSX network dependency (React/esm.sh + Babel/unpkg at render time) — documented, but a fully offline deployment needs vendored React/Babel.

### What should be done in the future
- Persist `renderOK` (e.g. a sidecar or the user DB) so a "broken" facet survives restart without re-rendering.
- Optionally vendor React/Babel and localize the import map for offline thumbnailing.

### Code review instructions
- Start at `pkg/server/thumbnail.go`: `thumbCache.get` (cache→singleflight→sem→render→downscale→atomic write) and `chromedpEngine.Render` (context parenting, console capture, mount poll, screenshot).
- Then `server.go`: `handleThumb`, `backfillThumbnails`, the `New()` construction, and the `RenderOK` enrichment in `handleSearch`.
- Validate: `go test ./pkg/server/ -run 'Thumb|Downscale' -v`; live: start the server and `curl -o t.png localhost:PORT/thumb/<name>` then check it's a PNG; `curl -H 'If-None-Match: "<hash>"' ...` returns 304.

### Technical details
- Cache path: `<thumbs>/<hash>.png`; render viewport 1200×900; downscaled to 480px wide (CatmullRom).
- Concurrency: `min(4, GOMAXPROCS)` semaphore + `singleflight.Group` keyed by hash.

## Step 3: Gallery thumbnails on cards (lazy load + skeleton)

With the endpoint in place, the front end shows a thumbnail on each result card. `loading="lazy"` on the `<img>` means the browser only requests thumbnails for cards near the viewport, which pairs naturally with lazy server-side generation: a thumbnail is rendered the first time it scrolls into view. A shimmer skeleton shows until the image loads.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Add thumbnail images to the existing search cards with a lazy-load + placeholder pattern.

**Inferred user intent:** Make the library browsable at a glance rather than by reading titles.

**Commit (code):** 55358e9 — "feat: gallery thumbnails on cards with lazy load + skeleton (task 3)"

### What I did
- `templates/index.html`: added a `.thumb-wrap` anchor with `<img class='thumb' loading='lazy' src='/thumb/<name>'>` at the top of each card; CSS for a fixed 150px thumbnail band (`object-fit: cover; object-position: top`) plus a `shimmer` skeleton animation removed on `load`/`error`.

### Why
- `loading="lazy"` + lazy generation keeps both the DOM/network and the render pool bounded while scrolling.
- `object-fit: cover` with a fixed band gives uniform cards despite artifacts having different aspect ratios; top-anchoring shows the most representative part.

### What worked
- Playwright screenshot showed real thumbnails on warmed cards and shimmer skeletons on still-generating ones; only console noise was a pre-existing `favicon.ico` 404.

### What didn't work
- N/A.

### What I learned
- Names contain slashes (`<uuid>/artifacts/<file>`); the thumbnail URL must encode each path segment separately (`name.split('/').map(encodeURIComponent).join('/')`) so slashes stay as path separators.

### What was tricky to build
- Nothing structurally; the encoding detail above was the only sharp edge.

### What warrants a second pair of eyes
- The fixed 150px band + `object-position: top` is an aesthetic choice; confirm it reads well across artifact types.

### What should be done in the future
- N/A (superseded by Step 6, which shares the thumbnail helpers).

### Code review instructions
- `templates/index.html`: the `thumb` markup in `buildCard` and the `.thumb-wrap`/`.thumb`/`shimmer` CSS.

### Technical details
- Skeleton: `linear-gradient` background with `background-size: 400% 100%` animated by `@keyframes shimmer`.

## Step 5: Artifact detail page

The detail page (`GET /artifact/{name...}`) is a page *about* one artifact, distinct from `/view` (the artifact itself). It shows a live preview (an iframe of `/view`) beside a metadata panel — favorite, tags, collections, claude.ai and transcript links, reconstruction warnings — and the full source below. All dynamic data comes from a new `GET /api/artifact/{name...}` so the page reuses the same per-user enrichment the search results use. (Design Step 4's backfill/renderOK already shipped in Step 2, so this is design Step 5.)

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Build the single-artifact detail page and its supporting JSON endpoint, reusing the organization controls.

**Inferred user intent:** A place to inspect one artifact in depth — preview, metadata, provenance, and source — without leaving the app.

**Commit (code):** f129d32 — "feat: artifact detail page (task 5)"

### What I did
- `server.go`: `handleArtifactPage`, `handleArtifactJSON` (enriches the doc with favorite/user-tags/render status + transcript availability, claude URL, size, project, created), `handleTranscript` (serves the ingested `conversation.md`), `mergeTags` helper; parsed a new `artifactTemplate`.
- Added `templates/artifact.html`: two-column layout (iframe preview + metadata/actions/tags/collections panel), source `<pre>` fetched from `/raw`, watch-mode reload script.
- `templates/index.html`: card thumbnail and title now link to `/artifact/<name>` (the "view" link still opens the runnable artifact).

### Why
- A dedicated `/api/artifact` endpoint is cleaner than having the page re-run `/search` and filter.
- A dedicated `/transcript` endpoint avoids fragile client-side path munging to locate `conversation.md` (which is not an artifact and so isn't reachable via `/raw`).

### What worked
- Playwright: the page rendered the live residua-studio artifact in the iframe, a full metadata panel (type/model/dates/size/file), tags + collections controls, and the JSX source below. 0 console errors.

### What didn't work
- My first transcript link built the URL with `enc.replace(/[^/]+$/, "") + "conversation"`, which pointed at `<uuid>/artifacts/conversation` — wrong (the transcript is at `<uuid>/conversation.md`) and unreachable via `/raw`. Replaced with the dedicated `/transcript/<name>` endpoint that resolves `art.TranscriptPath`.

### What I learned
- Passing the artifact name to page JS via a `data-name` body attribute is safe under `html/template` (attribute-context escaping) and avoids embedding it in a script string.

### What was tricky to build
- Source highlighting: I chose a plain escaped `<pre>` over pulling a client-side highlighter (or server-side `chroma`) to keep the page dependency-free and offline-safe. Documented as a possible future upgrade.

### What warrants a second pair of eyes
- `handleArtifactJSON` re-scans via `scanner.FindByName` (per-request `Scan()`); acceptable for a single detail view but note it does not use the in-memory index for the base artifact lookup.

### What should be done in the future
- Optional syntax highlighting (server-side `chroma` or a vendored client highlighter).
- Dark-mode styling for `artifact.html` (Step 7 themed the index page only).

### Code review instructions
- `server.go`: `handleArtifactPage`/`handleArtifactJSON`/`handleTranscript`/`mergeTags`.
- `templates/artifact.html`: the `load()` fetch of `/api/artifact` and the metadata/tag rendering.
- Validate: `curl localhost:PORT/api/artifact/<name> | jq`; open `/artifact/<name>` and confirm preview + metadata + source.

### Technical details
- `/api/artifact` returns `{artifact: SearchDocument, has_transcript, claude_url, warnings, size, project, created_at}`.

## Step 6: Grid/list view toggle

A `grid | list` toggle in the toolbar, persisted in `localStorage`. Grid is the thumbnail-card layout; list is a compact table (thumbnail, title, type, model, date, size, favorite) that is denser for scanning by name. `renderCards` became a dispatcher over `buildCard`/`buildRow` sharing the thumbnail-URL and lazy-load helpers.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Add a view-mode switch with a compact list alternative to the card grid.

**Inferred user intent:** Support both at-a-glance browsing (grid) and dense scanning (list).

**Commit (code):** b51fea5 — "feat: grid/list view toggle (task 6)"

### What I did
- `search.go`: added `Size` to `SearchDocument` (fed by `a.Size`) for the list's size column.
- `templates/index.html`: `state.view` (+ `localStorage`), toolbar toggle buttons, list-mode CSS (`.grid.list`, `.row`, `.rthumb`), extracted `buildCard`/`buildRow` from `renderCards`, shared `detailURLFor`/`thumbURLFor`/`wireThumb` helpers.

### Why
- Reusing the `#grid` container with a `.list` modifier class keeps one render path and one "Load more" pager for both modes.

### What worked
- Playwright: toggling to list produced compact rows with small thumbnails and aligned columns; the active button highlighted; state persisted across reloads.

### What didn't work
- N/A.

### What I learned
- Extracting the shared thumbnail helpers first made the card/row split small and avoided duplicating the slash-segment URL encoding.

### What was tricky to build
- The list row is a CSS grid with fixed track sizes; `min-width: 0` on the title cell is required so long titles ellipsize instead of overflowing the row.

### What warrants a second pair of eyes
- The `.row` `grid-template-columns` track widths are hand-tuned; confirm they hold for long models/titles.

### What should be done in the future
- N/A.

### Code review instructions
- `templates/index.html`: `renderCards` dispatcher, `buildRow`, the `.grid.list`/`.row` CSS, and `setView`.

### Technical details
- List columns: `56px minmax(0,1fr) 52px 120px 90px 70px 20px` (thumb, title, type, model, date, size, star).

## Step 7: Follow-ons — dark mode, command palette, keyboard navigation

The three lighter polish features. Dark mode is a theme toggle persisted in `localStorage`, applied via a `body.dark` class with targeted overrides. The command palette (⌘K) is a modal that runs `/search` and jumps to an artifact's detail page by keyboard. Keyboard navigation adds `/` (focus search), `j`/`k` (move selection), `o`/`Enter` (open), `f` (favorite), and `d` (toggle theme).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement the optional command palette, keyboard nav, and dark mode.

**Inferred user intent:** Power-user ergonomics and comfortable long browsing sessions.

**Commit (code):** 786da71 — "feat: follow-ons — dark mode, command palette, keyboard nav (task 7)"

### What I did
- `templates/index.html`: theme toggle button + `body.dark` overrides + `localStorage`; palette overlay markup + `openPalette`/`palQuery`/`renderPalette`/`gotoResult` + input keydown (↑/↓/Enter/Esc); a global `keydown` handler for `/`, `j`/`k`, `o`/`Enter`, `f`, `d`, and ⌘K/Ctrl-K; `.selected` outline; `selIdx` reset on re-render.

### Why
- `body.dark` additive overrides avoided rewriting the entire hardcoded-color stylesheet into variables (lower risk for a "lighter" follow-on).
- The palette reuses `/search` (limit 8) rather than a new endpoint.

### What worked
- Playwright: dark mode restyled all main surfaces; the palette filtered to matching artifacts with the top result selected; 0 console errors.

### What didn't work
- N/A.

### What I learned
- Guarding the global keydown against `input`/`select`/`textarea` targets (and the open palette) is necessary so single-key shortcuts don't fire while the user types in the search box or a tag field.

### What was tricky to build
- Shortcut precedence: plain `k` moves the selection up, but ⌘K/Ctrl-K opens the palette. The handler checks the modifier combo first and returns before the plain-key branch, so the two never collide.

### What warrants a second pair of eyes
- After a re-render the selection index resets to -1 (nodes are replaced); confirm the `selIdx` reset in `renderCards` and the keydown bounds logic are correct.
- Dark mode is index-only; `artifact.html` is not themed.

### What should be done in the future
- Theme `artifact.html` (and share the theme decision across pages).
- Palette could also toggle facets (design mentions this), not just jump to artifacts.

### Code review instructions
- `templates/index.html`: the dark-mode block, the command-palette block, and the keyboard-navigation `keydown` handler near the end of the IIFE.
- Validate: open the page, press ⌘K and type; press `d` to toggle theme; use `j`/`k`/`o`.

### Technical details
- Theme persisted under `localStorage["theme"] = "dark"|"light"`; view under `localStorage["view"]`.

---

*The steps below were written retroactively after several rounds of follow-on work that extended the browsing experience past the original seven-step ticket (Docker packaging, detail-page enhancements, a Tailwind fidelity fix, transcript rendering, and organization/UX fixes). They are recorded here to keep one continuous diary for the serve-artifacts browsing surface; Steps 12–13 also touch the USERDATA feature (collections/tags).*

## Step 8: Self-contained Docker image with bundled headless Chrome

The thumbnail subsystem depends on a real browser at render time, so "install and run" would otherwise require the host to have Chrome. This step packages the server and its Chromium into one image so a host needs only Docker. The preceding discussion clarified *why* Chrome is a runtime (not import-time) dependency: a thumbnail is a screenshot of the artifact running via the server's own `/view`, so generation needs the serve pipeline plus a browser; serving an already-cached thumbnail needs neither. Putting Chrome in the image makes the "Chrome-free serving tier" question moot.

### Prompt Context

**User prompt (verbatim):** "why  chromium at runtime? wouldn't it only be needed on import?" — then: "ok, can we package it all as a self contained docker though, with all the dependencies setup?"

**Assistant interpretation:** Explain the runtime-vs-import Chrome dependency, then ship a Dockerfile that bundles everything (server + Chromium + fonts + certs) so nothing is installed on the host.

**Inferred user intent:** A one-command, reproducible deployment where thumbnails "just work" without host setup.

**Commit (code):** 7211a03 — "feat: self-contained Docker image with bundled headless Chrome"

### What I did
- Rewrote `Dockerfile` (the existing one targeted distroless, which has no Chrome): multi-stage, build on `golang:1.26-bookworm` with `CGO_ENABLED=1` (SQLite driver), keep the JSX precompile (`go generate ./pkg/server`), runtime on `debian:bookworm-slim` with `chromium`, `ca-certificates`, `fonts-liberation`, `fonts-noto-core`, `fonts-noto-color-emoji`, and `tini`.
- Added `docker-compose.yml`, `.dockerignore`, and `DOCKER.md`.
- Made Chrome container-safe in `pkg/server/thumbnail.go`: always pass `--disable-dev-shm-usage`; add a `noSandbox` field + `--no-sandbox` behind a `--chrome-no-sandbox` flag / `SERVE_ARTIFACTS_CHROME_NO_SANDBOX` env (`serve.go`, `server.go` `Config.ChromeNoSandbox`); the image sets the env.
- `/data` volume for the thumbnail cache and the SQLite DB; default `serve` command points there.

### Why
- Bookworm on both stages so the runtime glibc matches the cgo build's.
- `--disable-dev-shm-usage`: the default 64 MB `/dev/shm` in a container crashes Chrome on larger pages; setting it removes any `--shm-size` tuning.
- `--no-sandbox`: Chrome cannot sandbox as root inside a container; gated so it stays off on a normal host.

### What worked
- Verified end to end: the running container rendered a real 480×302 JSX thumbnail via its bundled Chromium 150, wrote thumbs + `userdata.db` to `/data`, and reported `render_ok=true`. Final image ~841 MB.

### What didn't work
- First `docker build` failed: `go: go.mod requires go >= 1.26 (running go 1.25.12; GOTOOLCHAIN=local)`. Cause: adding `chromedp` earlier raised the module's minimum Go to 1.26, but the Dockerfile used `golang:1.25-bookworm`. Fixed by bumping the build image to `golang:1.26-bookworm`.
- The failure was initially masked because I piped `docker build ... | tail -40`, so the shell reported the `tail` exit code (0), not the build's. Switched to redirecting to a log file and checking `EXIT=$?`.

### What I learned
- chromedp v0.15.1 pulls the module's Go directive to 1.26; any consumer (including the Docker build image) must match. This is a real minimum-version bump, not cosmetic.
- Piping a long-running command into `tail` hides its exit status; capture status separately.

### What was tricky to build
- Getting headless Chrome to run at all inside the container: two separate flags are needed (`--no-sandbox` for the root-sandbox restriction, `--disable-dev-shm-usage` for the tiny `/dev/shm`), and missing either yields a crash that looks like a render failure. Diagnosed by running the container and curling `/thumb` until it returned a real PNG rather than the placeholder.

### What warrants a second pair of eyes
- The glibc/cgo pairing (bookworm build ↔ bookworm-slim runtime); switching either base image risks a runtime linker error.
- Running Chrome as root with `--no-sandbox` inside the container is acceptable for a local viewer but is the usual security caveat; a hardened deployment would run non-root.

### What should be done in the future
- Optional vendoring of React/Babel/Tailwind + a localized import map for a fully offline image (JSX thumbnails currently need outbound HTTPS at render time).

### Code review instructions
- Start at `Dockerfile` (stages, apt packages, ENV) and `DOCKER.md`.
- `pkg/server/thumbnail.go`: `chromedpEngine.start` (the two container flags + conditional `NoSandbox`), `newChromedpEngine(noSandbox)`.
- Validate: `docker build -t serve-artifacts . && docker run -p 8080:8080 -v <artifacts>:/artifacts:ro -v <vol>:/data serve-artifacts`, then `curl -o t.png localhost:8080/thumb/<name>`.

### Technical details
- Default container command: `serve --dir /artifacts --port 8080 --thumbs /data/thumbs --db /data/userdata.db`.

## Step 9: Detail-page enhancements — embed view, highlighted/copyable/downloadable source, theater mode, session download

Four independent improvements to the artifact detail page, plus an up-front investigation the user asked for. The investigation confirmed the whole conversation is stored locally per directory (`conversation.json` = full raw API payload, `conversation.md` = rendered transcript, `meta.json`, `artifacts/`), so "download the entire session" needs no re-fetching. The four changes make the embedded preview clean, the source panel useful, the preview larger on demand, and the whole session downloadable.

### Prompt Context

**User prompt (verbatim):** "- remove the < Index from the "embedded view" on http://localhost:8099/artifact/517687de-6ed6-4c5b-8a97-483093cc4389/artifacts/attune-studio \n- add syntax highlighting + copy to clipboard + download button for the Source.\n- Add a "theater" mode that hides the action / metadata / tags sidebar for a bigger view (grow a bit vertically too to preserve ratio)\n- Allow downloading the entire session (conversation) as well (I'm not sure if that is already imported).\n\nBefore you start, tell me if we are importing and storing the entire conversation."

**Assistant interpretation:** Answer whether the full conversation is stored, then implement: (1) suppress the in-frame nav bar, (2) syntax-highlight the source with copy + download, (3) a theater toggle that hides the sidebar and enlarges the preview, (4) a whole-session download.

**Inferred user intent:** A polished, self-sufficient detail page for inspecting one artifact and exporting its full context.

**Commit (code):** f09d72b — "feat: detail-page — embed view (no nav), highlighted+copyable+downloadable source, theater mode, session download"

### What I did
- **Embed view**: `handleView` reads `?embed=1` and suppresses the floating back-to-index nav (HTML: skip the injected bar; JSX: `{{if not .Embed}}` in `jsx-host.html`). The detail-page iframe loads `/view/<name>?embed=1`; the standalone "open ▸" link omits it.
- **Source**: `GET /highlight/{name}` renders the source with chroma (inline styles via `WithClasses(false)`, self-contained). The page fetches `/highlight` for display and `/raw` for the raw text used by **Copy** (`navigator.clipboard`) and **Download** (a `Blob` saved as the real filename, passed via `data-filename`).
- **Theater mode**: a `▣ Theater` button (also `t` to toggle, `Esc` to exit) toggles `body.theater`, which hides `.panel`, makes `.layout` single-column, and grows `.preview` to `86vh`.
- **Session download**: `GET /session/{name}` streams the conversation directory as `<uuid>.zip` (`archive/zip`); the page shows `session ⬇` when `source_uuid` is present. Resolved the conversation dir from `art.TranscriptPath` (or `filepath.Dir(filepath.Dir(art.Path))` for export artifacts).

### Why
- A dedicated `/highlight` endpoint keeps the page self-contained (no CDN highlighter) and reuses chroma, already in the module graph.
- Keying copy/download off `/raw` keeps the raw bytes exact while the display is highlighted HTML.

### What worked
- Playwright confirmed all four: clean embedded preview (no nav), highlighted source with Copy/Download, theater hiding the sidebar and enlarging the preview, and a 52 KB `session.zip` containing both artifacts + `conversation.json` + `conversation.md` + `meta.json`. 0 console errors (only the favicon 404).

### What didn't work
- My session-zip smoke test reported `size=0` because the test script referenced `$SCRATCH` in the `curl -o` path *before* defining it, so the file was written to an unwritable path. A scripting bug, not a server bug — re-ran with `SCRATCH` defined first and got the 52 KB zip.

### What I learned
- Passing the artifact name to page JS via a `data-name`/`data-filename` body attribute is safe under `html/template` (attribute-context escaping) and avoids embedding it in a script string.

### What was tricky to build
- The session-dir resolution has two cases: normal exports have `TranscriptPath` set (so the dir is its parent), but an artifact could be `FromExport` without a transcript, in which case the dir is two levels up from `art.Path` (`<dir>/artifacts/<file>`). Handling only the first case would 404 valid sessions; I covered both and return 404 only for non-export artifacts.

### What warrants a second pair of eyes
- `handleSession` walks and zips a directory streamed straight to the client; confirm it can never escape the conversation dir (it only ever zips under a resolved `convDir` and uses `filepath.Rel`).
- `handleArtifactJSON`/detail handlers look up the base artifact via `scanner.FindByName` (a per-request `Scan()`), not the in-memory index — fine for a single page view, but noted.

### What should be done in the future
- Optional line numbers / a language label on the highlighted source; theming the detail page for dark mode (index-only today).

### Code review instructions
- `pkg/server/server.go`: `handleView` (embed), `handleHighlight`, `handleSession`.
- `pkg/server/templates/artifact.html`: the source fetch/copy/download block and the theater toggle; `jsx-host.html` `{{if not .Embed}}`.
- Validate: open `/artifact/<name>`, toggle theater, click Copy/Download; `curl -o s.zip localhost:PORT/session/<name> && unzip -l s.zip`.

### Technical details
- `/session` sets `Content-Disposition: attachment; filename="<uuid>.zip"`; `/highlight` returns a chroma `<pre>` with inline styles (github style).

## Step 10: Load Tailwind in the JSX host page (and version the thumbnail render environment)

A specific artifact rendered with a collapsed layout compared to claude.ai. The cause was Tailwind: many Claude JSX artifacts style themselves entirely with Tailwind utility classes, which the claude.ai runtime provides but our `/view` host page never loaded, so the classes were inert. Adding the Tailwind Play CDN to the host page restores fidelity. This also exposed a caching subtlety: changing the render environment does not change artifact content hashes, so cached thumbnails (and their content-hash ETags) would stay stale — fixed with a render-environment version folded into both the cache path and the ETag.

### Prompt Context

**User prompt (verbatim):** "http://localhost:8099/artifact/517687de-6ed6-4c5b-8a97-483093cc4389/artifacts/attune-studio \n\nThis one is odd because it seems to have a CSS issue or something, compared to how it looks in the claude.ai browser."

**Assistant interpretation:** Diagnose why this artifact looks unstyled here versus claude.ai and fix it.

**Inferred user intent:** Artifacts should render with the same fidelity as in the claude.ai app.

**Commit (code):** 8ddd2e5 — "fix: load Tailwind in the JSX host page so utility-class artifacts render like claude.ai"

### What I did
- Confirmed the cause: the source had 113 Tailwind utility-class tokens across 53 `className`s (`grep`), 0 styled-components/emotion, some inline styles — so the layout depends on Tailwind.
- Added `<script src="https://cdn.tailwindcss.com"></script>` to `jsx-host.html` (runtime JIT, DOM observer — styles React content added after mount).
- Added `renderEnvVersion = "tw1"` in `thumbnail.go`, folded into `pathFor` (`<hash>-<ver>.png`) and a new `etag(hash)`; `handleThumb` now uses `s.thumbs.etag(hash)`.

### Why
- The Play CDN is exactly how claude.ai supplies Tailwind to artifacts, and it matches the page's existing network dependencies (React from esm.sh, Babel from unpkg). Its preflight is also part of the claude.ai environment the artifact was authored against, so always loading it is *more* faithful.
- Content-hash thumbnails don't notice a render-env change; without a version, edited-environment thumbnails stay stale on disk and in the browser (ETag = content hash → 304).

### What worked
- Playwright showed the artifact rendering as its intended two-pane IDE (dark theme, code editor + room panel), matching claude.ai. 0 console errors (only Tailwind's "not for production" warning).

### What didn't work
- N/A (clean once the cause was identified).

### What I learned
- The thumbnail cache key must include everything that affects the rendered pixels, not just the artifact bytes — the render environment is part of the key. This generalizes: any future host-template change that alters output should bump `renderEnvVersion`.

### What was tricky to build
- The staleness was non-obvious: after adding Tailwind, the *live* detail-page iframe updated immediately (it re-renders `/view`), but gallery thumbnails would have silently stayed the old broken renders because their content hash is unchanged. Realizing the ETag (also content-hash-based) would serve stale bytes even after a disk regeneration led to versioning both the path and the ETag with one constant.

### What warrants a second pair of eyes
- `renderEnvVersion` is a manual constant — reviewers should confirm the intent that it is bumped on any output-affecting host/template change.

### What should be done in the future
- If an HTML artifact shows the same Tailwind-less symptom, decide whether to inject Tailwind into raw HTML artifacts too (currently only the JSX host page loads it).
- Offline: vendor Tailwind and localize it alongside React/Babel.

### Code review instructions
- `pkg/server/templates/jsx-host.html` (the CDN script); `pkg/server/thumbnail.go` (`renderEnvVersion`, `pathFor`, `etag`); `handleThumb` in `server.go`.
- Validate: open a Tailwind-using artifact's `/view`; confirm `/thumb` paths are `<hash>-tw1.png`.

### Technical details
- Bumping `renderEnvVersion` orphans old `<hash>.png`/`<hash>-tw*.png` files (harmless) and forces regeneration + browser refetch.

## Step 11: Render the transcript as HTML instead of raw markdown

`/transcript/{name}` served the raw `conversation.md` as `text/markdown`, which browsers download or show as plain text. This step renders it to a readable HTML page with goldmark (already in the module graph via glamour), so the transcript is pleasant to read in place.

### Prompt Context

**User prompt (verbatim):** "render transcript as markdown. then test also the collections functionality"

**Assistant interpretation:** Render the stored transcript markdown into a styled HTML reading view (and, separately, exercise collections — see Step 12).

**Inferred user intent:** Read a conversation transcript in the browser without it downloading as a `.md` file.

**Commit (code):** 7236139 — "feat: render the transcript as HTML (goldmark) instead of serving raw markdown"

### What I did
- Added `templates/transcript.html` (readable typography, turn headers styled, sticky nav bar with back-to-artifact / index / `session ⬇`).
- Rewrote `handleTranscript` to read `conversation.md`, convert with a `goldmark.Markdown` (GFM) held on the `Server`, and render the template with the body as `template.HTML`.
- Added `encodePathSegments` (url-escape each slash-separated segment) for path-safe URLs in the template.

### Why
- goldmark is already a dependency and self-contained (no CDN); GFM covers tables/etc. Raw HTML is left disabled (default), so the transcript can't inject markup.

### What worked
- Verified: `Content-Type: text/html`, `<h1>` title and `<h2>Human`/`<h2>Assistant` turn headers, tool-call markers (`_[create_file: ...]_`) rendered as gray italics. Playwright confirmed the styled reading view.

### What didn't work
- N/A.

### What I learned
- `template.HTML(body.String())` is safe here specifically because goldmark's default renderer escapes raw HTML in the source; enabling `WithUnsafe` would change that calculus.

### What was tricky to build
- Nothing structural; the main care was not enabling goldmark unsafe HTML while still injecting the rendered output as trusted `template.HTML`.

### What warrants a second pair of eyes
- The `template.HTML` injection point — confirm goldmark unsafe-HTML stays off so the transcript content can't smuggle markup.

### What should be done in the future
- Optionally syntax-highlight fenced code blocks inside the transcript (currently plain `<pre>`).

### Code review instructions
- `pkg/server/server.go`: `handleTranscript`, `encodePathSegments`, the `markdown` field + `goldmark.New(...WithExtensions(extension.GFM))`.
- `pkg/server/templates/transcript.html`.
- Validate: `curl -s localhost:PORT/transcript/<name> | grep '<h2>'`.

### Technical details
- Transcript nav links use `encodePathSegments(art.Name)` so multi-segment names stay path-correct.

## Step 12: Collections + tags — UX fixes surfaced by testing, footer restyle, and a 404 sentinel

The user asked to test collections (and, separately, to experiment with tags, and that the card footer looked bad). Exercising the features end to end surfaced three real defects plus the cosmetic complaint, all fixed here. This is the step where the diary had lapsed; testing is what caught the regressions.

### Prompt Context

**User prompt (verbatim):** "render transcript as markdown. then test also the collections functionality" — plus, mid-work: "also experiment with adding tags and such, btw" and "the -remove/+collection thing looks ugly af"

**Assistant interpretation:** Validate collections (create/add/filter/remove/delete) and tags (add/facet/filter/remove) end to end, fix anything broken, and clean up the ugly card footer.

**Inferred user intent:** Confirm the organization features actually work in the UI, and make the card actions look decent.

**Commit (code):** 9a9c080 — "fix(collections): restyle card footer, refresh UI on create/filter, 404 on missing collection"

### What I did
- **Footer restyle** (`index.html`): replaced the always-red "− remove" and full-size `＋ collection…` select with a clean split — left group (`view` / `claude.ai`), right group (a small `✕` remove + a compact bordered `＋ collection` select).
- **Create refresh**: creating a collection re-rendered the sidebar but not the cards, so a card's dropdown lacked the new collection until reload; now creation also calls `reload()`.
- **Filter refresh**: selecting a collection filtered results but left the sidebar unchanged (no active highlight, no "✕ show all"); added `setCollection(id)` that re-renders sidebar + results together, and routed the sidebar rows through it.
- **404 sentinel** (`userdata/store.go`): added `ErrCollectionNotFound`, returned from `AddToCollection`/`RemoveFromCollection`/`ReorderCollection` when the collection is missing/unowned; a new `collectionErr` helper in `server.go` maps it to 404 (was 500). Added `TestCollectionNotFoundSentinel` and extended the ownership test.

### Why
- A client asking to modify a nonexistent collection is a 4xx, not a server fault.
- The sidebar and card dropdowns both read the `collections` array and `state.collection`; any state change must re-render both to stay consistent.

### What worked
- API sequence verified: create → add two → filter (exactly those two) → count=2 → remove one (→1) → idempotent re-add (stays 1) → delete (cascade removes items). Error path now returns 404. Tags verified: add (API + card `+tag` input), idempotent, facet counts (`eink 2`, `demo 1`), filter, remove. Playwright confirmed the sidebar active/"show all" states and the clean footer.

### What didn't work
- First attempt at the create-refresh called `renderCards(lastResults, false)`, but `lastResults` doesn't exist (results aren't retained across "Load more" appends). Changed to `loadCollections().then(reload)`.
- Testing found the 500-on-missing-collection and the two stale-render gaps — these were the bugs, recorded here as the reason the step exists.

### What I learned
- The "add item to bad id → 500" only shows up when you actually drive the error path; the happy-path tests all passed. Adversarial API probing (bad ids, empty names, deleted collections) is what surfaced it.

### What was tricky to build
- The two stale-render bugs shared a root cause: mutations to collection state were calling `reload()` (which re-renders facets + cards) or `loadCollections()` (which re-renders the collections sidebar) but never both. The fix was to funnel collection-filter changes through one `setCollection()` that does both, and to have collection *creation* trigger a card re-render so dropdowns pick up the new option.

### What warrants a second pair of eyes
- `setCollection()` re-renders the sidebar from inside a click handler on a sidebar row it then replaces; confirm there's no stale-closure/double-handler issue (the click has already fired before the DOM is rebuilt).
- The `errors.Is(err, userdata.ErrCollectionNotFound)` mapping — confirm all three store methods wrap the sentinel with `%w`.

### What should be done in the future
- N/A beyond Step 13 (the tag double-render, split out below).

### Code review instructions
- `pkg/userdata/store.go`: `ErrCollectionNotFound` + the three `%w`-wrapped returns; `store_test.go` `TestCollectionNotFoundSentinel`.
- `pkg/server/server.go`: `collectionErr`, the item handlers.
- `pkg/server/templates/index.html`: `setCollection`, the create handler's `.then(reload)`, the `.links`/`.lg`/`.rg`/`.addcol`/`.rmcol` CSS and footer markup.
- Validate: `go test ./pkg/userdata/ -run Collection`; drive the API sequence above; `curl` an add to a missing id → 404.

### Technical details
- Item add/remove handlers: `POST` / `DELETE /api/collections/{id}/items` (DELETE reads `key` from the query, since Go `FormValue` doesn't parse DELETE bodies).

## Step 13: Show each tag once on a card

A user tag rendered twice on each card — once in the gray, filterable tag row and once as a removable blue chip — because the gray row drew `d.tags` (manifest ∪ user tags) while the editor row drew the user tags again. This step filters the gray row to manifest-only tags so each tag appears once.

### Prompt Context

**User prompt (verbatim):** "tags appear twice now (one with the X, one without the X) on each card."

**Assistant interpretation:** Deduplicate the card's tag display so a user tag shows only once (as its removable chip).

**Inferred user intent:** A clean tag display without visible duplication.

**Commit (code):** 638736c — "fix(index): show each tag once on a card (manifest-only in the gray row)"

### What I did
- In `buildCard` (`index.html`), built a case-insensitive set of `d.user_tags` and filtered `d.tags` down to manifest-only tags for the gray `.tag` row; user tags continue to render as removable `.utag` chips in the editor row.

### Why
- `d.tags` is `mergedTags` (manifest ∪ user, deduped case-insensitively) — good for the tag facet, but it means user tags also appear in the gray row, duplicating the editor row.

### What worked
- Playwright confirmed each card now renders a given user tag once (gray row empty for artifacts with no manifest tags; user tags only as `×` chips).

### What didn't work
- N/A.

### What I learned
- The detail page (`artifact.html` `renderTags`) already rendered each tag once (styling it user vs manifest); only the index card had two separate rows, hence the duplication was index-only.

### What was tricky to build
- The dedup must be case-insensitive because `mergedTags` dedups case-insensitively; comparing raw strings could keep a differently-cased duplicate.

### What warrants a second pair of eyes
- Confirm the gray (filterable) row still surfaces genuine manifest tags — the filter only removes tags that are in `user_tags`.

### What should be done in the future
- Consider unifying the two card rows into one (like the detail page), where user tags are both filterable and removable.

### Code review instructions
- `pkg/server/templates/index.html`: the `userSet`/`manifestTags` filter in `buildCard`.
- Validate: add a user tag to a card, confirm it appears once (as the `×` chip), and the tag facet still counts it.

### Technical details
- `manifestTags = d.tags.filter(t => !userSet[t.toLowerCase()])`.

## Step 14: Advanced search — query syntax and date-range filters

The search box gained a mini query language (`tag:`, `model:`, `type:`, `project:`, `library:`, `is:favorite`, `has:warnings`, `after:`/`before:` dates), and the index gained a date-range filter. The syntax is parsed server-side and merged with the explicit facet/date params the UI already sends, so typed filters and clicked facets compose. A `⚙` advanced panel adds date pickers and a syntax legend. This makes a now-large library (≈200 artifacts after the bulk import) navigable by precise queries rather than only facet clicks.

### Prompt Context

**User prompt (verbatim):** "Add advanced search with date range filters and search syntax (for tags, models, etc...)"

**Assistant interpretation:** Add a typed query syntax for field filters plus date-range filtering, wired into both the search box and a small advanced UI.

**Inferred user intent:** Precise, expressive filtering over a large library without clicking through facets.

**Commit (code):** 8daa80e — "feat: advanced search — query syntax (tag:/model:/type:/is:/has:) + date-range filters"

### What I did
- **Parser** (`pkg/server/query.go`): `parseSearchSyntax` → `parsedQuery` (tags, type, model, project, library, favorite, warnings, after, before, free text). `tokenizeQuery` keeps quoted spans together; `splitField` classifies `key:value`; unknown keys/URLs fall through to free text. `parseDateBound` (YYYY-MM-DD or RFC3339; upper bound → end of day). Helpers `firstNonEmpty`, `dedupeFold`.
- **Index** (`index.go`): `searchQuery.After/Before` (unix bounds) + a date check in `matches` against `e.sortTime`; it always applies (not a facet), so facet counts respect it.
- **handleSearch** (`server.go`): parse the box syntax, merge with `?tag/type/model/…/after/before` params (union tags; fill/override single-value; OR flags; dates via `firstNonEmpty` then `parseDateBound`).
- **UI** (`index.html`): `⚙` advanced toggle, After/Before `<input type=date>`, a syntax legend, a syntax-hinting placeholder; `state.after/before`, `qs()` params, clear-filters + `anyFilter` updated.
- Unit tests (`query_test.go`): syntax parse (incl. quoted tag and unknown/URL passthrough), date-bound end-of-day delta, dedupe.

### Why
- Parsing server-side keeps one filter path: whether a constraint arrives as a typed token or a facet param, it lands in the same `searchQuery`. The UI didn't need a client-side parser.
- Date range on `sortTime` (conversation updated/created, else file mtime) matches the "Recent" sort's notion of an artifact's date.

### What worked
- Live: `model:claude-fable-5 type:jsx` → 16, all matching; `tag:eink` → 1; `after=2026-07-04` → dates 2026-07-06…07-14; `before:2026-06-01` → max date 2026-05-29. UI panel shows date pickers + legend; facets reflect the filtered set. All package tests green.

### What didn't work
- N/A (clean; the parser's quote/colon edge cases were covered by tests up front).

### What was tricky to build
- Not swallowing ordinary colon-bearing terms (URLs like `https://…`, `foo:bar`) as filters. Solved by only treating a *known* key set as fields and routing everything else — including unknown `key:value` — to free text, with a test (`TestParseSearchSyntaxLeavesUnknownAndColonTermsAsText`) pinning it.
- Merge precedence between typed syntax and UI params for single-value fields: chose "syntax wins if present, else the param" via `firstNonEmpty`, and union for tags; documented so the behavior is intentional, not incidental.

### What warrants a second pair of eyes
- The merge rules in `handleSearch` (single-value override vs multi-value union vs flag OR) — confirm they match intended UX when a user both types `type:jsx` and clicks the `html` facet (syntax wins).
- `before:` inclusivity: the upper bound is pushed to 23:59:59 so `before:D` includes all of day D; confirm that is the desired semantics.

### What should be done in the future
- Reflect typed filters back into the sidebar's active-facet highlights (today a `tag:` typed in the box filters correctly but doesn't light up the tag facet).
- Consider `model:` / `tag:` value autocomplete in the box.

### Code review instructions
- `pkg/server/query.go` (+ `query_test.go`): the parser and date bounds.
- `pkg/server/index.go`: `searchQuery.After/Before` and the `matches` date check.
- `pkg/server/server.go`: the merge in `handleSearch`.
- `pkg/server/templates/index.html`: the `⚙` panel, date inputs, `qs()`/`clear`/`anyFilter`.
- Validate: `go test ./pkg/server/ -run 'ParseSearch|ParseDate|Dedupe'`; `curl -G localhost:PORT/search --data-urlencode 'q=model:x type:jsx'`; `curl 'localhost:PORT/search?after=YYYY-MM-DD'`.

### Technical details
- Recognized keys: `tag/tags`, `type`, `model`, `project/proj`, `library/lib`, `after/since`, `before/until`, `is:(favorite|favorited|fav|starred)`, `has:(warnings|warning|warn)`.

## Step 15: Recapture the thumbnail from the live view (or re-render server-side)

The auto thumbnail is a screenshot of the artifact's *initial* state, which is often mediocre (blank, still loading, or a boring first frame). This step lets a viewer replace it: a Thumbnail box on the detail page with a live preview and two actions — capture the current iframe (the state you interacted it into) client-side, or ask the server for a fresh headless-Chrome re-render.

### Prompt Context

**User prompt (verbatim):** "- add the functionality to update the screenshot when interacting with the artifact, in case the base screenshot is mediocre (maybe with some keypress or so, or a button next to it). \n- keep track of how far one has scrolled in the url so that going back puts you back at where you scrolled."

**Assistant interpretation:** Provide a way (button/keypress) to update an artifact's thumbnail to a better frame, ideally the current interacted view (this step); and preserve gallery scroll across Back (Step 16).

**Inferred user intent:** Curate good-looking thumbnails, and not lose your place when browsing a large library.

**Commit (code):** a79f027 — "feat: recapture artifact thumbnail from the live view (or re-render server-side)"

### What I did
- `pkg/server/thumbnail.go`: `saveUploaded(hash, data)` (validate PNG → downscale → write to the cache path, mark renderOK) and `invalidate(hash)` (delete cached file + clear renderOK).
- `pkg/server/server.go`: `thumbHash(name)` (index-or-file hash), `handleThumbSave` (`POST /thumb/{name}`, 25 MB cap, stores the uploaded PNG) and `handleThumbRerender` (`POST /api/thumb/rerender/{name}`, invalidate then `get` to render fresh).
- `pkg/server/templates/artifact.html`: html2canvas from CDN; a Thumbnail box (preview `<img>` + `📸 capture view` + `↻ re-render` + status line); `setThumbFromView` (html2canvas of the iframe's `body` at current scroll → `toBlob` → POST), `rerenderThumb`, `refreshThumbPreview` (cache-buster); `c` key bound to capture.

### Why
- Client capture matches "when interacting" — it rasterizes exactly what's on screen. Server re-render is the reliable fallback (real Chrome captures WebGL; client html2canvas cannot).
- Writing a saved thumbnail to the normal cache path means the backfill (which only renders *missing* thumbnails) never overwrites it.

### What worked
- API: `POST /thumb` with a 600×400 PNG → served back downscaled to 480×320 with the exact uploaded color; non-PNG → 400; `POST /api/thumb/rerender` → `{ok:true}`. UI: capturing the s3paper studio iframe produced a faithful thumbnail of the "Hello, ink." device view; preview refreshed; message "thumbnail updated ✓ (from this view)". 0 console errors.

### What didn't work
- N/A in the end. (I deliberately set html2canvas `allowTaint:false, useCORS:true` — see tricky, below.)

### What was tricky to build
- **Canvas tainting.** If html2canvas draws a cross-origin image without CORS, the canvas becomes tainted and `toBlob` throws `SecurityError`. Setting `allowTaint:false` (with `useCORS:true`) makes html2canvas *skip* uncooperative images instead of tainting, so `toBlob` always succeeds; the trade-off is those images render blank. For same-origin artifact DOM/2D-canvas this captures well.
- **Stale ETag after save.** The thumbnail ETag is the content hash, which a recapture doesn't change, so a plain refetch would 304 to the old image. The preview (and any refresh) appends `?v=Date.now()` to force the browser to refetch the new bytes. Gallery cards elsewhere still need their own cache to expire — an accepted limitation.

### What warrants a second pair of eyes
- `POST /thumb/{name}` writes a client-supplied image to disk keyed by the artifact hash. It validates the PNG and caps the body at 25 MB, but reviewers should confirm the path can't escape the thumbs dir (it's `filepath.Join(thumbsDir, hash+"-ver.png")` with a hex hash, so no traversal).
- WebGL artifacts: client capture yields a blank/partial image; the re-render fallback is the intended path — confirm the UX makes that discoverable (the capture failure message points to "try re-render").

### What should be done in the future
- Surface a recapture affordance directly in the gallery (currently detail-page only).
- A per-artifact thumbnail version so gallery cards refresh after a recapture without a hard reload.

### Code review instructions
- `pkg/server/thumbnail.go`: `saveUploaded`, `invalidate`.
- `pkg/server/server.go`: `thumbHash`, `handleThumbSave`, `handleThumbRerender`, routes.
- `pkg/server/templates/artifact.html`: the Thumbnail box + `setThumbFromView`/`rerenderThumb`.
- Validate: `POST /thumb/<name>` a PNG then `GET /thumb/<name>?v=1`; `POST /api/thumb/rerender/<name>`; in the UI press `c` on a DOM artifact.

### Technical details
- `POST /thumb/{name}` body is raw `image/png`; server downscales to 480px wide.

## Step 16: Remember scroll position + loaded count in the URL (Back restores the view)

The gallery is a single-page app, so clicking into an artifact and pressing Back re-initialized it — page 1, scroll 0 — losing both your scroll position and any extra pages you had loaded. This step serializes the full search state plus the loaded count and scroll offset into the URL, and restores them on load.

### Prompt Context

**User prompt (verbatim):** (see Step 15)

**Assistant interpretation:** Persist scroll (and enough state to rebuild the view) in the URL so browser Back returns to the exact place.

**Inferred user intent:** Don't lose your place when bouncing between the gallery and artifacts.

**Commit (code):** 06f8556 — "feat: remember scroll position + loaded count in the URL so Back restores the view"

### What I did
- `pkg/server/templates/index.html`: `writeURL()` serializes state + `n` (loaded count) + `y` (scrollY) via `history.replaceState`; `hydrateFromURL()` reads them back; `reflectControls()` syncs the search box / sort / date inputs / view buttons; `initialLoad(restore)` fetches `n` items in one request (capped 600) and `scrollTo(y)`. `qs(limit, offset)` gained overrides. `history.scrollRestoration="manual"`. A throttled `scroll` listener and a capturing `#grid` click flush the URL before navigation. `fetchPage` calls `writeURL()`.

### Why
- Restoring the loaded count in a single `limit=n` fetch rebuilds the whole scrolled-through list at once, so `scrollTo(y)` lands correctly (row/thumb heights are fixed, so layout height is stable before images load).
- `scrollRestoration="manual"` stops the browser's own restoration from fighting ours.

### What worked
- Verified: loaded 180 cards + scrolled to 2400 → URL `?n=180&y=2400`; navigated to an artifact; Back → 180 cards re-loaded and `scrollY===2400`, "Load more" still shown. 0 console errors.

### What didn't work
- N/A.

### What was tricky to build
- **Flushing the URL before a link navigation.** The scroll listener is throttled (150 ms), so a click right after scrolling could navigate with a stale `y`. A capturing-phase click listener on `#grid` calls `writeURL()` synchronously before the `<a>`'s default navigation, so the history entry the browser records already has the current scroll/state.
- **Paging offset after a restore.** After the one-shot `limit=n` fetch, `state.offset` is set to `results.length - PAGE` so the existing "Load more" (which does `offset += PAGE`) continues correctly from where the restore left off, and `renderCards` shows the button iff `results.length < total`.

### What warrants a second pair of eyes
- The `initialLoad` restore math (`state.offset = max(0, results.length - PAGE)`) and the 600-item cap; confirm "Load more" behaves right immediately after a restore.
- `writeURL` runs on every `fetchPage` and (throttled) on scroll; confirm no excessive `replaceState` churn.

### What should be done in the future
- Consider syncing state to the URL on facet/tag clicks too (currently via the `fetchPage` → `writeURL` path, which already covers it) and de-duping rapid `replaceState` calls if churn is ever observed.

### Code review instructions
- `pkg/server/templates/index.html`: `writeURL`, `hydrateFromURL`, `reflectControls`, `initialLoad`, the scroll/`#grid` listeners, and the init block.
- Validate: load more a few times, scroll, open an artifact, press Back — the count and scroll position return.

### Technical details
- URL params: search state (`q/sort/type/project/model/library/after/before/warnings/favorite/collection/tag*`), plus `view`, `n` (loaded count, omitted when ≤ PAGE), `y` (scroll, omitted when 0).

## Step 17: Move the thumbnail-capture shortcut off a bare letter

Plain `c` for "capture view" collided with artifacts that read plain keystrokes. This step changes it to a modifier combo that never conflicts with typing.

### Prompt Context

**User prompt (verbatim):** "- it should not just be \"c\" because some artifacts use keyboard input. Maybe some shortcut like ctrl-shift-c or so? \n- project names are not being resolved and are just ugly UUIDs \n- create a gallery mode where I can see the screenshot in full basically and browse left / right \n- add a magnifying glass icon to the screenshots to zoom in on them. \n- add proper react router so that the url bar are shareable. \n- scrolling the artifacts should leave the sidebar / filter bar in place, basically just scroll wihin the results."

**Assistant interpretation:** Change the capture keybinding to a modifier combo (this step); plus five more UI changes handled in Steps 18–19.

**Inferred user intent:** Shortcuts must not steal keys the artifact itself uses.

**Commit (code):** 9a5f14e — "fix: use Ctrl/Cmd+Shift+C (not 'c') for thumbnail capture"

### What I did
- `artifact.html` keydown: capture now fires on `(ctrlKey||metaKey) && shiftKey && key==='c'` with `preventDefault`, checked before the typing guard; button title updated.

### Why / What worked / What was tricky
- The parent detail-page listener only sees keys when focus is *outside* the iframe, but a modifier combo is unambiguous regardless. Ctrl+Shift+C is Chrome's element-picker shortcut, so it may be intercepted when devtools is open — the button remains the always-available affordance. Verified the combo triggers capture and plain `c` no longer does.

### What warrants a second pair of eyes / future
- If the devtools clash is annoying, switch to Alt+Shift+C. N/A otherwise.

### Code review instructions
- `artifact.html`: the keydown handler's first branch.

### Technical details
- `(e.ctrlKey||e.metaKey) && e.shiftKey && (e.key==='C'||e.key==='c')`.

## Step 18: Resolve project UUIDs to human names

Artifacts displayed raw project UUIDs (`019d15d9-…`) instead of names like "EINK-OS". This resolves them from a `projects.json` map at the serve root.

### Prompt Context

**User prompt (verbatim):** (see Step 17)

**Assistant interpretation:** Show human project names instead of UUIDs.

**Inferred user intent:** Legible project facets/labels.

**Commit (code):** 7beb6af — "feat: resolve project UUIDs to human names via projects.json"

### What I did
- Generated `~/Downloads/claude-downloads/projects.json` (`{uuid:name}` for all 27 projects) via `surf-go claude projects --with-glaze-output --output json`.
- `server.go`: `loadProjectNames(dir)` reads `<dir>/projects.json` (accepts a `{uuid:name}` map or a `[{uuid,name}]` list). `New()` loads it, passes it to `newSearchIndex(sc, projectNames)`, and stores it on the server.
- `index.go`: `searchIndex.projectNames`; in `rebuild()`, resolve `a.Project` (uuid → name) before indexing, so facets/search/filter all use the name.
- `handleArtifactJSON`: resolve the project name for the detail page too.

### Why
- Resolving at ingest means the name flows to every consumer (facet value, `project:` filter, SearchDocument.Project) with one change; the detail handler reads the artifact directly (not the index), so it resolves separately.

### What worked
- The project facet now reads `{'(none)':177, 'EINK-OS':19, 'WRITING':2}` instead of UUIDs.

### What was tricky / second eyes / future
- `projects.json` is user data in the serve dir, not committed. It is loaded once at startup (a file-watch rebuild does not reload it) — acceptable; a future improvement is to reload it on rebuild. The generation step needs the surf browser bridge.

### Code review instructions
- `server.go`: `loadProjectNames`, the `New()` wiring, `handleArtifactJSON`. `index.go`: the resolve line in `rebuild()`.
- Validate: `curl 'localhost:PORT/search' | jq '.facets.project'` shows names.

### Technical details
- `projects.json` format: `{"<uuid>":"<name>", …}`.

## Step 19: Gallery lightbox (magnifier), fixed filter/sidebar with a scrollable results pane, and shareable gallery URLs

Three related browsing improvements: a full-screen gallery lightbox opened by a magnifier on each thumbnail (browse left/right through results), an app-shell layout where the filter bar and facet sidebar stay put while only the results scroll, and shareable deep-link URLs for the lightbox. Together these make a large library pleasant to browse and every view shareable.

### Prompt Context

**User prompt (verbatim):** (see Step 17)

**Assistant interpretation:** Build a lightbox gallery (items 3+4), keep the chrome fixed while results scroll (item 6), and make URLs shareable (item 5).

**Inferred user intent:** Photo-gallery-style browsing at scale, stable chrome, and copy-pasteable links to any view.

**Commit (code):** daaa4ce — "feat: gallery lightbox (magnifier), sticky filter/sidebar with scrollable results, shareable gallery URLs"

### What I did
- **Lightbox** (`index.html`): a 🔍 overlay on each grid thumbnail opens `#lightbox` (dark full-screen), showing the artifact's screenshot large with ‹/› buttons and ←/→ keys, a counter, and open/details links. Steps through `allDocs` (every loaded result, tracked in `renderCards`); at the end it triggers a "load more" and advances via `lbPending`.
- **App-shell layout**: `body{overflow:hidden}`, `.content` a full-height flex column with the header (title/toolbar/advanced) `flex:none` and `.layout{flex:1;min-height:0}`; `.facets` and `main#results` each `overflow-y:auto`. Step-16 scroll tracking moved from `window.scrollY` to `el("results").scrollTop`.
- **Shareable URLs (item 5)**: opening the lightbox `pushState`s `?gallery=<name>` (Back closes it); stepping `replaceState`s it; `popstate` opens/closes from the param; a `?gallery=<name>` URL opens the lightbox at that artifact once results load (`initialGallery`); `writeURL` preserves the param. Combined with the already-URL-encoded search state and the real `/artifact/{name}` pages, the URL bar is fully shareable.

### Why
- I implemented routing with the History API rather than migrating to React Router: the app is a Go-templated vanilla-JS SPA, and a React rewrite would be a large, high-risk change across every feature already built, for the *stated* goal (shareable URLs) that the History-API approach fully meets.
- Tracking `allDocs` gives the lightbox a stable list to page through independent of the DOM.

### What worked
- Verified: 🔍 opens the lightbox at the right artifact; ‹/› and ←/→ step ("1/60" → "2/60 Trinnov…"); scrolling the results pane keeps `window.scrollY===0` with the toolbar fixed; a pasted `?gallery=<name>` URL opens the lightbox at that artifact; 0 console errors.

### What didn't work
- N/A after wiring the URL-preservation guard (see tricky).

### What was tricky to build
- **`writeURL` dropping the gallery param.** `writeURL` rebuilds the query from `state`, which has no gallery field, so a scroll/`fetchPage` while the lightbox was open would erase `?gallery`. Fixed by having `writeURL` re-add `gallery=<current name>` whenever the lightbox is open; `closeLightbox` removes it via `replaceState`.
- **Moving the scroll origin.** Making the results a scroll container means `window.scrollY` is always 0; every place Step 16 read/wrote scroll had to switch to `el("results").scrollTop` (writeURL, the restore in `initialLoad`, and the scroll listener target).
- **Auto-advance past the loaded set.** `←/→` at the last loaded item sets `lbPending` and triggers a paged fetch; the `renderCards` append path then jumps to `lbPending`.

### What warrants a second pair of eyes
- The lightbox history model (pushState on open, replaceState on step, popstate sync) — confirm Back/Forward behave (Back from a stepped lightbox returns to the opener entry, then closes).
- The app-shell on small screens: `.layout` collapses to one column under 720px, giving two stacked scroll panes — usable but desktop-first.
- The lightbox shows the 480px thumbnail scaled up (slightly soft); "open ▸" gives the crisp live render.

### What should be done in the future
- If a literal React/React-Router migration is wanted, it's a separate, larger effort; the History-API routing here already makes URLs shareable.
- Serve a larger thumbnail (or the live iframe) in the lightbox for crispness; add the magnifier to list rows; reload gallery cards after a recapture.

### Code review instructions
- `index.html`: the `.lightbox`/`.zoom` CSS + markup; `openLightbox`/`showLightbox`/`lbMove`/`closeLightbox`/`galleryURL`/`popstate`; the app-shell CSS (`body`/`.content`/`.layout`/`.facets`/`main`); the `el("results")` scroll switch; `allDocs` in `renderCards`.
- Validate: 🔍 a card; ←/→; scroll and confirm the sidebar stays; paste a `?gallery=<name>` URL.

### Technical details
- New URL param: `gallery=<artifact name>` (the lightbox target). Scroll now tracked on `#results`.

## Step 20: Mobile hamburger drawer for search + filters + facets

On a narrow screen the search bar and facet sidebar consumed the top of the page, forcing a scroll back up to refine. This step folds the toolbar, advanced panel, and facet sidebar into an unfoldable drawer behind a sticky "☰ Filters" top bar, so filters are reachable while scrolled deep into the results. Desktop is untouched.

### Prompt Context

**User prompt (verbatim):** "n the mobile view, make the search and filters and facets a hamburger menu that's always on top that I can unfold to refine search even while scrolled down, to avoid having to scroll back up"

**Assistant interpretation:** On mobile, collapse search + filters + facets into a sticky hamburger menu that unfolds over the results, usable without scrolling to the top.

**Inferred user intent:** Refine a search from anywhere in a long result list on a phone.

**Commit (code):** 7efa012 — "feat: mobile hamburger drawer for search + filters + facets"

### What I did
- `index.html`: wrapped the title in a `.topbar` (with the `☰ Filters` hamburger and the moved-in result `#count`); removed `#count` from the toolbar; added an empty `#drawer` container.
- CSS: a `@media (max-width:720px)` block — hamburger shown, subtitle hidden, `.topbar` sticky; `#drawer.open` a fixed, scrollable overlay (below the sticky top bar) holding the controls; full-width drawer search.
- JS: `applyLayout()` uses a `matchMedia("(max-width:720px)")` listener to **move** `.toolbar`, `#advanced`, and `.facets` into `#drawer` on mobile and back to their original places on desktop; `toggleDrawer`/`positionDrawer` (top offset measured from the sticky bar's bottom); resize reposition.

### Why
- The desktop layout (top search bar + left facet column) had to stay, and those controls live in different DOM parents, so a matchMedia re-parent groups them into one mobile drawer without disturbing desktop — cleaner than duplicating markup or forcing a shared wrapper that would break the desktop grid.
- Moving elements (not cloning) keeps a single set of inputs, so all existing id-based wiring (search, facets, collections) keeps working unchanged.

### What worked
- Verified at 390×800: collapsed view is a sticky `☰ Filters` bar + count with results full-width; scrolling to 1600 then tapping the hamburger unfolds the drawer (search + sort + facets + collections) over the results, label toggles to `✕ Close`. Resizing back to 1400px restores toolbar→`.content`, facets→`.layout`, hamburger hidden, drawer empty. 0 console errors.

### What didn't work
- First pass, the drawer search rendered as a cramped "Se" because base `.search-input { flex:1 }` (flex-basis 0) beat `width:100%`. Fixed with `.drawer .search-input { flex: 1 1 100% }` so it takes a full row and the buttons wrap below.

### What was tricky to build
- **Grouping controls from two DOM parents.** The toolbar/advanced are `.content` children; the facets are a `.layout` grid child. A pure-CSS drawer can't relocate the facets out of the grid without `display:contents` tricks that also break the desktop grid. The reliable approach was a matchMedia-driven re-parent with an idempotent guard (`if (toolbar.parentNode !== drawer)` / `if (facets.parentNode === drawer)`) so repeated `change`/`resize` events don't thrash, and precise restore anchors (`insertBefore(..., layout)` and `insertBefore(facets, main)`).
- **Drawer top offset.** The sticky top bar's height isn't fixed (wraps), so the drawer's `top` is measured from `topbar.getBoundingClientRect().bottom` on open and on resize rather than hard-coded.

### What warrants a second pair of eyes
- The re-parent idempotency guards and restore anchors — confirm rapid resize across the 720px boundary always lands elements in the right place.
- Interaction with Step 19's `#results` scroll tracking: the drawer is an overlay, so the results keep their scroll behind it; confirm opening/closing the drawer doesn't perturb `y` in the URL.

### What should be done in the future
- Optional: close the drawer automatically after a facet selection (currently it stays open for multi-refine, by design).
- A backdrop tap-to-close (currently the `✕ Close`/hamburger toggles).

### Code review instructions
- `index.html`: the `.topbar`/`.hamburger`/`.drawer` CSS and the `@media (max-width:720px)` block; `applyLayout`/`toggleDrawer`/`positionDrawer` and the `matchMedia` wiring.
- Validate: shrink the viewport ≤720px → `☰ Filters` bar; scroll, tap it, refine; widen → desktop layout restored.

### Technical details
- `matchMedia("(max-width: 720px)")`; drawer children order = toolbar, advanced, facets; `#count` moved to `.topbar` so it stays visible while scrolled.

## Step 21: Full-resolution capture for the lightbox

The gallery lightbox (🔍) showed the 480px thumbnail scaled up, so it was soft at full screen. The renderer already captured at 1200×900 and discarded that full image after downscaling — this step keeps it and serves it to the lightbox, so the magnifier shows a crisp high-res view while the small thumbnails stay small.

### Prompt Context

**User prompt (verbatim):** "- clicking the magnifiying glass should show a high res version of the thumbnail, whch means we should probably capture it high res and render it down for the thumbnail(s)."

**Assistant interpretation:** Store the full-resolution render (not just the downscaled thumbnail) and have the lightbox display it.

**Inferred user intent:** A sharp, zoomable image when opening an artifact in the gallery.

**Commit (code):** a5ab6e5 — "feat: store the full-res capture and show it in the gallery lightbox"

### What I did
- `thumbnail.go`: `fullPathFor`/`pathForKind`; `get(ctx, name, hash, full bool)` now writes **both** `<hash>-<ver>.png` (480) and `<hash>-<ver>-full.png` (full 1200×900) from one render and returns the requested variant; `saveUploaded` stores the uploaded image as the full and a downscaled thumb; `invalidate` removes both; `etag(hash, full)` distinguishes variants.
- `server.go`: `handleThumb` reads `?full=1`, uses the versioned full ETag, and passes `full` to `get`; backfill/rerender call `get(..., false)`.
- `index.html`: `showLightbox` sets the 480 thumb instantly, then swaps to `/thumb/<name>?full=1` when it loads (guarded so navigating away doesn't swap the wrong image).
- Updated `thumbnail_test.go` `get` calls for the new signature.

### Why
- The full capture was free (already rendered), so keeping it costs only disk. Serving it lazily (rendered on the first `?full=1` request for already-thumbnailed artifacts) avoids a mass re-render — the backfill still only produces the small thumbnails.
- Instant-thumb-then-swap keeps the lightbox responsive even when the full must be generated on first open.

### What worked
- Verified: `/thumb/<name>` → 480×352, `/thumb/<name>?full=1` → 1200×757, both cached on disk; unit tests green.

### What didn't work
- N/A.

### What was tricky to build
- **Single-flight for two outputs.** Thumb and full share the hash-keyed flight. A fast-path `os.ReadFile(want)` serves an existing variant without entering the flight; the flight re-checks *both* files and renders if *either* is missing, then writes both — so a full-res request when only the small thumb exists (older render) correctly regenerates both, and concurrent thumb+full requests still collapse to one render.

### What warrants a second pair of eyes
- The `get` two-variant logic (fast path + flight re-check of both) and the distinct ETag per variant (so a browser that cached the small one doesn't 304 the full request — they are different URLs *and* different ETags).
- `renderEnvVersion` was intentionally **not** bumped, so existing 480 thumbs stay valid and fulls fill in lazily; confirm that's the desired rollout (vs. a mass regenerate).

### What should be done in the future
- If "high res" needs to be crisper on 4K displays, render at a higher device scale factor (e.g. `--force-device-scale-factor=2`) — bump `renderEnvVersion` when doing so.
- A gallery-side recapture affordance + a per-artifact thumb version so cards refresh after a recapture without a hard reload (still outstanding from Step 15).

### Code review instructions
- `thumbnail.go`: `get`, `saveUploaded`, `invalidate`, `fullPathFor`/`pathForKind`/`etag`. `server.go`: `handleThumb` `?full=1`. `index.html`: `showLightbox` swap.
- Validate: `curl -o t.png /thumb/<name>` (480) vs `curl -o f.png '/thumb/<name>?full=1'` (1200); open the lightbox and watch it sharpen.

### Technical details
- Full path `<hash>-<ver>-full.png`; full ETag `"<hash>-<ver>-full"`; render viewport unchanged at 1200×900.

## Step 22: Drop implausible (future-dated) models on old artifacts

After legacy artifacts were recovered, every pre-2025 artifact showed `claude-sonnet-4-5-20250929` — a 2025 model on a 2024 conversation. The cause is upstream: claude.ai's API returns the account's *current* default model for old conversations (the `model` field, both conversation- and message-level, is rewritten), so the historical model isn't recoverable. This step suppresses the obviously-wrong labels rather than display an impossible model.

### Prompt Context

**User prompt (verbatim):** "somethings wrong with the detection of the model, because claude-sonnet-4-5-20250509 was obv not there in 2024-06-20"

**Assistant interpretation:** The model shown on old artifacts is impossibly new; don't show a model that postdates the conversation.

**Inferred user intent:** Trustworthy model labels — no anachronisms.

**Commit (code):** 4c2f185 — "fix: drop implausible (future-dated) models from old artifacts"

### What I did
- Confirmed via the raw `conversation.json`: a 2024-12-07 conversation carries `claude-sonnet-4-5-20250929` at both meta and message level (the API's current default). All 70 pre-2025 artifacts had this, all with a `-YYYYMMDD` suffix.
- Added `plausibleModel(model, updatedAt)` in `pkg/artifacts/scanner.go`: if the model's trailing `-YYYYMMDD` is later than the conversation's `updated_at` day, return "" (drop it); suffixless models are kept. Applied it at `a.Model = plausibleModel(meta.Model, meta.UpdatedAt)` in `enrichFromExportMeta`. Unit test in `scanner_test.go`.

### Why
- A model cannot predate a conversation it "used"; if the model's release date is after the conversation's last activity, the value is the API default, not history — so blanking is strictly more truthful than showing it.
- Using `updated_at` (last activity) rather than `created_at` is the tight bound: it only drops truly-impossible models, not legitimate later continuations.

### What worked
- After restart, the 70 old artifacts show no model, and the model facet's `claude-sonnet-4-5-20250929` count fell from 86 → 16 (the 16 genuine 2025 ones). Tests green.

### What didn't work / limitation
- The **true** historical model is unrecoverable (the API overwrote it), so we can only *suppress* the wrong one, not restore the right one. Suffixless anachronisms (e.g. a hypothetical date-less new-gen model on an old conversation) aren't caught — none exist in this data, but noted.

### What was tricky to build
- Choosing the reference date: `created_at` would over-blank legitimate recent continuations; `updated_at` blanks only the impossible cases.

### What warrants a second pair of eyes
- The date comparison is lexical on `YYYYMMDD` strings (safe because zero-padded fixed width) and the regex `-(\d{8})$`.

### What should be done in the future
- If a historical-model source ever exists (per-message model at send time), prefer it. Otherwise leave blank.

### Code review instructions
- `pkg/artifacts/scanner.go`: `plausibleModel` + its call site in `enrichFromExportMeta`; `scanner_test.go` `TestPlausibleModel`.
- Validate: model facet no longer shows a model dated after a pre-2025 artifact; `go test ./pkg/artifacts/ -run PlausibleModel`.

### Technical details
- Drop when `model[-8:] (YYYYMMDD) > updated_at[:10] without dashes`. 70 artifacts blanked.
