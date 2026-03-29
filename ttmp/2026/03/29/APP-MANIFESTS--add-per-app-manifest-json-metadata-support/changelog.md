# Changelog

## 2026-03-29

- Initial workspace created
- Added the initial design and implementation guide for per-app manifest JSON support

## 2026-03-29

Implemented local companion manifests, backfilled manifests for every current imported artifact, added first-pass metadata rendering in the index, shipped /search-index.json for frontend-only filtering, and updated the README plus artifact help docs.

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/README.md — User-facing manifest documentation
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/retro-launcher.manifest.json — Representative backfilled manifest
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/artifacts/manifest.go — Manifest parsing and validation
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/search.go — Frontend search bundle
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/index.html — First-pass metadata UI and filter field

## 2026-03-29

Added a repeatable playbook for manifest authoring, validation, and first-pass search/index smoke testing, including notes on the feasibility of replacing runtime Babel with build-time precompilation.

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/ttmp/2026/03/29/APP-MANIFESTS--add-per-app-manifest-json-metadata-support/playbook/01-manifest-authoring-and-validation-playbook.md — Operator runbook for manifest and search validation
