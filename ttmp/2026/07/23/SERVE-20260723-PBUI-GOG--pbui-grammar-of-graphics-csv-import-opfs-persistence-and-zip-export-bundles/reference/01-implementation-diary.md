---
Title: Implementation diary
Ticket: SERVE-20260723-PBUI-GOG
Status: active
Topics:
    - pbui
    - diary
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://imports/pbui-gog.jsx
      Note: |-
        the artifact implementing CSV import, OPFS persistence, and ZIP export (Steps 1-6)
        deck builder + workspace persistence (Steps 7-11) implemented in this artifact
ExternalSources: []
Summary: 'Chronological implementation diary for pbui-gog.jsx: import, CSV upload, OPFS persistence, and ZIP export bundles.'
LastUpdated: 2026-07-23T16:45:00-04:00
WhatFor: Recording the step-by-step implementation journey for the pbui-gog work
WhenToUse: When resuming or reviewing pbui-gog work
---



# Diary

## Goal

Capture the implementation journey of the `pbui-gog.jsx` artifact: importing it into the serve-artifacts server, adding CSV upload with OPFS persistence, writing the ZIP export guide, and implementing client-side ZIP bundles (CSV + PNG). Steps 1–3 are backfilled from work already performed; Steps 4+ are recorded live.

---

## Step 1: Import pbui-gog.jsx and run the server in tmux

This step made the `pbui-gog.jsx` artifact available through the existing serve-artifacts Go server so it could be iterated on in a browser. The server discovers artifacts on each request, so importing was just a file copy; the work was in wiring up a persistent tmux session and confirming the JSX host page rendered the React component.

**Commit (code):** (uncommitted — the imported file plus screenshots were left untracked at this point; committed together in Step 3.)

### Prompt Context

**User prompt (verbatim):** "Run the server in tmux, and import ~/Downloads/pbui-gog.jsx and show it to me"

**Assistant interpretation:** Start the serve-artifacts Go server in a detached tmux session, copy the user's JSX file into the `imports/` artifacts directory, and display the rendered artifact in the browser.

**Inferred user intent:** Get the pbui-gog Grammar-of-Graphics workbench running locally and visible so subsequent feature work can happen against a live instance.

### What I did
- Read `README.md` and `ls -R cmd pkg imports` to learn the server loads artifacts from `imports/` and serves `.jsx` via a host page (`pkg/server/templates/jsx-host.html`) that loads React from esm.sh.
- Copied `~/Downloads/pbui-gog.jsx` → `imports/pbui-gog.jsx` (89KB, single-document-chart version).
- Started the server detached: `tmux new-session -d -s serve-artifacts "./serve-artifacts serve --dir ./imports --port 8080"`.
- Verified discovery via `curl http://localhost:8080/search-index.json` (entry `pbui-gog`).
- Navigated Playwright to `http://localhost:8080/view/pbui-gog`; only console error was a harmless `favicon.ico` 404.
- Took a viewport screenshot confirming the "PBUI — GRAMMAR OF GRAPHICS" shell rendered with workspace tabs (build/explore/gallery/help/…).

### Why
- The server is the natural harness: it already handles JSX→React mounting and the import map. Copying into `imports/` is the documented "add artifact" path.

### What worked
- Server started cleanly in tmux; the artifact rendered with no React/Babel errors.

### What didn't work
- (Nothing failed in this step.)

### What I learned
- serve-artifacts discovers artifacts per-request, so a copied file is live without a restart — important for the iteration loop later.
- The JSX host page injects an import map (`pkg/server/templates/jsx-host.html:12`) resolving `react`, `react-dom`, `recharts`, `d3`, etc. from esm.sh. This is the key constraint for later dependency decisions: adding a lib means either editing this map or vendoring into the JSX.

### What was tricky to build
- None; this was wiring, not authoring.

### What warrants a second pair of eyes
- Confirm the tmux session name `serve-artifacts` is unique and the port 8080 was free.

### What should be done in the future
- Add `favicon.ico` (or a 204 route) to the Go server to silence the harmless 404.

### Code review instructions
- Run `tmux ls` (expect `serve-artifacts` session); visit `http://localhost:8080/view/pbui-gog`.

### Technical details
- Server binary: `./serve-artifacts` (prebuilt, 56MB). Serve command: `./serve-artifacts serve --dir ./imports --port 8080`.

---

## Step 2: Switch to ~/Downloads/pbui-gog(1).jsx

The user pointed at a different source file: `pbui-gog(1).jsx` (122KB, larger than the 89KB original). This version is the multi-document build: a shared `World` holding N chart documents (α, β, γ…), each with its own pipeline + encoding, plus snapshots and a compare view. Replacing the artifact was a copy; the subtlety was confirming nothing regressed.

### Prompt Context

**User prompt (verbatim):** "use ~/Downloads/pbui-gog(1).jsx"

**Assistant interpretation:** Replace the imported artifact with the `(1)` variant from Downloads.

**Inferred user intent:** Work against the more capable multi-document version of the workbench.

### What I did
- `cp "/home/manuel/Downloads/pbui-gog(1).jsx" imports/pbui-gog.jsx` (overwrote; 122KB).
- Reloaded `http://localhost:8080/view/pbui-gog` — 0 errors, 2 warnings.
- Took a screenshot; VLM analysis confirmed the workspace bar and tiles rendered.

### Why
- The `(1)` version introduces the `World` class with `docs[]`, `activeId`, per-document mutation methods (`setDataset(docId,id)`, `addStep(docId,step)` …) and a DOC-strip tile model. This is the substrate CSV import and ZIP export build on.

### What worked
- Clean reload, no syntax errors. The multi-doc story (DOC dropdown showing "α · seabirds", "β · climate") was visible.

### What didn't work
- One screenshot's VLM analysis returned "(no analysis returned)" — a transient vision-QA issue, not a code defect; the DOM snapshot confirmed correct rendering.

### What I learned
- The codebase split: `DATASETS` is a module-level `const` registry (`imports/pbui-gog.jsx:205`), and `World` (`imports/pbui-gog.jsx:335`) holds `docs[]` of chart documents each pointing at a `datasetId`. Chart/table/pipeline/encode tiles are *views* re-pointable at any document via a DOC strip.

### What was tricky to build
- None operationally. The conceptual model (views vs. state) matters for Step 3: adding a dataset mutates the shared `DATASETS` registry, and existing documents pick it up by id.

### What warrants a second pair of eyes
- Confirm the `(1)` file is the canonical source (no earlier/smaller variant is expected to be used).

