---
Title: 'Implementation diary'
Ticket: SERVE-20260723-PBUI-GOG
Status: active
Topics:
    - pbui
    - diary
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Chronological implementation diary for pbui-gog.jsx: import, CSV upload, OPFS persistence, and ZIP export bundles."
LastUpdated: "2026-07-23"
WhatFor: "Recording the step-by-step implementation journey for the pbui-gog work"
WhenToUse: "When resuming or reviewing pbui-gog work"
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
