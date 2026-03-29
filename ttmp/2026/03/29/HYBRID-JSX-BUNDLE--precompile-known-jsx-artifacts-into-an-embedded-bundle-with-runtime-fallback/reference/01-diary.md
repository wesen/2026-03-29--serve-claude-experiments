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
    - Path: pkg/jsx/bundle.go
      Note: Diary records bundle generation and source-hash behavior
    - Path: pkg/jsx/module.go
      Note: Diary records the shared module-building refactor
    - Path: pkg/server/jsx.go
      Note: Diary tracks JSX source normalization changes
    - Path: pkg/server/precompiled.go
      Note: Diary records embedded bundle lookup and freshness checks
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

**Commit (code):** d497808 — "Add HYBRID-JSX-BUNDLE design docs"

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

## Step 2: Build The Generator, Embedded Bundle, And Runtime Selection

This step implemented the hybrid behavior. The core change was separating "prepare a mountable JSX module" from "decide how that module reaches the browser," then using that shared module shape in both the generator and the runtime fallback path.

I added a new `pkg/jsx` package for source normalization and bundle generation, a small generator command, embedded precompiled output under `pkg/server/precompiled/`, and the server logic that prefers the compiled asset only when the current file hash still matches the generated manifest.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** After ticket setup, implement the hybrid precompiled-bundle path without breaking runtime JSX fallback.

**Inferred user intent:** Make the first hybrid option real, not just described, and keep the dynamic file-drop workflow intact.

**Commit (code):** b510020 — "Add embedded precompiled JSX bundle support"

### What I did
- Added `pkg/jsx/module.go` to hold shared JSX default-export normalization and mount-wrapper generation.
- Added `pkg/jsx/bundle.go` to compile mounted JSX modules into ESM JavaScript and emit a manifest with source hashes.
- Added `cmd/precompile-jsx-bundle/main.go` and a `go:generate` entry in `pkg/server/precompiled.go`.
- Added embedded bundle loading and source-hash freshness checks in `pkg/server/precompiled.go`.
- Updated `pkg/server/server.go` and `pkg/server/templates/jsx-host.html` to choose precompiled mode or runtime fallback mode per request.
- Added tests in `pkg/jsx/bundle_test.go` and `pkg/server/precompiled_test.go`.
- Generated and committed the first embedded bundle for the current checked-in JSX demos.

### Why
- The shared JSX module builder avoids drift between build-time and runtime behavior.
- Source hashes let the server detect when a checked-in artifact has been edited locally and should no longer trust the embedded output.
- Keeping the runtime `/jsx/{name}` path means new or modified files still render without regeneration.

### What worked
- `esbuild` compiled the mounted JSX modules cleanly into ESM output while preserving React imports.
- The generated manifest shape was simple enough to embed and check at request time.
- Tests passed with `go test ./...` after the generator and server mode selection were wired.

### What didn't work
- N/A in this step. The first compile and test pass succeeded.

### What I learned
- The cleanest abstraction boundary was not "bundle versus no bundle." It was "build a mountable JSX module once, then choose compile-time or runtime delivery later."
- Content-hash freshness checks are cheap enough for this first pass and avoid additional cache state.

### What was tricky to build
- The biggest implementation constraint was avoiding a compile-time circular dependency. The generator needed shared JSX logic, but it should not depend on the full server package because the server package also embeds generated assets.
- Moving the reusable logic into a dedicated `pkg/jsx` package kept the generator independent from server embedding concerns.

### What warrants a second pair of eyes
- The generated bundle is committed output, so reviewers should confirm the generated files actually correspond to the checked-in JSX sources.
- The precompiled and fallback script paths should stay behaviorally equivalent for supported default-export forms.

### What should be done in the future
- Add CI enforcement that `go generate ./pkg/server` has been run when checked-in JSX sources change.

### Code review instructions
- Start with `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/jsx/module.go` and `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/jsx/bundle.go`.
- Then review `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/precompiled.go` and `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/server.go`.
- Validate with `go generate ./pkg/server` followed by `go test ./...`.

### Technical details
- New command:
  - `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/cmd/precompile-jsx-bundle/main.go`
