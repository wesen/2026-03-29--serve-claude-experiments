# Changelog

## 2026-03-29

- Initial workspace created


## 2026-03-29

Imported 12 additional Claude demo artifacts into imports/, broadened JSX default-export handling so later export forms such as retro-launcher mount correctly, and validated discovery plus HTTP routes via a tmux-run server on port 8091.

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/retro-launcher.jsx — Validation artifact for the broadened JSX acceptance path
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/artifacts/scanner.go — Broadened JSX name extraction
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/jsx.go — Rewrites default exports to __artifactDefault
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/server.go — Serves rewritten JSX source