### What should be done in the future
- Commit the artifact into `imports/` so the source-of-truth is the repo, not `~/Downloads`.

### Code review instructions
- `wc -l imports/pbui-gog.jsx` (expect ~2268 lines); `grep -n "class World" imports/pbui-gog.jsx` (expect line ~335).

---

## Step 3: Add CSV upload + OPFS persistence

This was the first feature step. The goal: let a user upload a CSV, have it parsed and type-inferred into the shared `DATASETS` registry as a first-class dataset, and persist it in the browser so it survives reloads. The hard part was the storage strategy: localStorage caps at ~5MB and chokes on large CSVs, while OPFS (Origin Private File System) is generous, async, and survives reload — so the design split metadata (localStorage index) from payload (OPFS raw CSV text), with a localStorage fallback when OPFS is unavailable.

The work is uncommitted at the time of this diary entry because it was performed before the ticket existed; it is committed in this step's doc commit.

**Commit (code):** (committed in this step — see "What I did".)

### Prompt Context

**User prompt (verbatim):** "Updatei t to allow upload CSVs as datasets and store in OPFS (or localstorage? I think there's this storage in the browser)"

**Assistant interpretation:** Extend pbui-gog.jsx to accept CSV uploads, register them as datasets, and persist them in browser storage (OPFS preferred, localStorage fallback).

**Inferred user intent:** Let users bring their own data into the grammar-of-graphics workbench and have it survive a page reload, without any server-side storage.

### What I did
- Inserted a CSV/OPFS layer between `DATASETS` and the pipeline engine (`imports/pbui-gog.jsx:207` block): `parseCSVRows` (RFC4180-ish parser handling quoted fields, doubled quotes, `\r\n`/`\n`), `inferType` (q/n/t via `isNum`/`isISODate`), `parseCSV` (header→fields, quantitative coercion), `slugify`/`uniqueDatasetName`, `registerDataset`, OPFS helpers (`opfsWrite/opfsRead/opfsDelete`), localStorage index (`lsReadIndex/lsWriteIndex`) + payload fallback (`lsWriteCSV/lsReadCSV`), `persistDataset`, `deletePersistedDataset`, `loadPersistedDatasets`.
- Added `World.importDataset(ds, csvText)` and `World.removeDataset(id)` (`imports/pbui-gog.jsx:640`) — registry mutation + trace logging + re-pointing orphaned documents.
- Rewrote `DataApp` (`imports/pbui-gog.jsx:1199`) to add an upload box (file input, paste textarea, drop target, name field) and a per-dataset delete `×` + "UPLOADED" badge for persisted datasets.
- Added `dataset_imported`/`dataset_removed` trace colors to `EV_COLOR`.
- Added an async restore-on-mount `useEffect` in `App` that calls `loadPersistedDatasets()` then `world.bump()`.
- Verified: uploaded `test_metrics.csv` (region/month/revenue/costs/units, 12 rows). Type inference: region=n, month=t (ISO `2025-01`), revenue/costs/units=q (coerced to numbers). DOM snapshot showed the dataset with UPLOADED badge + delete button.
- Verified persistence: checked `localStorage['pbui-datasets-index']` (entry with 5 fields/types), confirmed OPFS holds the raw CSV (`navigator.storage.getDirectory()` → `pbui-datasets/test_metrics.csv`, 371 bytes, first line `region,month,revenue,costs,units`), reloaded the page, confirmed `test_metrics` restored (DOM innerText grep for `test_metrics`/`UPLOADED`/`12 rows` all true).
- Verified chart integration: clicking the dataset chip created chart document `α · test_metrics`; re-pointing the chart tile's DOC dropdown rendered `test_metrics ⊳ 0 steps ⊳ geom_line`.

### Why
- OPFS for payload + localStorage for index is the standard pattern when you need large-file survival without a server: the index is small (names/fields/counts) and synchronous to read, while the CSV text lives in OPFS where there's real quota.
- Mutating the shared `DATASETS` registry (rather than a separate uploaded-store) means every existing tile/encoder/pipeline sees uploaded datasets as first-class immediately — no special-casing.

### What worked
- End-to-end upload → inference → persistence → reload-restore → chart render, all client-side, zero server changes.

### What didn't work
- Playwright's file-upload modal stacked up: my early click attempts on the native file input queued ~10 file-chooser dialogs that each had to be dismissed one-by-one with `browser_file_upload` (no-arg = cancel). Eventually cleared them and did a clean single upload. No code defect — a harness artifact.
- One screenshot VLM pass incorrectly reported `test_metrics` absent from the data browser; a direct `document.body.innerText` grep proved it present (the row was below the fold / VLM missed the scrolled content).

### What I learned
- `CompressionStream` / `navigator.storage.getDirectory()` are widely available now (Chrome≥80, FF≥113, Safari≥16.4) — relevant to the ZIP step.
- The `(1)` artifact's `setDataset(docId, id)` resets the whole chart (default encoding) when the source changes; clicking a dataset chip triggers this, so an uploaded dataset becomes a usable chart source in one click.

### What was tricky to build
- The storage split's invariant: the localStorage index is the source of truth for *which* datasets exist; OPFS/localStorage holds the *text* to rebuild them. On load, `loadPersistedDatasets` must rebuild from text (re-running `parseCSV`) so type inference stays consistent, and must not re-register built-in mock datasets. The `uploaded` flag for delete is derived from `d.note.startsWith("uploaded")` — a fragile contract noted for future cleanup.

### What warrants a second pair of eyes
- `inferType`'s temporal heuristic: `isISODate` matches `YYYY-MM(-DD)(THH:MM(:SS))?` and requires ≥3 values and >80% parse rate. A short numeric-looking month column (e.g. `1`,`2`,`3`) could misinfer as quantitative — but `2025-01` correctly goes temporal. Confirm no real-world CSV trips the heuristic.
- `removeDataset` re-points orphaned documents to `Object.keys(DATASETS)[0]` — if the first remaining dataset is also uploaded-and-deleted concurrently, ordering matters. Low risk in single-user UI but worth a glance.

### What should be done in the future
- Replace the `note.startsWith("uploaded")` liveness flag with an explicit `uploaded: true` boolean on dataset objects — the current string-prefix contract is brittle.
- Add an OPFS quota check / user-facing error when `persistDataset` fails (currently just `console.warn`).
- Consider persisting chart documents/snaps too (currently only datasets persist).

