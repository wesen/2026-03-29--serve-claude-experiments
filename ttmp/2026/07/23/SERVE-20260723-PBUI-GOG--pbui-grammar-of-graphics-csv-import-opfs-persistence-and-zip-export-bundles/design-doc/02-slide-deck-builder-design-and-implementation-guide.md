---
Title: 'Slide deck builder: design and implementation guide'
Ticket: SERVE-20260723-PBUI-GOG
Status: active
Topics:
    - pbui
    - slides
    - markdown
    - grammar-of-graphics
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Design for a slide deck builder app that composes chart snapshots and markdown text into ordered slides, with a present mode and a deck-list view."
LastUpdated: "2026-07-23T17:10:00-04:00"
WhatFor: "Designing and implementing the slide deck builder in pbui-gog.jsx"
WhenToUse: "When implementing or reviewing the slide deck builder"
---

# Slide deck builder: design and implementation guide

## 1. Executive summary

Add a **slide deck builder** to the PBUI shell: a new `deck` app that composes the existing frozen chart snapshots and markdown text into ordered, editable slides. Decks live in the shared `World` alongside documents and snapshots, so a snapshot added to a slide stays a first-class `<chart>` presentation that can be inspected or replaced. The builder reuses the existing accept protocol (click a snapshot name anywhere to add it to the active slide) and adds a full-screen **present mode**.

The implementation is single-file (all in `imports/pbui-gog.jsx`), zero-dependency for markdown (a small inline renderer), and follows the same presentation-based-UI conventions as the rest of the shell.

## 2. Problem statement and scope

**Problem.** The snapshot gallery (Step: CSV/ZIP work) lets a user freeze chart specs, but there is no way to *sequence* them into a narrative — a slide deck where each slide can mix a chart image with explanatory markdown text. Users building a data story need ordering, titles, prose, and a present mode.

**Scope.**
- In scope: a `Deck` data model in `World` (multiple decks, each with ordered slides); a `DeckApp` editor (add/remove/reorder slides, edit markdown, accept a snapshot onto a slide); a `PresentApp` full-screen mode (keyboard navigation, rendered markdown + chart thumbnail); deck-level menu actions on `<chart>` snapshots ("add to slide"); export of a deck to a single bundled ZIP (markdown + all chart PNGs) reusing the Step 6 ZIP writer.
- Out of scope: a full markdown engine (tables, footnotes, raw HTML), collaborative editing, persistence of decks to OPFS (future — see risks), and animation/transitions.

## 3. Current-state analysis (evidence)

The shell already has every primitive the deck builder needs; this is a composition step, not new infrastructure.

- **Frozen chart snapshots** exist as `World.snaps[]` (`imports/pbui-gog.jsx:750`), each `{id, name, chart, at}` where `chart` is a full cloned spec. The deck reuses these directly — a slide references a snapshot id, never a live document.
- **`<chart>` presentation type** is already handled in `labelFor` (`:2231`), `describe` (`:2249`), and `actionsFor` (`:2316`) — adding deck verbs means appending to the `ptype === "chart"` menu, not a new type.
- **`MiniPlot({chart, W, H})`** (`:1308`) renders an inert thumbnail of a chart spec — perfect for slide cells and present mode.
- **Accept protocol** (`ui.accept(ptype, prompt)` in `App`, `:~2173`) already powers "map to x…" / "compare A/B". The deck uses it: "add snapshot to slide" accepts a `<chart>`.
- **APPS registry + `initialSpaces`** (`:2086`, `:2109`) — adding a `deck` app is one entry + optional workspace; tiles launch it from the dropdown.
- **Trace event colors** (`EV_COLOR`, `:~1800`) — new events get colors here.
- **ZIP writer** (Step 5, `:~400`) + `svgToPngBlob`/`downloadBlob` — deck export reuses these verbatim.

## 4. Gap analysis

