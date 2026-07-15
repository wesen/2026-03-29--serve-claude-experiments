# Changelog

## 2026-07-13

- Initial workspace created


## 2026-07-14

Implemented the visual-browsing layer end to end: content hash (2a68d2c), thumbnail service with chromedp render + content-hash cache + bounded pool/singleflight + backfill/renderOK (56f57d0), gallery thumbnails (55358e9), detail page + /api/artifact + /transcript (f129d32), grid/list toggle (b51fea5), and follow-ons dark mode/command palette/keyboard nav (786da71). All tests green; verified live via curl + Playwright.

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/artifact.html — Artifact detail page
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/thumbnail.go — Thumbnail service (engine, cache, pool, singleflight)


## 2026-07-14

Follow-on enhancements (Steps 8-13): self-contained Docker image with bundled Chrome (7211a03); detail-page embed view + highlighted/copyable/downloadable source + theater mode + session zip (f09d72b); Tailwind in the JSX host page + thumbnail render-env versioning (8ddd2e5); transcript rendered as HTML via goldmark (7236139); collections UX fixes + footer restyle + 404 sentinel (9a9c080); tag single-render dedup (638736c).

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/Dockerfile — Self-contained image (Step 8)
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/artifact.html — Detail-page enhancements (Step 9)
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/transcript.html — Rendered transcript (Step 11)


## 2026-07-14

Step 14: advanced search — query syntax (tag:/model:/type:/is:/has:/after:/before:) + date-range filters + ⚙ UI panel (commit 8daa80e)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/query.go — Query-syntax parser + date bounds


## 2026-07-14

Steps 15-16: recapture thumbnail from live view + server re-render (a79f027); URL scroll/state restore so Back returns to the exact place (06f8556)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/artifact.html — Thumbnail recapture UI (Step 15)
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/index.html — URL scroll/state restore (Step 16)


## 2026-07-14

Steps 17-19: capture shortcut → Ctrl/Cmd+Shift+C (9a5f14e); project UUID→name resolution via projects.json (7beb6af); gallery lightbox+magnifier, fixed chrome/scrollable results, shareable gallery URLs via History API (daaa4ce)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/index.go — Project name resolution (Step 18)


## 2026-07-14

Step 20: mobile hamburger drawer — search/filters/facets fold into a sticky unfoldable menu on ≤720px, refinable while scrolled; desktop unchanged (commit 7efa012)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/index.html — Mobile drawer re-parenting (Step 20)


## 2026-07-14

Step 21: full-resolution capture stored (<hash>-full.png) and served to the gallery lightbox via /thumb?full=1; small thumbnails still 480px (commit a5ab6e5)


## 2026-07-14

Step 22: drop implausible future-dated models (API returns current default for old convos); blanked 70 pre-2025 artifacts mislabeled claude-sonnet-4-5-20250929 (commit 4c2f185)