### Code review instructions
- `grep -n "parseCSV\|opfsWrite\|loadPersistedDatasets\|importDataset" imports/pbui-gog.jsx`
- Reproduce: open `http://localhost:8080/view/pbui-gog`, explore workspace, upload a CSV, reload, confirm it restored.

### Technical details
- OPFS layout: root → `pbui-datasets/` dir → `{id}.csv` files. localStorage: `pbui-datasets-index` = JSON `[{id,name,rows,cols,fields}]`, plus `pbui-dataset-{id}.csv` fallback blobs.
- Type inference output drives the whole pipeline engine (`schemaAfter`, `evaluate`) and the plot engine (`buildPlot`'s `ftype`), so a misinferred column cascades.

### What I'd do differently next time
- Add a tiny in-JSX self-test for `parseCSVRows` (quoted fields, embedded newlines) run from console during dev, before wiring UI.

---

## Step 4: Write ZIP export implementation guide

This step produced the design document for client-side ZIP export bundles before writing any code. The guide evaluates three approaches (native `CompressionStream`, `client-zip`, WASM) and recommends the zero-dependency native path, grounded in the constraint that the artifact must stay a single self-contained `.jsx` with no build step and the host page loads deps only via the esm.sh import map.

**Commit (docs):** (committed in this step — see "What I did".)

### Prompt Context

**User prompt (verbatim):** "can we create like zip files in the browser itself? for example to download pngs + csv bundles? maybe with wasm?"

**Assistant interpretation:** Determine feasibility of browser-side ZIP creation for bundling PNGs + CSVs, and whether WASM is needed.

**Inferred user intent:** Enable downloading a chart's data + rendered image as one archive, fully client-side.

### What I did
- Answered first in chat: yes, feasible, and WASM is not needed — native `CompressionStream('deflate-raw')` + a hand-written ZIP central directory is enough; PNGs can be `STORE`d (already deflate-compressed internally).
- Gathered line-anchored evidence: `pkg/server/templates/jsx-host.html:12` (import map), `imports/pbui-gog.jsx:1199` (DataApp), `:1116` (PlotSVG), `:1504` (ChartApp), `:360` (persistDataset).
- Wrote `design-doc/01-zip-export-bundles-implementation-guide.md`: exec summary, problem/scope, current-state analysis, gap table, proposed architecture (ZipWriter/CSV serializer/SVG→PNG/download), 4 decision records (zero-dep native; STORE PNG + DEFLATE CSV; serialize from DATASETS not OPFS; include spec JSON), pseudocode for `blob()`/`svgToPngBlob`/bundle assembly, 2-phase plan, test strategy, risks.

### Why
- A design-first step forces the dependency/no-dependency and storage-source decisions to be explicit and evidence-anchored before coding, which is where ZIP bugs (CRC/offset) are expensive to debug.

### What worked
- The guide is concrete enough to implement directly (exact signatures, byte signatures `0x04034b50` etc., validation steps including `unzip -t`).

### What didn't work
- (Nothing failed.)

### What I learned
- `CompressionStream('deflate-raw')` produces exactly the deflate variant ZIP uses — so a native-stream-based zip is a real standard ZIP, not a toy. This is the linchpin fact that makes zero-dep viable.

### What was tricky to build
- N/A (design step). The tricky part is deferred to Step 5: getting the central-directory offsets and little-endian byte packing exactly right.

### What warrants a second pair of eyes
- The decision to serialize CSV from `DATASETS[id]` rows rather than read the original text from OPFS: it unifies built-in + uploaded datasets but means the exported CSV reflects the *source table*, not any pipeline output. Confirm this matches user expectation (it should — the bundle is about the source data + a picture).

### What should be done in the future
- If the bundle ever needs to capture *pipeline output* (post-transform rows), add a second optional CSV entry `*-output.csv` rather than changing the source-table semantics.

### Code review instructions
- Read `design-doc/01-zip-export-bundles-implementation-guide.md`; cross-check the line anchors against `imports/pbui-gog.jsx`.

### Technical details
- ZIP record signatures: local `0x04034b50`, central dir `0x02014b50`, EOCD `0x06054b50`. All multi-byte fields little-endian. Method 0=STORE, 8=DEFLATE.

---

## Step 5: Implement ZIP writer + helpers (Phase A)

This step built the zero-dependency client-side ZIP engine: a CRC32 implementation, a `ZipWriter` class that emits real local-file-header + central-directory + EOCD records using the native `CompressionStream('deflate-raw')` for deflate, plus the supporting serializers (`datasetToCSV`, `svgToPngBlob`, `downloadBlob`). No UI yet — the validation strategy was a console round-trip test confirmed by the system `unzip`.

**Commit (code):** 61d2056 — "feat(pbui-gog): add zero-dep client-side ZIP writer + CSV/PNG helpers"

### Prompt Context

**User prompt (verbatim):** (same as Step 4 — "can we create like zip files in the browser itself? for example to download pngs + csv bundles? maybe with wasm?")

**Assistant interpretation:** Implement the ZIP export engine per the Step 4 design doc, starting with the pure helpers (no UI), validated independently.

**Inferred user intent:** Ship working client-side ZIP creation without external dependencies.

### What I did
- Inserted a `ZIP EXPORT` block between the OPFS layer and the pipeline engine (`imports/pbui-gog.jsx` after line 386):
  - `CRC_TABLE` precomputed once (reflected poly `0xEDB88320`) + `crc32()`.
  - `u16`/`u32` little-endian byte packers; `DOS_TIME`/`DOS_DATE` constants.
  - `canDeflate = typeof CompressionStream !== "undefined"` capability flag.
  - `deflateRaw(bytes)` — pipes a `Uint8Array` through `new CompressionStream("deflate-raw")`, concatenates the output chunks.
  - `class ZipWriter` — `add(name, data, {store})` computes CRC + (deflate or store) payload + emits a local header; `blob()` emits the central directory + EOCD and returns a `Blob({type:"application/zip"})`.
  - `csvField()` + `datasetToCSV(ds)` — RFC4180 quoting for `,` `"` `\n`.
  - `svgToPngBlob(svgEl, scale=2)` — clone, set width/height/xmlns, serialize to data URL, `<img>` decode, draw to scaled canvas with white bg, `toBlob("image/png")`.
  - `downloadBlob(blob, filename)` — `URL.createObjectURL` + `<a download>` click + revoke.
- Validated with an inline console test that mirrors `ZipWriter` exactly: built a zip of `hello.txt` + `data/values.csv`, checked signatures (`localSig=504b0304`, `eocdSig=504b0506`), downloaded via `<a download>`, ran `unzip -l` / `unzip -t` / extract — all clean, contents matched.

### Why
- Pure-helpers-first lets the binary-format code (CRC, offsets, LE packing) be validated in isolation before UI entanglement, which is where ZIP bugs are expensive to debug.

### What worked
- `unzip -t` integrity test passed with zero errors on the first try; `CompressionStream('deflate-raw')` produced standard deflate that `unzip` inflated correctly. No WASM, no npm package, no import-map change.

### What didn't work
- First attempt to retrieve the test zip used `page.context()._impl._browser` which is undefined — switched to triggering the app's own `downloadBlob` flow via `<a download>`, which Playwright captured as a tracked download into `.playwright-mcp/`.

### What I learned
- `CompressionStream('deflate-raw')` is the exact deflate variant ZIP uses — so a native-stream-based zip is a real standard ZIP, not a toy. This was the linchpin fact that made the zero-dep approach viable and is confirmed by `unzip -t`.
- ZIP local-header signature `0x04034b50`, central-dir `0x02014b50`, EOCD `0x06054b50`; all multi-byte fields little-endian. The `u16`/`u32` array-spread approach (`...u32(v)`) keeps the record code readable.

### What was tricky to build
- Offset bookkeeping in `ZipWriter`: each entry's `offset` must be recorded as the byte position of its *local header* (before adding the header's own bytes), and the central directory offset in the EOCD is the position after all local headers+data. An off-by-one there makes `unzip` report a bad offset; the `unzip -t` round-trip is the only reliable check.
- `deflateRaw` is async (streams), so `add` is async and `blob()` must run after all adds resolve — the API forces `await zip.add(...)` ordering, which is fine but means `blob()` can't precompute the CD until adds finish.

