---
Title: 'ZIP export bundles: implementation guide'
Ticket: SERVE-20260723-PBUI-GOG
Status: active
Topics:
    - pbui
    - grammar-of-graphics
    - zip
    - react
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://imports/pbui-gog.jsx
      Note: ZIP writer + bundle UI implemented per this guide
ExternalSources: []
Summary: Implementation guide for client-side ZIP export bundles (CSV + PNG) in the pbui-gog.jsx artifact, using native browser APIs with zero external dependencies.
LastUpdated: 2026-07-23T16:45:00-04:00
WhatFor: Designing and implementing the ZIP export feature end-to-end
WhenToUse: When implementing or reviewing the ZIP bundle export in pbui-gog.jsx
---


# ZIP export bundles: implementation guide

## 1. Executive summary

Add a **client-side ZIP export** to the `pbui-gog.jsx` artifact so a user can download a single `.zip` containing a dataset's CSV plus its rendered chart PNG, with **zero external dependencies and zero additional network requests**. The implementation uses the browser's native `CompressionStream('deflate-raw')` for compression plus a hand-written ZIP central-directory writer (~80 lines). No WASM, no npm packages, no changes to the Go server or the import map.

This keeps the artifact self-contained: it preserves the "drop a `.jsx` into `imports/` and it works" property that the serve-artifacts server is built around (the JSX host page at `pkg/server/templates/jsx-host.html:12-20` loads only React from esm.sh via an import map; adding a ZIP library would mean either adding an import-map entry or bundling).

## 2. Problem statement and scope

**Problem.** The workbench can already import CSVs and render charts from them (Step 1 of this ticket), but there is no way to take a dataset + its visualization off-line as a single artifact. Users want a reproducible bundle: the raw data file plus a picture of the chart.

**Scope.**

- In scope: a `ZipWriter` helper (CRC32 + local file headers + central directory + EOCD), PNG rasterization of the current chart SVG, a "Download bundle (.zip)" button in the `DataApp` UI, and an optional per-snapshot bundle.
- Out of scope: reading/parsing existing ZIPs, exotic codecs (zstd/brotli), server-side packaging, and a general file manager. PNGs are stored with `STORE` (no recompression) since they are already deflate-compressed internally; CSVs use `DEFLATE`.

## 3. Current-state analysis (evidence)

The CSV import + OPFS persistence layer is already in place (Step 1, committed separately). The relevant anchors:

- `imports/pbui-gog.jsx:1199` — `DataApp` already owns the upload UI (file input, paste textarea, drop target) and an `ingestText` flow that calls `parseCSV` → `w.importDataset` → `persistDataset`. The export button belongs here, next to the upload affordance.
- `imports/pbui-gog.jsx:360` — `persistDataset(ds, csvText)` writes the raw CSV text to OPFS; the same source text is the natural input to a CSV-in-zip entry.
- `imports/pbui-gog.jsx:1116` — `PlotSVG({ chart, W, H, docId })` renders the interactive chart as an inline `<svg>`. This is the element to rasterize for the PNG entry.
- `imports/pbui-gog.jsx:1504` — `ChartApp` mounts `PlotSVG` with `W={560} H={300}`.
- `pkg/server/templates/jsx-host.html:12` — the import map. Adding a dependency here is **not** required for the chosen approach.

## 4. Gap analysis

| Need | Current state | Gap |
|------|---------------|-----|
| Produce a `.zip` in-browser | None | No ZIP writer |
| Get chart as PNG | Only inline `<svg>` DOM | No raster path (SVG → canvas → PNG) |
| Trigger download | None | No download helper |
| CSV source text for the entry | `DATASETS[id]` has rows, not the original CSV | Need a `datasetToCSV()` serializer |

## 5. Proposed architecture and APIs

Three pure helpers plus one UI button. All live inside `pbui-gog.jsx` (single-file artifact constraint — no new files on disk).

### 5.1 `ZipWriter` (the core)

```js
class ZipWriter {
  constructor() { this.entries = []; }
  async add(name, data, { level = "deflate" } = {}) {
    // data: Uint8Array | string.  string → TextEncoder.
    // Returns nothing; stores {name, data, crc32, method, compressed}.
  }
  async blob() {
    // Concatenate: local headers + data, then central directory, then EOCD.
    // Uses CompressionStream('deflate-raw') when method=deflate.
  }
}
```

