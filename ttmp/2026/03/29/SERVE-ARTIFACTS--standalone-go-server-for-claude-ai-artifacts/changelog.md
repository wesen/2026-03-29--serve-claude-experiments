# Changelog

## 2026-03-29

- Initial workspace created


## 2026-03-29

Created comprehensive design and implementation guide covering artifact analysis, architecture, component design, Glazed CLI integration, phased implementation plan, and testing strategy

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/ttmp/2026/03/29/SERVE-ARTIFACTS--standalone-go-server-for-claude-ai-artifacts/design-doc/01-artifact-server-design-and-implementation-guide.md — Main design document


## 2026-03-29

Implemented full server (Phases 1-3): scanner, HTTP server, templates, serve+list commands (commit f2b391a)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/artifacts/scanner.go — Artifact scanner with title extraction
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/server.go — HTTP server with index/view/raw handlers


## 2026-03-29

Added human-readable file sizes, back-to-index navigation, and file watcher with SSE auto-reload (commits 7dfe6b2, 0a07758)

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/watcher.go — File watcher with fsnotify + SSE broadcast