### What warrants a second pair of eyes
- The CRC32 table init and `crc32` final XOR (`^ 0xFFFFFFFF`) — a sign error here passes for ASCII but fails for binary PNG bytes. The PNG round-trip in Step 6 exercises this.
- `u32` truncation: values > 2^32 would silently wrap; not a risk here (max file sizes are KB/MB) but the helper doesn't assert.

### What should be done in the future
- Add a `STORE` fallback when `canDeflate` is false (already gated by the flag, but the UI should surface "uncompressed zip" if so). Low priority given universal evergreen support.
- Consider streaming the zip to disk via OPFS for very large multi-dataset bundles (current design holds everything in memory as `Blob` chunks).

### Code review instructions
- `grep -n "class ZipWriter\|crc32\|deflateRaw\|datasetToCSV\|svgToPngBlob" imports/pbui-gog.jsx`
- Console test: open the page, paste the inline `ZipWriter` test from this diary, download, `unzip -t`.

### Technical details
- ZIP method 0 = STORE (no compression), 8 = DEFLATE. Version-needed-to-extract = 20 (2.0). Flags = 0. DOS date fixed to 1980-01-01 for deterministic output.

---

## Step 6: Wire bundle download UI (Phase B)

This step connected the Step 5 helpers to the UI: a `bundleDataset()` orchestrator and a "↓ bundle" button per dataset in `DataApp`. The subtlety discovered during testing was that `document.querySelector('svg[viewBox]')` grabbed the *first* SVG on the page, which on the explore workspace was the climate line chart, not the seabirds scatter being bundled — so the PNG didn't match the dataset. The fix tagged each `PlotSVG` with `data-chart-doc={docId}` so `bundleDataset` finds the SVG belonging to a chart document of the bundled dataset.

**Commit (code):** 3df2f60 — "feat(pbui-gog): wire ZIP bundle download UI"

### Prompt Context

**User prompt (verbatim):** (continuation of the ZIP request — "implement it, committing at appropriate intervals, and keeping a diary")

**Assistant interpretation:** Add the export button and orchestrator, validate the full bundle (CSV + specs JSON + PNG) end-to-end via Playwright + system unzip.

**Inferred user intent:** A user-downloadable .zip containing the dataset CSV, its chart spec, and a rendered PNG of the chart.

### What I did
- Added `bundleDataset(world, datasetId)` before `DataApp`: builds a `ZipWriter`, adds `{id}.csv` (via `datasetToCSV`), adds `{id}-specs.json` (every chart document using that dataset: name/steps/mapping/geom/yScale), finds the chart SVG via `svg[data-chart-doc]` for a matching doc, rasterizes at 2× via `svgToPngBlob`, stores the PNG with `{store:true}` (already compressed), then `downloadBlob(zip.blob(), "{id}-bundle.zip")`.
- Added `data-chart-doc={docId}` to the `PlotSVG` `<svg>` element.
- Added a "↓ bundle" button to each dataset row in `DataApp` (blue, bordered), plus kept the delete `×` for uploaded datasets.
- Verified end-to-end: switched to explore workspace, re-pointed the chart tile's DOC dropdown to "α · seabirds", confirmed `svg[data-chart-doc="d1"]` present, clicked "↓ bundle", Playwright captured `seabirds-bundle.zip`. `unzip -t` passed; contents: `seabirds.csv` (2611B, 90 quoted rows), `seabirds-specs.json` (chart α spec), `seabirds-chart.png` (928×600 RGBA, valid PNG). VLM confirmed it's a scatter plot (not a line chart) — the dataset-matching fix worked.

### Why
- `data-chart-doc` decouples the PNG capture from page layout: whichever chart tile currently renders the bundled dataset gets rasterized, rather than an arbitrary first SVG.

### What worked
- Full bundle: CSV + specs JSON + PNG in one valid zip, dataset-matched PNG, `unzip -t` clean.

### What didn't work
- First end-to-end attempt (before the `data-chart-doc` fix) captured the climate line chart in the PNG because the explore workspace's on-screen chart was climate (doc β). Diagnosed via VLM image analysis ("multi-series line chart" instead of scatter), fixed by tagging SVGs and matching by dataset.

### What I learned
- The legend in `PlotSVG` is an HTML `<div>` sibling to the `<svg>`, not inside it — so `svgToPngBlob` captures only the plot, not the legend. Acceptable for a snapshot; documented as a known limitation.
- `svgToPngBlob` needs explicit `width`/`height` on the cloned SVG (from `viewBox.baseVal`) and an `xmlns` attribute, or the `<img>` fails to decode the data URL.

