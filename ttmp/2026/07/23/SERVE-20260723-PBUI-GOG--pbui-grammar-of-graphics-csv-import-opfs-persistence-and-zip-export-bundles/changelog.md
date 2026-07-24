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


## 2026-07-23

Step 7: write slide deck builder design doc (slides referencing snapshots, inline markdown renderer, present overlay, deck ZIP export)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/ttmp/2026/07/23/SERVE-20260723-PBUI-GOG--pbui-grammar-of-graphics-csv-import-opfs-persistence-and-zip-export-bundles/design-doc/02-slide-deck-builder-design-and-implementation-guide.md — slide deck builder design


## 2026-07-23

Step 8: deck model (World.decks/slide methods) + inline markdown renderer, Phase A (commit 47f2d62)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/pbui-gog.jsx — World.decks, deck/slide methods, renderMarkdown


## 2026-07-23

Step 9: DeckApp editor + deck workspace + chart menu 'add to slide' verb, Phase B (commit 8591e43)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/pbui-gog.jsx — DeckApp, deck app/workspace, deck ptype actions


## 2026-07-23

Step 10: PresentApp overlay (keyboard nav) + exportDeck ZIP (deck.md + per-slide PNGs), Phase C (commit 2e3752c)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/pbui-gog.jsx — PresentApp, exportDeck, createRoot import


## 2026-07-23

Step 11: persist workspace layout (split tree + active space) to localStorage with idc counter bump to prevent leaf-id collisions (commit 2e3752c)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/pbui-gog.jsx — loadSpaces/saveSpaces, LS_SPACES_KEY, idc bump