**ZIP on-disk format contracts** (all offsets from first local header; multi-byte little-endian):

- Local file header: signature `0x04034b50`, version (20), flags (0), method (0=STORE / 8=DEFLATE), modtime, moddate, crc32, compressed size, uncompressed size, name length, extra length(0), name.
- Central directory record: signature `0x02014b50`, version made/by (20), version needed (20), flags(0), method, modtime, moddate, crc32, compressed size, uncompressed size, name length, extra(0), comment(0), disk(0), int attrs(0), ext attrs(0), local header offset, name.
- EOCD: signature `0x06054b50`, disk(0), cd disk(0), cd entries, cd size, cd offset, comment(0).

### 5.2 CRC32

Standard reversed-polynomial `0xEDB88320` table, precomputed once. Pure JS, ~15 lines.

### 5.3 SVG → PNG

```js
async function svgToPngBlob(svgEl, scale = 2) {
  // Serialize svg → data URL → <img> → <canvas scale×> → toBlob("image/png")
}
```

### 5.4 CSV serializer

```js
function datasetToCSV(ds) {
  // ds.fields, ds.rows → header + rows, RFC4180-quoting fields that contain , " \n
}
```

### 5.5 Download trigger

```js
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  // <a download> → click → revokeObjectURL
}
```

### 5.6 UI: bundle button in `DataApp`

A `Btn` per dataset row: "↓ bundle". For the **active chart's source dataset**, it zips `{dataset-id}.csv` + `chart.png`. For uploaded datasets without a chart, it zips just the CSV. A second, optional entry point lives in `ChartApp` ("↓ export") so a chart can be exported with its source CSV even when the data browser is not open.

## 6. Decision records

### Decision: zero-dependency native `CompressionStream` over a ZIP library

- **Context:** The artifact must stay a single self-contained `.jsx` with no build step. The host page loads dependencies only via the esm.sh import map; adding `client-zip`/`fflate`/`jszip` would add either an import-map entry (server change) or a vendored blob in the JSX.
- **Options considered:** (a) `client-zip` via esm.sh import map; (b) `fflate` WASM; (c) native `CompressionStream('deflate-raw')` + hand-written central directory.
- **Decision:** (c).
- **Rationale:** ZIP is a simple container; `deflate-raw` is the exact deflate variant ZIP uses, so native compression produces standard ZIPs. Zero deps keeps the artifact portable and the server untouched. PNGs already contain deflate streams, so storing them with `STORE` is both faster and smaller.
- **Consequences:** We own ~80 lines of binary-format code (CRC32 + offsets) that must be correct; this is validated by round-trip unzipping. `CompressionStream` is available in all current browsers (Chrome ≥80, Firefox ≥113, Safari ≥16.4). Enables: no network cost, instant availability.
- **Status:** accepted

### Decision: `STORE` for PNG, `DEFLATE` for CSV

- **Context:** PNGs are internally deflate-compressed; re-deflating them wastes CPU and rarely shrinks them.
- **Options considered:** DEFLATE everything; STORE everything; STORE PNG + DEFLATE text.
- **Decision:** STORE PNG + DEFLATE CSV.
- **Rationale:** Best size/speed tradeoff and what real ZIP tools do for already-compressed media.
- **Consequences:** Two code paths in `ZipWriter.add`; both must set the method flag correctly so unzip tools honor it. Validate both entries unzip correctly.
- **Status:** accepted

### Decision: serialize CSV from `DATASETS` rows rather than read OPFS

- **Context:** The original uploaded CSV text lives in OPFS, but the in-memory `DATASETS[id]` may have been mutated by the pipeline (the pipeline is applied at render time, not stored). For an export bundle we want the **source table**, not the pipeline output.
- **Options considered:** (a) `opfsRead(id)` to fetch the original text; (b) `datasetToCSV(DATASETS[id])`.
- **Decision:** (b).
- **Rationale:** Works for built-in mock datasets too (which have no OPFS text), and guarantees the CSV matches what the chart's source table is. Single code path.
- **Consequences:** Quoting/escaping must be correct (RFC4180). Round-trip: re-importing the exported CSV must reproduce the same `DATASETS[id]` up to type inference.
- **Status:** accepted

