---
Title: Diary
Ticket: SERVE-ARTIFACTS
Status: active
Topics:
    - golang
    - web-server
    - artifacts
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/business-app.jsx:Analyzed JSX artifact structure
    - /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/editor.jsx:Analyzed JSX artifact structure
    - /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/imports/QueryMac.html:Analyzed HTML artifact structure
    - /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/draft-review.html:Analyzed HTML artifact structure
    - /home/manuel/code/wesen/corporate-headquarters/glazed/cmd/glaze/main.go:Referenced for Glazed CLI root initialization pattern
ExternalSources: []
Summary: "Chronological investigation diary for SERVE-ARTIFACTS ticket"
LastUpdated: 2026-03-29T08:37:46.664900243-04:00
WhatFor: "Recording the research and design process for the artifact server"
WhenToUse: "When reviewing the investigation history or continuing work"
---

# Diary

## Goal

Capture the research, analysis, and design process for building a standalone Go server that serves Claude.ai artifacts (HTML and JSX files) using the Glazed command framework.

## Step 1: Artifact Analysis and Classification

I started by examining all four artifact files in the repository to understand what exactly needs to be served and what transformations, if any, are required. This step was critical because the entire server architecture depends on understanding the two fundamentally different artifact types.

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket to create a standalone app to serve claude.ai artifacts. Keep a diary as you work. We want to build the tool using go and using the glazed command framework (see skills). Look at the two different types of artifacts we have so far: jsx and html. Analyze how these need to be packaged and transformed to be served by a go server. Potentially we might want to add some at runtime if the packaging/import can be done dynamically (for jsx for example). Create a detailed analysis / design / implementation guide that is very detailed for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and detailed. Store in the ticket and the nupload to remarkable."

**Assistant interpretation:** Build a comprehensive design document for an intern-friendly Go server that can serve both HTML and JSX Claude artifacts, with emphasis on understanding the two artifact types and how they need different treatment.

**Inferred user intent:** The user wants a ready-to-implement blueprint that someone unfamiliar with the codebase can follow to build the server from scratch, covering architecture, code structure, and the specific technical challenge of serving JSX in-browser.

### What I did

- Read all four artifact files: `draft-review.html` (1186 lines), `QueryMac.html` (930 lines), `business-app.jsx` (1260 lines), `editor.jsx` (580 lines)
- Identified key structural patterns in each artifact type
- Read the Glazed CLI reference (`glazed/cmd/glaze/main.go`) and the glazed-command-authoring skill for CLI conventions
- Read the go-web-frontend-embed skill for server/embed patterns

### Why

Understanding the artifacts deeply before designing the server prevents building the wrong abstraction. The HTML vs JSX distinction drives the entire architecture.

### What worked

- Clear classification emerged: HTML artifacts are fully self-contained (inline CSS, inline vanilla JS, no imports). JSX artifacts uniformly use `import { useState, ... } from "react"` and `export default function App()`.
- All four artifacts follow consistent patterns within their type, making the server design predictable.

### What didn't work

N/A — this was a read-only analysis step.

### What I learned

- **HTML artifacts** have zero external dependencies beyond occasional Google Fonts CDN imports. They use vanilla JavaScript with direct DOM manipulation. They can be served as-is with `Content-Type: text/html`.
- **JSX artifacts** always import from `"react"` (never from `"react-dom"` directly in the component file). They always export a default function component. CSS is defined as a template literal string injected via `<style>{CSS}</style>`.
- Both types are single-file applications — no multi-file artifacts, no asset directories.
- File sizes range from 25-55 KB, well within the range where reading the full file on each request is fine.

### What was tricky to build

The key design decision was how to serve JSX artifacts. Three options exist:
1. Server-side compilation (esbuild Go API or subprocess) — fast output but adds build dependency
2. In-browser Babel standalone — no build tooling needed but ~500ms cold start
3. Import map + ESM CDN + Babel — combines browser-native module resolution with runtime transformation

Option 3 was chosen because it requires zero build tooling, supports dynamic artifact addition (just drop a file), and keeps the Go server simple. The tricky part is correctly injecting JSX source into a `<script type="text/babel">` tag — you need to escape `</script>` sequences in the source.

### What warrants a second pair of eyes

- The JSX host page template: the import map must cover all imports that Claude artifacts actually use. If Claude starts generating artifacts that import `framer-motion` or `react-router`, the import map needs extending.
- The `</script>` escaping in JSX source injection — we replace `</script>` with `<\/script>` which is safe in JavaScript string context, but needs verification that it works inside Babel's `text/babel` script blocks too.

### What should be done in the future