### What was tricky to build
- Selecting the *right* SVG: the page may render several charts across tiles/workspaces. The `data-chart-doc` attribute + matching against `world.docs.filter(datasetId)` is the robust solution; relying on DOM order is not.
- PNG `STORE` vs `DEFLATE`: PNGs are already deflate-compressed internally, so re-deflating wastes CPU; `{store:true}` skips compression and sets method=0. Both paths validated (`unzip -t` OK).

### What warrants a second pair of eyes
- `bundleDataset` picks the *first* matching chart document's SVG if several charts use the same dataset — could surprise a user who expected a specific chart. Low risk (the specs.json lists all of them) but consider letting the user choose, or bundling all matching chart PNGs.
- `svgToPngBlob` rasterizes whatever is currently rendered, including transient accept-mode outlines — fine for export but worth knowing.

### What should be done in the future
- Render the legend into the PNG: either move the legend inside the SVG, or composite the legend `<div>` via `html2canvas`-style capture. Out of scope for now.
- Add an "export" button in `ChartApp` too (design doc Phase B option), so a chart can be bundled without the data browser open.
- The PNG lacks axis titles; consider a `svgToPngBlob` variant that renders a title from the spec.

### Code review instructions
- `grep -n "bundleDataset\|data-chart-doc\|↓ bundle" imports/pbui-gog.jsx`
- Reproduce: explore workspace → re-point chart tile to α (seabirds) → click "↓ bundle" on seabirds → `unzip -t <download>` and `file *-chart.png`.

### Technical details
- Bundle contents: `{id}.csv`, `{id}-specs.json`, `{id}-chart.png` (2× scale, RGBA, white bg). PNG stored method=0 (STORE); CSV/specs method=8 (DEFLATE).
- `downloadBlob` revokes the object URL after 1s to avoid leaks.

### What I'd do differently next time
- Add the `data-chart-doc` tag in the same commit as the SVG helper, since PNG-matching is the obvious correctness risk — I caught it in testing, but it's the kind of invariant that belongs in the design from the start.

---

## Step 7: Write slide deck builder design doc

This step produced the design document for the slide deck builder before any deck code was written. The guide defines the data model (slides reference snapshot ids, not cloned specs), the zero-dependency inline markdown renderer, the accept-flow for adding snapshots to slides, a full-screen present overlay, and deck ZIP export reusing the Step 5 ZipWriter. Five decision records lock the key choices.

**Commit (docs):** b736db3 — "docs(pbui-gog): slide deck builder design guide"

### Prompt Context

**User prompt (verbatim):** "Instead of just a snapshot gallery, also add a slide deck builder where one can add snapshots to a slide, but also markdown text. Create a detailed design / implementation guide, then implement it."

**Assistant interpretation:** Design a deck builder that composes chart snapshots + markdown into ordered slides, then implement it across phased commits with a diary.

**Inferred user intent:** Let users sequence frozen charts with explanatory prose into a presentable narrative — a data story, not just a gallery.

### What I did
- Gathered line-anchored evidence: `World.snapshot`/`snaps[]` (`:750`), `<chart>` presentation handlers in `labelFor`/`describe`/`actionsFor` (`:2231`/`:2249`/`:2316`), `MiniPlot` (`:1308`), the accept protocol, `APPS`/`initialSpaces` (`:2086`/`:2109`), and the Step 5 `ZipWriter`/`svgToPngBlob`/`downloadBlob` for reuse.
- Wrote `design-doc/02-slide-deck-builder-design-and-implementation-guide.md`: exec summary, problem/scope, current-state analysis, gap table, proposed architecture (Deck model, `renderMarkdown`, `DeckApp`, `PresentApp`, `exportDeck`), 5 decision records (snapId reference vs clone; inline mini-markdown vs library; present overlay vs route; interactive `PlotSVG` vs `MiniPlot` in present; session-only decks for v1), pseudocode, 3-phase plan, test strategy, risks.
- Created docmgr tasks 7–10, marked task 7 done, updated changelog.

### Why
- Design-first forces the snapId-vs-clone and markdown-library decisions to be explicit before coding. Decks referencing `snapId` (not clones) keeps a single source of truth and graceful degradation when a snapshot is deleted — a property that's hard to retrofit.

### What worked
- The guide is concrete enough to implement directly: exact method signatures, ZIP entry layout, keyboard map for present mode.

### What didn't work
- (Nothing failed.)

### What I learned
- The shell already had every primitive the deck needs (snapshots, accept protocol, `MiniPlot`, `APPS` registry, ZipWriter). The deck is pure composition — the design doc makes that explicit via the gap table.

### What was tricky to build
- N/A (design step). The tricky bits (keyboard capture, deleted-snapshot defense, off-screen SVG rasterization for export) are called out as risks and handled in Steps 8–10.

### What warrants a second pair of eyes
- The decision to use interactive `PlotSVG` (not `MiniPlot`) in present mode: a live, R-clickable chart mid-presentation is distinctive but means present-mode charts are read-only renders of frozen specs (restoring into a live doc is separate). Confirm that matches the "presentation" mental model.

### What should be done in the future
- If decks prove useful, persist snapshots + decks together (currently both session-only). Persisting decks alone is useless since they reference snapshot ids.

### Code review instructions
- Read `design-doc/02-slide-deck-builder-design-and-implementation-guide.md`; cross-check line anchors against `imports/pbui-gog.jsx`.

### Technical details
- Slide schema: `{id, snapId: string|null, markdown: string}`. Deck: `{id, name, slides[], activeSlideIdx}`. Present keys: →/Space/PageDown next, ←/PageUp prev, Home/End, Esc exit, E toggle edit.

---

## Step 8: Add deck model + markdown renderer (Phase A)

This step built the deck data model in `World` and a zero-dependency inline markdown renderer. `World` gained a `decks[]` list with full deck/slide mutation methods, a seeded example deck, and present-mode state. The markdown renderer handles headings, bold, italic, inline code, and ordered/unordered lists — returning React nodes (no `dangerouslySetInnerHTML`). No UI yet; validated by clean parse + render.

**Commit (code):** 47f2d62 — "feat(pbui-gog): add deck model + markdown renderer (Phase A)"

### Prompt Context

**User prompt (verbatim):** (same as Step 7 — "…Create a detailed design / implementation guide, then implement it.")

**Assistant interpretation:** Implement Phase A of the deck design — the model and renderer, no UI.

**Inferred user intent:** Ship the deck data substrate and prose-rendering capability first, so Phase B (UI) has something to bind to.