| Need | Current state | Gap |
|------|---------------|-----|
| Ordered collection of slides | None | `Deck` model + `World.decks[]` |
| Slide content = chart + markdown | Snapshots exist; markdown rendering does not | Markdown renderer + slide schema |
| Add snapshot to slide via UI | Accept protocol exists, no deck verb | `actionsFor("chart")` entry + deck target |
| Reorder/remove slides | Tile drag exists; no list reordering | Per-slide move/remove controls |
| Full-screen present mode | None | `PresentApp` + keyboard nav |
| Deck export | ZIP writer exists (CSV) | Reuse for markdown + PNGs |

## 5. Proposed architecture and APIs

### 5.1 Data model (in `World`)

```js
// a slide references a frozen snapshot by id (or null for a text-only slide)
// and carries markdown body text.
slide = { id, snapId: string|null, markdown: string }

// a deck is an ordered list of slides + a title
deck = { id, name, slides: slide[], activeSlideIdx: number }
```

`World` gains:
```js
this.decks = [];              // list of decks
newDeck(name)                 // create + activate
addSlide(deckId, snapId?)     // append a slide (snapId optional)
removeSlide(deckId, slideId)
moveSlide(deckId, slideId, dir)   // -1 / +1
setSlideSnap(deckId, slideId, snapId)   // accept target
setSlideMarkdown(deckId, slideId, md)
setActiveSlide(deckId, idx)
deleteDeck(deckId)
renameDeck(deckId, name)
activeDeck()                  // the active deck (or first)
```

### 5.2 Markdown renderer (zero-dep, inline)

A tiny `renderMarkdown(md)` → React nodes function handling the subset needed for slide prose:
- headings `#`/`##`/`###`
- bold `**x**`, italic `*x*`, inline code `` `x` ``
- bullet lists `- ` / `* ` (single level)
- ordered lists `1. `
- paragraphs (blank-line separated)
- line breaks

Deliberately *not* a full CommonMark parser; no HTML, no tables, no nested lists. This keeps it dependency-free and safe (no `dangerouslySetInnerHTML`). ~60 lines.

### 5.3 `DeckApp` (editor)

Layout: a deck selector strip (like workspace chips) + a slide list (left) + a slide editor (right).
- **Deck strip:** chips for each deck, `+ deck` button, active deck highlighted.
- **Slide list:** numbered cards, each showing the slide's chart thumbnail (or "text only") + first line of markdown. Controls: ↑↓ reorder, ✕ remove. Click to activate.
- **Slide editor:** a `⌖ accept` button to set the chart snapshot, a markdown `<textarea>` (live), a `▶ present` button.

### 5.4 `PresentApp` (full-screen)

A fixed full-viewport overlay (z-index above the shell). Shows the active deck's active slide: rendered markdown + a large `MiniPlot` (or `PlotSVG` if we want interactivity — design decision below). Keyboard: `→`/`Space` next, `←` prev, `Home`/`End` first/last, `Esc` exit. A thin footer shows `slide N / M` + deck name.

### 5.5 Deck export (reuses ZIP writer)

`exportDeck(deckId)`: builds a ZIP with `deck.md` (all slides concatenated as a markdown document) + one PNG per slide that has a snapshot (rendered via `svgToPngBlob` from a hidden `MiniPlot` SVG, or recomputed `PlotSVG`). Reuses `ZipWriter` + `downloadBlob` from Step 5.

## 6. Decision records

### Decision: slides reference snapshot ids, not cloned chart specs

- **Context:** A slide could either embed a clone of the chart spec (independent of the gallery) or reference the snapshot id.
- **Options considered:** (a) clone spec into each slide; (b) reference `snapId`.
- **Decision:** (b) reference `snapId`.
- **Rationale:** Keeps a single source of truth (the snapshot in `World.snaps`). A snapshot renamed/inspected in the gallery is the same object on the slide. If a snapshot is deleted, the slide degrades gracefully (shows "snapshot removed") rather than holding an orphan clone.
- **Consequences:** Deleting a snapshot referenced by a slide must not crash — `PresentApp`/`DeckApp` look up `snapId` defensively. Slide data stays tiny (just ids + text).
- **Status:** accepted