- Test with a wider variety of Claude artifacts to confirm the two-type classification holds
- Consider bundling Babel and React into the Go binary for offline use
- Consider server-side esbuild compilation as a performance optimization

### Code review instructions

- Start with the design doc: `ttmp/2026/03/29/SERVE-ARTIFACTS--standalone-go-server-for-claude-ai-artifacts/design-doc/01-artifact-server-design-and-implementation-guide.md`
- Review the "How JSX Serving Works" section carefully — it's the core technical insight
- Verify the import map covers all React imports seen in the JSX artifacts
- Check the phased implementation plan for completeness

### Technical details

**HTML artifact structure (representative):**
```
<!DOCTYPE html>
<html><head>
  <title>...</title>
  <style>/* all CSS inline */</style>
</head><body>
  <!-- all markup inline -->
  <script>/* all JS inline, vanilla, no imports */</script>
</body></html>
```

**JSX artifact structure (representative):**
```jsx
import { useState, useEffect, Fragment } from "react";
// All mock data inline
const DATA = [...];
// CSS as template literal
const CSS = `...`;
// Single default export component
export default function App() {
  const [state, setState] = useState(...);
  return (<><style>{CSS}</style><div>...</div></>);
}
```

**React imports observed across all JSX artifacts:**
- `useState` (all)
- `useEffect` (all)
- `useRef` (editor.jsx)
- `useCallback` (editor.jsx)
- `Fragment` (business-app.jsx)

## Step 2: Design Document Authoring

With the artifact analysis complete, I wrote the comprehensive design document covering architecture, component design, implementation plan, and testing strategy. The document is structured for an intern audience — every concept is explained from first principles with concrete code examples.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Write the design doc itself, now that the analysis is complete.

**Inferred user intent:** Produce a document that someone can follow step-by-step to build the server, without needing to ask questions.

### What I did

- Wrote a ~1500-line design document covering:
  - Executive summary
  - Problem statement with scope boundaries
  - Current-state analysis of both artifact types with code excerpts
  - Architecture diagram (ASCII art)
  - Detailed JSX serving mechanism explanation
  - Four components: Scanner, Handlers, Server, CLI
  - Full pseudocode for each component
  - Directory layout specification
  - 4-phase implementation plan with validation criteria
  - Unit and integration test examples
  - Manual smoke test checklist
  - Risks, alternatives, and open questions
  - Three appendices (file references, CDN dependencies, Go dependencies)

### Why

The user explicitly asked for intern-level detail with prose, bullet points, pseudocode, diagrams, and API references. The document needs to stand alone as a complete implementation guide.

### What worked

- The phased approach (HTML-only → JSX → Glazed → Polish) provides clear milestones
- ASCII architecture diagram makes the system components visible at a glance
- Including the full JSX host page template makes the core mechanism concrete

### What didn't work

N/A — writing phase, not implementation.

### What I learned

- The Glazed command framework's `cli.BuildCobraCommand` is the current preferred API (not the older `BuildCobraCommandFromCommand`)
- The `serve` command should be plain Cobra (not Glazed) because it's a long-running server, not structured data output
- The `list` command is a perfect Glazed command — it outputs rows of artifact metadata

### What was tricky to build

Balancing detail level — too little and the intern is lost, too much and the document becomes a novel. I focused on explaining *why* each decision was made (not just what to do) so the reader can adapt when reality diverges from the plan.

### What warrants a second pair of eyes

- The Go code snippets use `http.NewServeMux` with the Go 1.22+ pattern syntax (`GET /view/{name}`). If targeting older Go versions, a router like chi would be needed instead.
- The template embedding strategy — whether templates live alongside the server package or in a top-level directory affects the `go:embed` directives.

### What should be done in the future

- Implement Phase 1 (minimal viable server) and validate against real artifacts
- Add help documentation for the Glazed help system

### Code review instructions

- Read the design doc end-to-end
- Pay special attention to the JSX host template in "How JSX Serving Works"
- Verify the directory layout matches Glazed conventions from the glazed-command-authoring skill
- Check that the `list` command follows the canonical Glazed command skeleton

### Technical details

Design doc location: `ttmp/2026/03/29/SERVE-ARTIFACTS--standalone-go-server-for-claude-ai-artifacts/design-doc/01-artifact-server-design-and-implementation-guide.md`

Key sections and their line ranges (approximate):
- Executive Summary: lines 30-45
- Problem Statement: lines 47-80
- Current-State Analysis: lines 82-200
- Architecture Overview: lines 202-280
- JSX Serving Mechanism: lines 250-340
- Component Design: lines 340-600
- Glazed CLI Integration: lines 600-780
- Implementation Plan: lines 780-880
- Testing Strategy: lines 880-990
- Risks and Open Questions: lines 990-1050
