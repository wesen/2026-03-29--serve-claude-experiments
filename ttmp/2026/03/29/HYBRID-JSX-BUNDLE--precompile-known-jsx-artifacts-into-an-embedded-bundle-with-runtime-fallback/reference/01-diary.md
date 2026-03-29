---
Title: Diary
Ticket: HYBRID-JSX-BUNDLE
Status: active
Topics:
    - artifacts
    - golang
    - web-server
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: pkg/server/jsx.go
      Note: Diary tracks JSX source normalization changes
    - Path: pkg/server/server.go
      Note: Diary references request routing changes in later steps
    - Path: pkg/server/templates/jsx-host.html
      Note: Diary tracks host template mode switching
ExternalSources: []
Summary: Detailed diary of planning and implementing the hybrid JSX precompiled-bundle plus runtime-fallback system.
LastUpdated: 2026-03-29T10:27:05.315721792-04:00
WhatFor: Record the step-by-step design, implementation, testing, and review context for the hybrid JSX ticket.
WhenToUse: When continuing the ticket, reviewing implementation choices, or validating how the hybrid JSX workflow evolved.
---


# Diary

## Goal

Capture the full implementation story for the hybrid JSX ticket: what changed, why it changed, how it was validated, and what needs careful review.

## Step 1: Create The Ticket, Architecture Notes, And Work Plan

This step establishes the contract for the rest of the work. The repository already had a runtime JSX path and a separate manifest ticket, but it did not yet have a written design for the "precompile known artifacts, keep runtime fallback" strategy the user selected.

I created a dedicated ticket first so the code changes would be anchored to an explicit architecture, a step-by-step intern playbook, and a diary that can be continued as each task lands. That keeps the implementation from becoming an undocumented side branch of the existing JSX system.

### Prompt Context

**User prompt (verbatim):** "the first option. Create a new ticket for that, and add a detailed implementation guide and design guide for an intern to understand what this is all about. Then add detailed tasks to the ticket, and work on them one by one, committing and keeping a diary as you go."

**Assistant interpretation:** Create a new ticket for the hybrid precompiled JSX approach, write intern-friendly docs, then implement the work in discrete committed steps with a diary.

**Inferred user intent:** Make the hybrid build-time precompile strategy concrete, documented, and shippable without losing the dynamic artifact workflow.

**Commit (code):** pending

### What I did
- Inspected the current JSX serving path in `pkg/server/server.go`, `pkg/server/jsx.go`, `pkg/server/templates/jsx-host.html`, and `pkg/server/watcher.go`.
- Confirmed that the current system always uses browser-side Babel and that watch mode only broadcasts reload events.
- Created the `HYBRID-JSX-BUNDLE` ticket workspace.
- Added a design doc, an intern implementation playbook, a detailed task list, and this diary.

### Why
- The feature touches both build-time and runtime behavior, so undocumented coding would be brittle.
- The user explicitly asked for a ticket, design guide, implementation guide, tasks, and diary before or alongside the implementation.

### What worked
- `docmgr` produced the ticket structure quickly and aligned with the existing repo ticket layout.
- The current codebase has a clear seam between the host page, the `/jsx/{name}` endpoint, and the watcher, which makes the hybrid plan tractable.

### What didn't work
- N/A

### What I learned
- The current JSX path is simpler than it first appears: almost all interesting behavior is concentrated in the host template and the single `/jsx/{name}` endpoint.
- The cleanest hybrid strategy is content-hash-based eligibility, not timestamp-based eligibility.

### What was tricky to build
- The main design constraint is avoiding a second stateful cache system. A naive "watch and rebuild compiled output on every change" approach would make the server harder to reason about than necessary.
- The safer approach is to keep watch mode dumb and let request-time hash checks decide whether the embedded bundle is still valid.

### What warrants a second pair of eyes
- The eventual choice of build-time compiler versus runtime Babel parity deserves review once code lands.
- The exact regeneration workflow needs to be clear enough that contributors do not accidentally ship stale generated assets.

### What should be done in the future
- Consider CI enforcement that the generated bundle is current once the feature stabilizes.

### Code review instructions
- Start with the new ticket docs to understand the architecture before reviewing code.
- Verify that later diary steps line up with commits and checked-off tasks.

### Technical details
- Relevant starting files:
  - `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/server.go`
  - `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/jsx.go`
  - `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/jsx-host.html`
  - `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/watcher.go`
- Ticket path:
  - `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/ttmp/2026/03/29/HYBRID-JSX-BUNDLE--precompile-known-jsx-artifacts-into-an-embedded-bundle-with-runtime-fallback`