### Decision: inline mini-markdown renderer, no library

- **Context:** Slide prose needs *some* formatting (bold, lists, headings) but the artifact must stay single-file zero-dep.
- **Options considered:** (a) `marked` via esm.sh import map; (b) raw text; (c) inline mini-renderer.
- **Decision:** (c).
- **Rationale:** A 60-line renderer covers 95% of slide-prose needs, adds no dependency, and avoids `dangerouslySetInnerHTML` (safer). The subset is documented so users know the limits.
- **Consequences:** Unsupported markdown (tables, HTML) renders as plain text. Documented limitation; not a regression.
- **Status:** accepted

### Decision: present mode as a fixed overlay, not a separate route

- **Context:** Present mode needs full screen above the tile shell.
- **Options considered:** (a) a separate workspace/route; (b) a fixed-position overlay rendered at the App root.
- **Decision:** (b) overlay at App root.
- **Rationale:** Keeps the shell state (which slide, keyboard handling) in the App component; no routing needed. Esc-to-exit mirrors the accept-protocol Esc convention.
- **Consequences:** The overlay must capture keyboard events and stop propagation so tile shortcuts don't fire. z-index above menus.
- **Status:** accepted

### Decision: interactive `PlotSVG` in present mode, not just `MiniPlot`

- **Context:** Slides could show an inert thumbnail or a live, inspectable chart.
- **Options considered:** (a) `MiniPlot` thumbnail; (b) `PlotSVG` (interactive, marks are `<datum>`).
- **Decision:** (b) `PlotSVG`.
- **Rationale:** Presentations often prompt audience questions; a live chart that can be R-clicked (filter to a category) mid-presentation is a distinctive feature that matches the PBUI philosophy. Falls back to `MiniPlot` if the snapshot's chart can't be drawn.
- **Consequences:** Slightly more render cost; acceptable since present mode shows one chart at a time. The chart is read-only (restoring a snap into a live doc is a separate action).
- **Status:** accepted

### Decision: decks not persisted to OPFS in this phase

- **Context:** Datasets persist (Step 3); should decks?
- **Options considered:** (a) persist decks to OPFS/localStorage now; (b) session-only for v1.
- **Decision:** (b) session-only for this phase.
- **Rationale:** Decks reference snapshot ids, and snapshots are currently session-only too. Persisting decks without snapshots is useless; persisting both is a larger change. Ship the feature, then add snapshot+deck persistence together as a follow-up.
- **Consequences:** A reload loses decks. Documented; the gallery already behaves this way.
- **Status:** accepted

## 7. Pseudocode and key flows

### Add a snapshot to the active slide (accept flow)

```
// from GalleryApp or any <chart> chip R-menu:
ui.accept("chart", "DECK — click a CHART snapshot to add to the active slide")
  → r = {ptype:"chart", value: snapId}
world.addSlideToActiveDeck(r.value)   // or setSlideSnap on active slide
```

### `renderMarkdown(md)`

```
blocks = md.split(/\n\n+/)
for each block:
  if startsWith "### " → <h3>
  elif "## " → <h2>
  elif "# " → <h1>
  elif every line startsWith "- " or "* " → <ul><li>…
  elif every line startsWith "N. " → <ol><li>…
  else <p> with inline bold/italic/code spans
```

Inline span parser: single regex pass for `**bold**`, `*italic*`, `` `code` `` (order matters; escape nothing, just split).

### Present mode navigation

```
onKeyDown:
  ArrowRight / " " / PageDown → setActiveSlide(deck, min(idx+1, len-1))
  ArrowLeft / PageUp         → setActiveSlide(deck, max(idx-1, 0))
  Home                       → setActiveSlide(deck, 0)
  End                        → setActiveSlide(deck, len-1)
  Escape                     → setPresent(null)
```

### Deck export