### What I did
- Added `deckc`/`slidec` counters to the `seqc` line.
- Added `World.decks = []`, `activeDeckId`, `presentingDeck` to the constructor, plus a `seedDeck()` call that creates an "intro" deck with 3 slides (2 seeded-snapshot slides + 1 text-only slide demonstrating lists/italic/code).
- Added deck methods: `activeDeck`, `deck`, `newDeck`, `renameDeck`, `deleteDeck`, `addSlide`, `addSnapToActiveDeck`, `removeSlide`, `moveSlide`, `setSlideSnap`, `setSlideMarkdown` (no trace log — too chatty, just `bump`), `setActiveSlide`, `startPresent`, `stopPresent`.
- Added `renderInline(text, key)` + `renderMarkdown(md, baseKey)`: splits on blank lines into blocks; classifies `#`/`##`/`###` headings, `-`/`*` bullet lists, `N.` ordered lists, else paragraphs; inline pass splits on `**bold**`/`*italic*`/`` `code` ``.
- Added `deck_*`, `slide_*`, `present_*` trace event colors to `EV_COLOR`.
- Verified: reloaded page, 0 console errors.

### Why
- Slides reference `snapId` (Decision 1) so the model stays tiny and the snapshot stays the single source of truth. `setSlideMarkdown` skips `log()` because every keystroke would flood the trace; it just `bump()`s to re-render.

### What worked
- Clean parse on first load; the seeded "intro" deck appears in the (not-yet-built) deck state. The markdown renderer's inline single-regex pass handles the common cases without a parser dependency.

### What didn't work
- (Nothing failed in this step.)

### What I learned
- A ~40-line markdown renderer covers ~95% of slide-prose needs (headings, emphasis, code, lists). The gap vs CommonMark (tables, raw HTML, nested lists) is acceptable and documented.

### What was tricky to build
- The inline parser ordering: `**bold**` must be matched before `*italic*` or the italic rule eats the double-asterisk. Solved by one regex alternation `(\*\*(.+?)\*\*|\*(.+?)\*|` `(.+?)` `)` tried left-to-right.
- `setSlideMarkdown` mutates a nested object (`deck.slides[i].markdown`); since `World` state isn't immutable React state, `bump()` (a force-update) is what propagates the change. Same pattern as the rest of `World`.

### What warrants a second pair of eyes
- `deleteDeck` refuses when `< 2` decks (mirrors `deleteDoc`). Confirm that's the desired floor — a user might want to delete the last deck to get a clean slate.
- `setActiveSlide` clamps `idx` but doesn't `log()`; intentional (navigation is chatty) but means the trace won't show slide-to-slide moves in present mode.

### What should be done in the future
- If decks persist, snapshot deletion must cascade-clean `slide.snapId` across all decks (currently leaves an orphan id defended by `.find()` returning undefined at render time).

### Code review instructions
- `grep -n "activeDeck()\|newDeck\|addSlide\|renderMarkdown" imports/pbui-gog.jsx`
- Console: after load, the deck workspace (Step 9) shows the seeded 3-slide "intro" deck.

### Technical details
- `renderMarkdown` returns an array of React elements keyed by `baseKey + "-" + blockIndex`; each block's inline spans keyed `baseKey + "-" + bi + "-" + li`.

---

## Step 9: Build DeckApp editor + workspace + chart menu verb (Phase B)

This step built the `DeckApp` editor UI and wired it into the shell. The editor has a deck selector strip, a slide list (add/remove/reorder, click-to-activate), and a slide editor (chart accept, markdown textarea with live preview). It registers a `deck` app, adds a deck workspace, makes `deck` a first-class presentation type in `labelFor`/`describe`/`actionsFor`, and adds an "Add to active deck as a slide" verb on `<chart>` snapshots. An `exportDeck` stub was added so Phase B parses before Phase C implements it.

**Commit (code):** 8591e43 — "feat(pbui-gog): DeckApp editor + workspace + chart menu verb (Phase B)"

### Prompt Context

**User prompt (verbatim):** (same as Step 7)

**Assistant interpretation:** Implement Phase B — the DeckApp editor and shell integration.

**Inferred user intent:** A usable deck editor where one can assemble snapshots + markdown into slides.

### What I did
- Wrote `DeckApp`: deck strip (chips + `+ deck` + `▶ present` + `↓ export zip`), left slide-list panel (`+ slide`, `+ chart slide…` accept, per-slide ↑↓× + thumbnail + markdown first-line), right slide editor (chart chip + `⌖ set chart…` accept + `× clear`, a markdown textarea, and a live `renderMarkdown` preview with an optional `MiniPlot` thumbnail).
- Registered `deck` in `APPS` (`{ title: "slide deck", color: C.red, comp: DeckApp }`) and added a `deck` workspace to `initialSpaces` (deck | gallery/trace).
- Added `deck` to `labelFor`/`describe`/`actionsFor`: deck chip menu has "Make ACTIVE deck", "▶ Present", "Export .zip", "Rename", "Delete".
- Added "Add to active deck as a slide" to the `ptype === "chart"` actions (calls `world.addSnapToActiveDeck(value)`).
- Added an `exportDeck` stub so Phase B parses before Phase C.
- Verified: deck workspace renders the seeded 3-slide deck; `+ slide` adds a 4th; typing markdown updates the live preview.

### Why
- The deck strip mirrors the workspace-chip pattern; the slide-list/editor split mirrors common slide-tool UX. Reusing the accept protocol for "+ chart slide…" and "⌖ set chart" keeps the interaction model uniform with the rest of the shell.

### What worked
- Full editor: add/remove/reorder slides, live markdown preview, accept-flow to add/set a chart snapshot. The seeded deck renders immediately, so the feature is demoable on first load.

### What didn't work
- First attempt to register `deck` in `APPS` failed silently: my `edit` `oldText` assumed a trailing comma after the `compare` entry that didn't match (the original had `compare: {...},` then `watch: {...},` — my oldText merged them wrongly and the replacement targeted `compare`+`watch` but only matched a subset). The symptom: switching to the deck workspace threw `TypeError: Cannot read properties of undefined (reading 'comp')` at `TileView` because `APPS["deck"]` was undefined. Fixed by re-targeting the edit to insert `deck` between `compare` and `watch` with the correct surrounding context. **Lesson: when an `edit` claims success but a downstream feature is broken, grep for the expected new content to confirm it actually landed.**

### What I learned
- The `edit` tool reports success per-block, but a block can "succeed" by matching a smaller-than-intended region if the oldText isn't unique/anchored enough. Always verify edits with a grep for the inserted content.