- New shared package:
  - `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/jsx/module.go`
  - `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/jsx/bundle.go`
- Embedded bundle:
  - `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/precompiled/manifest.json`

## Step 3: Validate In Tmux, Fix The Route Bug, And Update User Docs

This step moved from automated tests to real runtime validation. I built the binary, served a copied artifact directory in `tmux`, and checked the three important cases: unchanged known JSX should use the embedded bundle, an edited known JSX file should fall back to Babel, and a brand-new JSX file should also fall back.

The first manual run failed immediately with a panic from `ServeMux`. That failure was useful because it exposed a route-shape bug that tests had not caught: Go's path pattern parser does not accept a wildcard segment with a `.js` suffix. I fixed the route to `/compiled/{name}`, reran tests, repeated tmux validation, and then updated the public docs so they describe the hybrid flow accurately.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Finish the operator-facing parts of the feature, verify real behavior, and keep the ticket diary accurate.

**Inferred user intent:** Ship the feature in a way another person can build, run, and understand.

**Commit (code):** b50fa9f — "Fix compiled route and document hybrid JSX workflow"

### What I did
- Built the binary with `go build ./cmd/serve-artifacts`.
- Copied `imports/` into a temporary directory so runtime validation would not touch tracked files.
- Ran the server in `tmux` with `./serve-artifacts serve --dir <tmpdir> --watch --port 8094`.
- Validated:
  - unchanged `retro-launcher.jsx` used `/compiled/retro-launcher`
  - modified `retro-launcher.jsx` switched to Babel and `/jsx/retro-launcher`
  - new `new-demo.jsx` used Babel and `/jsx/new-demo`
- Updated `README.md`, `cmd/serve-artifacts/doc/adding-artifacts.md`, and `cmd/serve-artifacts/cmds/serve.go`.

### Why
- The feature is specifically about runtime behavior choice, so at least one end-to-end validation pass was necessary.
- The public docs still described the old "all JSX goes through Babel" model and would have misled the next person touching the code.

### What worked
- The copied-directory validation strategy proved both precompiled and fallback behavior without mutating tracked files.
- After the route fix, the hybrid mode selection worked exactly as intended.

### What didn't work
- The initial manual server run crashed with:
  - `panic: parsing "GET /compiled/{name}.js": at offset 14: bad wildcard segment (must end with '}')`
- Command that exposed it:
  - `./serve-artifacts serve --dir /tmp/tmp.ojjawVc1vA --watch --port 8094`
- Root cause:
  - `net/http` route patterns do not allow wildcard segments with suffix text such as `.js`.

### What I learned
- Even when handler tests pass, `ServeMux` route-pattern syntax can still fail only at actual server startup.
- Using a copied artifact directory is a clean way to validate "modified known artifact" behavior safely.

### What was tricky to build
- The sharp edge here was not the compilation logic; it was the route syntax. The handler code and tests were fine, but the exact mux registration string still mattered.
- Fixing it required changing the public compiled route shape and updating both the handler expectations and the documentation to match.

### What warrants a second pair of eyes
- Review whether `/compiled/{name}` is the best long-term route shape, or whether a future static asset namespace should include stronger cache semantics.
- Review whether the README explains clearly enough that `go generate ./pkg/server` is needed only to refresh the embedded known-artifact bundle.

### What should be done in the future
- Optionally surface the active serving mode in the index UI for easier debugging.

### Code review instructions
- Review the route change in `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/server.go`.
- Confirm the updated expectations in `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/precompiled_test.go`.
- Read the operator docs in `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/README.md` and `/home/manuel/code/wesen/2026-03-29--serve-claude-experiments/cmd/serve-artifacts/doc/adding-artifacts.md`.

### Technical details
- Validation command sequence:
  - `go build ./cmd/serve-artifacts`
  - `tmux new-session -d -s hybrid-jsx-8094 'cd /home/manuel/code/wesen/2026-03-29--serve-claude-experiments && ./serve-artifacts serve --dir <tmpdir> --watch --port 8094'`
  - `curl -s http://localhost:8094/view/retro-launcher`
  - `curl -s http://localhost:8094/compiled/retro-launcher | head -n 5`