```
zip = new ZipWriter()
md = deck.slides.map((s, i) => {
  const snap = world.snaps.find(x => x.id === s.snapId)
  return `## Slide ${i+1}\n\n` + (snap ? `![${snap.name}](slide-${i+1}.png)\n\n` : "") + s.markdown
}).join("\n\n---\n\n")
zip.add("deck.md", md)
for each slide with a snap:
  png = svgToPngBlob(renderHiddenMiniPlot(snap.chart))   // STORE
  zip.add(`slide-${i+1}.png`, pngBytes, {store:true})
downloadBlob(zip.blob(), deck.name + "-deck.zip")
```

## 8. Implementation phases

**Phase A — Model + renderer.** Add `World.decks[]` + deck/slide mutation methods, `renderMarkdown()`. No UI. Validate via console (create a deck, add slides, inspect). Commit.

**Phase B — DeckApp editor.** `DeckApp` (deck strip + slide list + editor), `deck` entry in `APPS`, `initialSpaces` deck workspace, `actionsFor("chart")` "add to active slide" verb, `deck_*` trace colors. Validate: add snapshots to slides, edit markdown, reorder. Commit.

**Phase C — Present mode + export.** `PresentApp` overlay + keyboard nav wired in `App`, `▶ present` button in `DeckApp`, `exportDeck()` reusing ZIP writer. Validate: present a deck, navigate, export, unzip. Commit.

## 9. Test strategy

Manual, browser-based (no test runner for the artifact):

1. **Model:** console — `world.newDeck("d"); world.addSlide("d", snapId); world.decks[0].slides.length === 1`.
2. **Markdown:** `renderMarkdown("# T\n\n- a\n- **b**")` → verify React nodes / rendered HTML in inspector.
3. **DeckApp:** create deck, add 3 snapshots as slides, edit markdown on each, reorder, remove. Confirm slide list + editor reflect state.
4. **Accept flow:** from gallery, R-click a snapshot → "add to active slide" → accept mode → click another snapshot → appears on active slide.
5. **Present mode:** `▶ present`, `→`/`←`/`Home`/`End`/`Esc` all work; rendered markdown + chart visible; R-click a mark filters (no crash).
6. **Export:** export a 3-slide deck, `unzip -t` passes, `deck.md` is coherent markdown with image refs, PNGs are valid.

## 10. Risks, alternatives, open questions

- **Risk: deleted snapshot referenced by a slide.** Mitigated by defensive lookup (`world.snaps.find(...)`); slide shows a "snapshot removed" placeholder. Document in `PresentApp`/`DeckApp`.
- **Risk: keyboard capture in present mode.** Must `stopPropagation` so tile drag/accept shortcuts don't fire. Test with an accept-mode active when entering present.
- **Risk: large decks in present mode.** Each slide renders a `PlotSVG` on activation; fine for typical decks (<50 slides).
- **Alternative (rejected): separate "slide" presentation type.** Slides are not first-class presentable objects in v1 — they're deck-internal. Adding a `<slide>` type would balloon the menu/label/describe surface for little gain.
- **Open question:** Should present mode show speaker notes (a second markdown field per slide)? Deferred — single markdown field for v1; notes can be a `<!-- -->` comment convention or a v2 field.
- **Open question:** Multi-deck navigation in present mode (deck-to-deck)? Out of scope; one deck per present session.

## 11. References

- `imports/pbui-gog.jsx:750` — `World.snapshot` / `snaps[]` (the snapshot model the deck references)
- `imports/pbui-gog.jsx:1308` — `MiniPlot` (slide thumbnails)
- `imports/pbui-gog.jsx:1116` — `PlotSVG` (present-mode interactive chart)
- `imports/pbui-gog.jsx:2086` — `APPS` registry (add `deck`)
- `imports/pbui-gog.jsx:2109` — `initialSpaces` (add deck workspace)
- `imports/pbui-gog.jsx:2316` — `actionsFor("chart")` (add deck verb)
- `imports/pbui-gog.jsx:~400` — `ZipWriter` + `svgToPngBlob` + `downloadBlob` (deck export reuses)
