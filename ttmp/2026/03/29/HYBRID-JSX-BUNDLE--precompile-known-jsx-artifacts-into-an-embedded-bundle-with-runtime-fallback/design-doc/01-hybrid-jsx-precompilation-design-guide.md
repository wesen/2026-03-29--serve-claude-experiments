---
Title: Hybrid JSX Precompilation Design Guide
Ticket: HYBRID-JSX-BUNDLE
Status: active
Topics:
    - artifacts
    - golang
    - web-server
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: pkg/server/jsx.go
      Note: Shared JSX normalization and mount logic
    - Path: pkg/server/server.go
      Note: Primary request routing and serving mode decisions
    - Path: pkg/server/templates/jsx-host.html
      Note: Host template that must switch between Babel and module mode
    - Path: pkg/server/watcher.go
      Note: Current watch behavior that remains reload-only in this design
ExternalSources: []
Summary: Design guide for embedding precompiled JavaScript for known JSX artifacts while preserving runtime JSX fallback for files added or changed after the binary was built.
LastUpdated: 2026-03-29T10:27:05.2657629-04:00
WhatFor: Explain the architecture, tradeoffs, and implementation plan for the hybrid build-time precompilation strategy.
WhenToUse: When implementing, reviewing, or extending the embedded precompiled JSX bundle and runtime fallback path.
---


# Hybrid JSX Precompilation Design Guide

## Executive Summary

`serve-artifacts` currently serves JSX by loading Babel in the browser and asking the browser to compile the artifact on page load. That is flexible, but it means known checked-in artifacts still pay a runtime transform cost and still require browser-side Babel.

This ticket introduces a hybrid model:
- known JSX artifacts in the repository are precompiled into plain JavaScript and embedded in the Go binary
- the server serves that precompiled output when the on-disk source still matches the source hash captured during generation
- the existing runtime Babel path remains available for dynamically added files and for any known file that changed after the bundle was generated

This keeps the dynamic artifact workflow intact while improving the steady-state path for the curated `imports/` set.

## Problem Statement

The current JSX flow is simple and flexible:
1. read the `.jsx` file from disk
2. normalize the default export into a stable binding
3. append React mount code
4. send the resulting JSX module to the browser
5. let Babel standalone transform it in the browser

That design worked well for bootstrapping, but it has limitations:
- every page view pays the Babel transform cost
- the binary is not self-sufficient for known JSX artifacts because the host template still depends on Babel standalone
- the server cannot distinguish between "artifact was in the build" and "artifact was dropped in later"
- watch mode only reloads pages and does not influence serving mode

## Proposed Solution

Introduce an embedded precompiled bundle with these pieces:

1. A generator command scans a configured source directory such as `./imports`.
2. For each `.jsx` file, it produces:
   - compiled JavaScript module output suitable for `<script type="module">`
   - metadata containing artifact name, source filename, and a content hash of the original `.jsx`
3. The generated files are stored inside `pkg/server/precompiled/` and committed.
4. The server embeds that directory with `go:embed`.
5. At request time, the server decides:
   - use `/compiled/{name}.js` when the bundle contains the artifact and the current file hash matches the embedded source hash
   - otherwise use the existing Babel host path `/jsx/{name}`

This deliberately keeps watch mode simple: it continues to reload pages, and the request-time server logic decides whether the embedded compiled asset still applies.

## Design Decisions

- Embed generated assets inside the Go package so binaries stay self-contained for the known bundle.
- Use content hashes, not timestamps, to validate bundle freshness.
- Keep the runtime `/jsx/{name}` endpoint as the fallback for new or modified files.
- Switch the host template based on serving mode so precompiled pages do not load Babel unnecessarily.

## Alternatives Considered

- Keep everything runtime-only.
  Rejected because it leaves performance and binary self-sufficiency unchanged for the known artifact set.
- Compile everything in watch mode and abandon Babel fallback.
  Rejected because it turns a simple file watcher into a compile and cache system.
- Precompile with a Node and Babel toolchain only.
  Viable, but it adds a separate JavaScript build dependency to a currently Go-centric repository. A Go-based generator is operationally simpler for the first pass while still satisfying the requested hybrid behavior.

## Implementation Plan

1. Refactor the JSX preparation code so both runtime and build-time paths share the same mount-wrapper logic.
2. Add a generator command that reads `.jsx` files and emits:
   - a manifest JSON file
   - compiled `.js` module files
3. Embed the generated bundle into the server package.
4. Add a bundle loader plus hash-matching helper in the server.
5. Add a `/compiled/{name}.js` route.
6. Update the JSX host template to switch between precompiled module mode and Babel mode.
7. Add tests for generator output, hash match or mismatch behavior, and handler mode selection.
8. Update docs and validation playbooks.

## Open Questions

- Do we want the index UI to expose whether an artifact is currently served from the embedded bundle or the runtime fallback path?
- Should CI eventually enforce that the generated bundle is up to date?

## References

- `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/server.go`
- `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/jsx.go`
- `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/jsx-host.html`
- `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/watcher.go`