### What was tricky to build
- The `exportDeck` forward-reference: `DeckApp`'s `↓ export zip` button calls `exportDeck`, which is implemented in Phase C. Adding a stub (logging only) lets Phase B parse and render; Phase C replaces the body. This is a deliberate phased-decomposition tradeoff.

### What warrants a second pair of eyes
- `addSnapToActiveDeck` creates a deck if none exists (`if (!this.activeDeck()) this.newDeck()`) — confirm this implicit creation is desired vs. erroring with "create a deck first".
- The slide-list click-to-activate also fires on the ↑/↓/× controls; they `e.stopPropagation()` to prevent that. Verify no control misses the stop.

### What should be done in the future
- Drag-to-reorder slides (currently ↑/↓ buttons only). The shell's drag infra could be reused but it's tile-oriented; slide drag is a separate concern.
- A slide `<slide>` presentation type so slides themselves are inspectable/referenced — explicitly out of scope per Decision (rejected) in the design doc.

### Code review instructions
- `grep -n "function DeckApp\|ptype === \"deck\"\|addSnapToActiveDeck" imports/pbui-gog.jsx`
- Reproduce: deck workspace → deck tile shows 3 slides → `+ slide` → type markdown → preview updates.

### Technical details
- `DeckApp` uses `w.activeDeck()` (falls back to `decks[0]`); the deck strip sets `w.activeDeckId = d.id; w.bump()` directly rather than a method (minor inconsistency with the `setActive` pattern elsewhere — noted).

---

## Step 10: Add present mode + deck ZIP export (Phase C)

This step built the full-screen `PresentApp` overlay with keyboard navigation and the `exportDeck` ZIP exporter (reusing the Step 5 `ZipWriter` + `svgToPngBlob`). Present mode renders the active slide's chart via interactive `PlotSVG` plus rendered markdown, with →/←/Home/End/E/Esc keys. Deck export zips `deck.md` (slides as markdown with image refs) + one PNG per chart slide, rasterized by mounting a temporary `MiniPlot` to a detached DOM node.

**Commit (code):** 2e3752c — "feat(pbui-gog): persist workspace layout to localStorage" (⚠️ see "What was tricky")

### Prompt Context

**User prompt (verbatim):** (Step 7 request continued, then the user redirected: "Save workspace setup in localstorage to not lose it.")

**Assistant interpretation:** Implement Phase C — present mode + export — then (per the redirect) workspace persistence.

**Inferred user intent:** A presentable deck (full-screen, keyboard-driven) and a portable export.

### What I did
- Wrote `PresentApp`: fixed overlay (z-index 500), header with deck name + `slide N / M` + hint + exit button, body with the slide's `PlotSVG` (interactive, `docId={null}`) on the left and rendered markdown (or a textarea in edit mode) on the right. Capture-phase `keydown` listener handles →/Space/PageDown, ←/PageUp, Home, End, `E` (toggle edit), Esc (exit) with `stopPropagation` + `preventDefault`.
- Mounted `{world.presentingDeck && <PresentApp />}` at the App root (inside `UICtx.Provider`, after the menu block).
- Implemented `exportDeck(world, deckId)`: builds a `ZipWriter`; for each slide, if it has a snapshot, mounts a temporary `MiniPlot` to a detached `<div>` via `createRoot`, waits for render, `svgToPngBlob`s it at 2×, stores the PNG (`store:true`), unmounts; concatenates `deck.md` (heading + `![name](slide-N.png)` + markdown, joined by `---`); `downloadBlob`.
- Added `createRoot` import from `"react-dom/client"` (the auto-mount wrapper aliases it, so the artifact must import it explicitly).
- Verified present mode: overlay shows, ArrowRight navigates slide 1→2, Escape exits.
- Verified export: downloaded `intro-deck.zip`; `unzip -t` passed; `deck.md` is coherent (3 slides, image refs on 1 & 3, `---` separators); `slide-1.png`/`slide-3.png` are valid 1120×680 RGBA PNGs; slide-2 (text-only) correctly has no PNG.

### Why
- `PlotSVG` (not `MiniPlot`) in present mode honors Decision 4: a live, R-clickable chart mid-presentation. `exportDeck` reuses the Step 5 ZIP/SVG helpers so no new dependency. Mounting `MiniPlot` to a detached node for rasterization is the cleanest way to PNG a frozen spec without a visible tile.

### What worked
- Present overlay + keyboard nav + Esc exit, all on first try. Deck export produced a valid zip with coherent markdown + valid PNGs; the text-only slide correctly omitted a PNG.

### What didn't work
- **Commit hygiene failure:** I implemented Phase C (`PresentApp` + `exportDeck`) but did not commit it separately. When the user then asked for workspace persistence, I implemented that *and* committed it together with the already-uncommitted Phase C changes under the message "feat(pbui-gog): persist workspace layout to localStorage" (commit `2e3752c`). The commit message does not mention present mode or deck export, so `git log`/`git blame` for those features points at a misleadingly-titled commit. This was caught only when later auditing the diary. **Not retroactively rewritten** (history rewrite on a not-yet-pushed branch was possible but the work was already layered correctly; the message is the only defect).

### What I learned
- **Commit when a phase is verifiably done, before moving to the next request.** I had a clean working tree opportunity after verifying present mode + export and instead jumped to the next feature. The result is a misleading commit. The fix going forward: after each phase's verification, `git add -p` + commit immediately, even if the user's next message is already queued.

### What was tricky to build
- `exportDeck`'s off-screen rasterization: `MiniPlot` is a React component, so to PNG a frozen chart spec without a visible tile I mount it to a detached `<div>` via `createRoot(holder)`, `root.render(<MiniPlot .../>)`, wait a tick (`setTimeout 30ms`) for the SVG to land, `holder.querySelector("svg")`, rasterize, then `root.unmount()`. The wait is a heuristic; if the chart is heavy the SVG may not be ready at 30ms. Acceptable for the seeded/frozen specs.
- Keyboard capture: the present `keydown` listener uses capture-phase (`true`) + `stopPropagation` so tile-level shortcuts (Esc-to-abort-accept, etc.) don't fire under the overlay. Verified that Esc exits present, not the accept protocol.
- `createRoot` import: the serve-artifacts auto-mount wrapper imports `react-dom/client` *aliased* (`__artifactCreateRoot`), so `ReactDOM` global isn't available; the artifact must `import { createRoot } from "react-dom/client"` itself.

