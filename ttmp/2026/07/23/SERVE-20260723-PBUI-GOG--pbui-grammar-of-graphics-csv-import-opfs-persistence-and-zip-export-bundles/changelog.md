# Changelog

## 2026-07-23

- Initial workspace created


## 2026-07-23

Steps 1-4: import pbui-gog.jsx, switch to multi-doc version, add CSV upload+OPFS persistence, write ZIP export design doc (commit a1f44b0)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/pbui-gog.jsx — CSV upload + OPFS persistence layer
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/ttmp/2026/07/23/SERVE-20260723-PBUI-GOG--pbui-grammar-of-graphics-csv-import-opfs-persistence-and-zip-export-bundles/design-doc/01-zip-export-bundles-implementation-guide.md — ZIP export design


## 2026-07-23

Step 5: implement zero-dep ZIP writer (CRC32 + ZipWriter via CompressionStream deflate-raw) + CSV/SVG-PNG/download helpers (commit 61d2056)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/pbui-gog.jsx — ZipWriter, crc32, deflateRaw, datasetToCSV, svgToPngBlob, downloadBlob


## 2026-07-23

Step 6: wire bundle download UI (bundleDataset + ↓ bundle button, data-chart-doc PNG matching) (commit 3df2f60)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/pbui-gog.jsx — bundleDataset, DataApp bundle button, PlotSVG data-chart-doc