## 7. Pseudocode and key flows

### `ZipWriter.blob()` flow

```
for each entry:
  raw = entry.data (Uint8Array)
  crc = crc32(raw)
  if method == deflate:
    compressed = await deflateRaw(raw)        // CompressionStream
  else:
    compressed = raw
  offset = currentTotalBytes
  emit local header (crc, sizes, method, name)
  emit compressed
  record central-dir entry {name, crc, sizes, method, offset}
emit central directory (all entries)
emit EOCD (cdOffset, cdSize, count)
return new Blob(chunks, {type: "application/zip"})
```

### `svgToPngBlob` flow

```
xml = new XMLSerializer().serializeToString(svg)
svg2 = inject width/height + xmlns if missing
dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg2)
img.src = dataUrl; await img.decode()
canvas = scale * img dims; ctx.drawImage(img, 0,0)
return await canvas.toBlob("image/png")
```

### Bundle assembly

```
ds = DATASETS[datasetId]
csv = datasetToCSV(ds)                      // string
zip = new ZipWriter()
await zip.add(ds.id + ".csv", csv)           // DEFLATE
if (chartSvgEl) {
  png = await svgToPngBlob(chartSvgEl, 2)
  await zip.add(ds.id + "-chart.png", pngBytes, {level:"store"})
}
blob = await zip.blob()
downloadBlob(blob, ds.id + "-bundle.zip")
```

## 8. Implementation phases

**Phase A — Core helpers (no UI).** Add `crc32`, `ZipWriter`, `datasetToCSV`, `svgToPngBlob`, `downloadBlob` to `pbui-gog.jsx`. Validate in the browser console by building a tiny zip and unzipping it. Commit.

**Phase B — UI wiring.** Add a "↓ bundle" button to `DataApp` (per dataset) and optionally to `ChartApp`. Wire it to the helpers. Validate end-to-end: upload CSV → render chart → download bundle → unzip → confirm both files. Commit.

## 9. Test strategy

Because this is a browser-only single-file artifact with no test runner, validation is manual but rigorous:

1. **Unit round-trip in console:** `zip.add("a.txt","hi"); zip.blob() → download → unzip` confirms CRC/headers/EOCD.
2. **CSV round-trip:** `datasetToCSV` output re-imported via the upload UI reproduces the dataset.
3. **PNG validity:** downloaded PNG opens in an image viewer and matches the on-screen chart.
4. **End-to-end:** upload `test_metrics.csv`, render a line chart, click "↓ bundle", unzip the download, confirm `test_metrics.csv` (12 rows) + `test_metrics-chart.png`.
5. **Cross-check unzip:** `unzip -l` and `unzip -t` on the downloaded file (download via Playwright, inspect with system `unzip`).

## 10. Risks, alternatives, open questions

- **Risk: `CompressionStream('deflate-raw')` browser support.** All current evergreen browsers support it. If a target doesn't, fall back to `STORE` for all entries (still a valid ZIP, just uncompressed). Detect with `typeof CompressionStream`.
- **Risk: SVG rasterization of `currentColor`/external fonts.** The chart uses inline styles and system mono fonts; rasterization may differ slightly from screen. Acceptable for a snapshot; document it.
- **Risk: tainting the canvas.** The SVG is same-origin inline content, so `toBlob` will not taint the canvas. No external images are embedded in the chart SVG.
- **Alternative (rejected): JSZip.** Mature but ~100KB and needs bundling/import-map; violates the zero-dep constraint.
- **Open question:** Should the bundle include the chart **spec JSON** (pipeline + encoding) as a third entry? Cheap and useful for reproducibility. Decision: yes, add `{dataset-id}-spec.json` in Phase B.

## 11. References

- `imports/pbui-gog.jsx:1199` — `DataApp` (upload UI, export button goes here)
- `imports/pbui-gog.jsx:1116` — `PlotSVG` (chart SVG to rasterize)
- `imports/pbui-gog.jsx:1504` — `ChartApp` (optional export button)
- `imports/pbui-gog.jsx:360` — `persistDataset` (OPFS write, for reference)
- `pkg/server/templates/jsx-host.html:12` — import map (unchanged)
- ZIP spec: PKWARE APPNOTE 6.3.10, sections 4.3.6–4.3.12, 4.4
