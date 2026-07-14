# Changelog

## 2026-07-13

- Initial workspace created


## 2026-07-14

Implemented the visual-browsing layer end to end: content hash (2a68d2c), thumbnail service with chromedp render + content-hash cache + bounded pool/singleflight + backfill/renderOK (56f57d0), gallery thumbnails (55358e9), detail page + /api/artifact + /transcript (f129d32), grid/list toggle (b51fea5), and follow-ons dark mode/command palette/keyboard nav (786da71). All tests green; verified live via curl + Playwright.

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/artifact.html — Artifact detail page
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/thumbnail.go — Thumbnail service (engine, cache, pool, singleflight)