### What warrants a second pair of eyes
- The `setTimeout(30ms)` rasterization wait in `exportDeck` is a race risk for heavy charts. If a slide PNG comes out blank/missing, this is the first suspect. A more robust approach would poll for `holder.querySelector("svg")` up to a timeout.
- Present mode's `PlotSVG` is rendered with `docId={null}`; R-clicking a mark and choosing a filter verb would call `world.filterToCat(null, …)` which targets the active doc — potentially confusing mid-presentation. Low risk (present mode is for viewing) but worth knowing.
- `exportDeck`'s detached `createRoot` leaves React 18 concurrent-mode scheduling concerns: `root.render` then immediate `unmount` is synchronous enough here, but in StrictMode dev it could double-render. No effect on output (idempotent render), just wasted work.

### What should be done in the future
- Replace the `setTimeout(30ms)` rasterization wait with a `requestAnimationFrame` + `querySelector("svg")` poll (bounded retries) for robustness.
- Add a present-mode progress indicator and a "next deck" affordance (currently one deck per present session).
- Render the chart legend into the export PNG (currently the legend is an HTML `<div>` sibling to the SVG, so `svgToPngBlob` captures only the plot — same limitation noted in the ZIP export Step 6).

### Code review instructions
- `grep -n "function PresentApp\|async function exportDeck\|world.presentingDeck && <PresentApp" imports/pbui-gog.jsx`
- Reproduce: deck workspace → `▶ present` → ArrowRight/ArrowLeft/Home/End/E/Esc. Then `↓ export zip` → `unzip -t` → inspect `deck.md` + PNGs.

### Technical details
- Present overlay: `position: fixed; inset: 0; z-index: 500`. Keyboard listener: `window.addEventListener("keydown", onKey, true)` (capture phase). Export zip layout: `[slide-1.png? …] deck.md`, PNGs stored method=0, deck.md deflated method=8.
- `exportDeck` mounts `MiniPlot` at `W=560 H=340`, rasterizes at `scale=2` → 1120×680 PNG.

### What I'd do differently next time
- Commit Phase C immediately after its verification, under an accurate message, before starting workspace persistence. The interleaving that produced the misleading `2e3752c` was avoidable.

---

## Step 11: Persist workspace layout to localStorage

This step made the workspace/tile layout survive a page reload. The split tree + active space id are saved to `localStorage["pbui-workspaces"]` on every change and restored on init. The critical correctness concern was the leaf-id counter (`idc`): restored tile ids must not collide with newly-created ones, so `loadSpaces` walks the restored trees, finds the max leaf id, and bumps `idc` past it.

**Commit (code):** 2e3752c — "feat(pbui-gog): persist workspace layout to localStorage"

### Prompt Context

**User prompt (verbatim):** "Save workspace setup in localstorage to not lose it."

**Assistant interpretation:** Persist the workspace arrangement (split tree + active workspace) to localStorage so a reload doesn't lose it.

**Inferred user intent:** A user who has arranged their tiles/workspaces shouldn't lose that arrangement on refresh.

### What I did
- Added `LS_SPACES_KEY = "pbui-workspaces"` + `loadSpaces(world)` / `saveSpaces(spaces, cur)` helpers near the existing OPFS/localStorage helpers.
- `loadSpaces`: parses `{spaces, cur}`; validates `spaces` is a non-empty array and `cur` exists within it; walks each tree collecting leaf/split ids, finds the max numeric id, and sets `idc = maxN + 1` so future `nid()` calls never reuse a restored id.
- Changed the `spaces` `useState` initializer to try `loadSpaces` first, falling back to `initialSpaces(world)`; same for `cur`.
- Added a `useEffect(() => { saveSpaces(spaces, cur); }, [spaces, cur])` to persist on every change.
- Verified: added a workspace + split a tile → reload → layout restored (10 workspaces, custom split tree, active space restored, status line "2 tiles · 10 workspaces"). After reload, a fresh split produced ids `n61`/`n62` — both above the restored max of `60`, confirming no collision.

### Why
- The leaf-id collision is the real risk: if `idc` weren't bumped past restored ids, `nid()` could return an id already in a restored tree, confusing React keys and the drag/hit-test (`leafRefs` keyed by id). Doc ids (`d1`,`d2`) are deterministic from `World`, so chart/table/pipeline tiles re-bind correctly without extra persistence.

### What worked
- End-to-end persistence + counter bump verified by the split→reload→split sequence (no collision).

### What didn't work
- (Nothing failed functionally.) As noted in Step 10, this commit also bundled the uncommitted Phase C deck code — a commit-hygiene defect, not a code defect.

### What I learned
- `localStorage` serialization of the tree is trivial (it's plain JSON-able objects); the only subtlety is the id-counter invariant, which is invisible until a collision manifests as a mysterious drag/React-key bug. Documenting it in `loadSpaces` is essential.

### What was tricky to build
- The id-counter invariant: not obvious that it's needed. The symptom of getting it wrong (a restored tile id colliding with a new one) would be a subtle, hard-to-reproduce drag/key bug. The fix (bump `idc` past restored max) is a one-liner but only obvious in hindsight.

### What warrants a second pair of eyes
- `loadSpaces` trusts the persisted JSON's tree shape. If a future code change adds a required node field, old persisted trees would load without it. Consider a schema version field (`v: 1`) in the stored object and a migration path. Low risk now (only `id`/`type`/`dir`/`a`/`b`/`ratio`/`app`/`doc`).
- If a persisted workspace references a `doc` id that no longer exists (it always does, since `World` is deterministic, but if `World` ever becomes stateful/persisted differently), `w.doc(docId)` falls back gracefully — but the tile would silently rebind. Confirm the fallback is acceptable.

### What should be done in the future
- Add a schema version + a "reset layout" button in the UI (currently requires `localStorage.removeItem("pbui-workspaces")` from devtools).
- Persist the per-tile `app` selection's doc binding explicitly if `World` docs ever become non-deterministic.

### Code review instructions
- `grep -n "loadSpaces\|saveSpaces\|LS_SPACES_KEY\|idc = maxN + 1" imports/pbui-gog.jsx`
- Reproduce: split a tile + add a workspace → reload → layout intact. Then split again → new tile id > restored max.

### Technical details
- Stored shape: `{spaces: [{id, name, tree}, …], cur: "<spaceId>"}`. Tree nodes: `{id, type:"leaf"|"split", app?, doc?, dir?, a?, b?, ratio?}`.
