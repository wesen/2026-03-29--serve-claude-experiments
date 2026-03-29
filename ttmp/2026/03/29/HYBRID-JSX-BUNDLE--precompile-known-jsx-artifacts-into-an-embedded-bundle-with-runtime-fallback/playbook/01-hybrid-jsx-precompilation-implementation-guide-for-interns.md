---
Title: Hybrid JSX Precompilation Implementation Guide For Interns
Ticket: HYBRID-JSX-BUNDLE
Status: active
Topics:
    - artifacts
    - golang
    - web-server
DocType: playbook
Intent: long-term
Owners: []
RelatedFiles:
    - Path: pkg/jsx/bundle.go
      Note: Generator behavior and output format for the embedded bundle
    - Path: pkg/server/jsx.go
      Note: Runtime fallback source generation and mount behavior
    - Path: pkg/server/precompiled.go
      Note: Operational validation depends on embedded bundle lookup here
    - Path: pkg/server/server.go
      Note: Operational validation depends on handler selection here
ExternalSources: []
Summary: Intern-facing implementation guide for the embedded precompiled JSX bundle and runtime fallback workflow.
LastUpdated: 2026-03-29T10:27:05.268934355-04:00
WhatFor: Give a step-by-step operational and implementation guide for understanding and modifying the hybrid JSX serving path.
WhenToUse: When regenerating the precompiled bundle, debugging serving mode selection, or validating hybrid JSX behavior.
---



# Hybrid JSX Precompilation Implementation Guide For Interns

## Purpose

This playbook explains how the hybrid JSX system works in practice. It is written for a new contributor who understands basic Go and HTTP handlers, but does not already know this repository.

## Environment Assumptions

- You are in the repository root.
- You have Go installed.
- You are using the repository's checked-in `imports/` directory as the build-known artifact set.
- If you run the local server yourself, use `tmux`.

## Commands

The system has two serving modes:
- precompiled mode for unchanged known JSX artifacts already present in the embedded bundle
- runtime fallback mode for changed or newly added JSX artifacts

Run this sequence when regenerating or validating the feature:

```bash
go generate ./pkg/server
go test ./...
go build ./cmd/serve-artifacts
tmux new-session -d -s hybrid-jsx 'cd /home/manuel/code/wesen/2026-03-29--serve-claude-experiments && ./serve-artifacts serve --dir ./imports --watch --port 8093'
curl -s http://localhost:8093/view/retro-launcher
curl -s http://localhost:8093/compiled/retro-launcher | head
# edit an existing JSX file or add a new one under imports/
curl -s http://localhost:8093/view/retro-launcher
tmux kill-session -t hybrid-jsx
```

## Exit Criteria

- Known unchanged JSX artifacts use `/compiled/{name}`.
- Changed or new JSX artifacts use `/jsx/{name}`.
- HTML artifacts are unaffected.
- `go test ./...` passes.
- Docs describe the regeneration and fallback workflow accurately.

## Notes

- Watch mode only reloads connected browsers. It does not rebuild the embedded bundle.
- Regenerating the bundle is a source-control event, not a live runtime event.
- Do not remove the runtime fallback just because the precompiled path works for the checked-in demos.
