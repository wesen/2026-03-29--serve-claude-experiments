---
Title: JSX Template Escaping Bug Analysis
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
    - /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/server.go:Contains the JSX handler using template.JS
    - /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/templates/jsx-host.html:Contains the text/babel script tag
ExternalSources: []
Summary: "Analysis of why JSX artifacts fail to render due to Go html/template escaping"
LastUpdated: 2026-03-29T09:30:00.000000000-04:00
WhatFor: "Understanding and fixing the JSX template escaping bug"
WhenToUse: "When debugging JSX rendering failures in the artifact server"
---

# JSX Template Escaping Bug Analysis

## The Bug

When visiting `http://localhost:8080/view/business-app`, the browser console shows:

```
Uncaught SyntaxError: /Inline Babel script: Unexpected token (2:46)

  1 |
> 2 | import { useState, useEffect, Fragment } from &#34;react&#34;;
    |                                               ^
```

The `&#34;` is the HTML entity for a double quote (`"`). Babel receives HTML-escaped source code instead of raw JavaScript, causing a parse error on every string literal.

## Root Cause

The bug is in how Go's `html/template` package handles content inside `<script>` tags with non-standard types.

### How Go's `html/template` contextual escaping works

Go's `html/template` package (unlike `text/template`) performs **contextual auto-escaping**. It analyzes the template at parse time to determine the context of each `{{.Variable}}` and applies the appropriate escaping:

- Inside regular HTML: escapes `<`, `>`, `&`, `"`, `'` → HTML entities
- Inside `<script>` tags: escapes for JavaScript safety (but preserves quotes)
- Inside `<style>` tags: escapes for CSS safety
- Inside HTML attributes: escapes for attribute safety

The key detail: **Go only recognizes `<script>` tags as JavaScript context when the `type` attribute is absent or set to a recognized JavaScript MIME type** (like `text/javascript`, `application/javascript`, etc.).

### What happens with `type="text/babel"`

Our JSX host template uses:

```html
<script type="text/babel" data-type="module">
{{.JSXSource}}
</script>
```

Go's template engine sees `type="text/babel"` and does **not** recognize it as a JavaScript context. It falls back to treating the content inside the `<script>` tag as **regular HTML text**, which means all characters get HTML-escaped:

- `"` → `&#34;`
- `'` → `&#39;`
- `<` → `&lt;`
- `>` → `&gt;`
- `&` → `&amp;`

### Why `template.JS` didn't help

In the Go handler, we pass the JSX source as `template.JS(safeSource)`:

```go
s.jsxHostTemplate.Execute(w, map[string]interface{}{
    "Title":     artifact.Title,
    "Name":      artifact.Name,
    "JSXSource": template.JS(safeSource),
    "Watch":     s.watch,
})
```

The `template.JS` type is a signal to Go's template engine that the value is safe to embed in a JavaScript context. However, since Go doesn't recognize `type="text/babel"` as a JavaScript context, it ignores the `template.JS` marker and escapes anyway.

This is a documented behavior. From the Go docs:

> `template.JS` marks a string as safe for embedding in JavaScript. It is used in known-safe JavaScript contexts. In other contexts, the value is still escaped.

## Fix Options

### Option A: Switch to `text/template` for the JSX host template (simplest)

Use Go's `text/template` package instead of `html/template` for the JSX host template. `text/template` does no auto-escaping — it outputs values verbatim.

**Pros:**
- Simplest fix — one import change
- No escaping surprises

**Cons:**
- Loses all auto-escaping protection (the `Title` field would also be unescaped, which could be an XSS vector if titles contained HTML)
- Mixes two template packages in one codebase

**Risk:** Low. The `Title` and `Name` fields come from our own scanner, not from user input. The JSX source comes from trusted local files.

### Option B: Serve JSX via a separate endpoint and use `<script src="...">`

Instead of inlining the JSX source in the template, serve it from a separate URL (e.g., `/jsx/business-app.jsx`) and reference it via `<script type="text/babel" src="/jsx/business-app.jsx">`.

Babel standalone supports loading external scripts via the `src` attribute on `<script type="text/babel">` tags.

**Pros:**
- No template escaping issue at all — JSX source never passes through templates
- Cleaner separation of concerns
- Enables browser caching of JSX source

**Cons:**
- Requires an additional HTTP endpoint
- Need to verify that Babel standalone actually supports `src` attribute on `text/babel` scripts (it does, but worth confirming)

### Option C: Use a standard `<script>` tag with manual Babel invocation

Replace `<script type="text/babel">` with a standard `<script>` tag that loads the JSX source from a separate endpoint and manually invokes Babel's transform API:

```html
<script>
fetch('/raw/business-app')
  .then(r => r.text())
  .then(jsx => {
    const {code} = Babel.transform(jsx, {presets: ['react']});
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = code;
    document.head.appendChild(script);
  });
</script>
```

**Pros:**
- No template escaping issue
- Full control over Babel transform options
- Uses standard `<script>` tag (recognized by Go's template engine)

**Cons:**
- More complex JavaScript bootstrapping code
- Need to handle import maps / module resolution manually

### Recommended: Option B

Option B is the cleanest fix. It separates concerns (template for page structure, raw endpoint for JSX source) and avoids the escaping problem entirely. The `/raw/{name}` endpoint already exists and serves files as-is.

The fix is:
1. Change the JSX host template to use `<script type="text/babel" data-type="module" src="/raw/{{.Name}}"></script>`
2. Remove the `JSXSource` field from the template data
3. Append the auto-mount code as a separate inline `<script type="text/babel">` block (or use a different mounting strategy)

The tricky part is the auto-mount code — we need to add `import { createRoot } from "react-dom/client"` and render the component *after* Babel processes the source. This might require a separate approach since Babel standalone processes each script block independently.

Actually, looking at Babel standalone more carefully: when using `src`, Babel fetches the script, transforms it, and executes it. But if the source file uses `export default`, we need a way to capture that export and render it. This is solved by **not using `export default`** — instead, we can append the mount code directly to the source, or use a two-script approach where the mount script runs after the source script.

The simplest variant of Option B:
1. Serve JSX source from `/raw/{name}` (already exists)
2. In the JSX host template, fetch the source, prepend/append mount code, and run it through Babel manually (hybrid of B and C)

## Tasks to Fix

1. **Fix the escaping bug** — switch the JSX host template from `html/template` to `text/template` (Option A for quick fix), OR restructure to serve JSX via `/raw/` endpoint (Option B for clean fix)
2. **Add Playwright tests** — write browser tests that verify JSX artifacts actually render
3. **Test all artifacts** — verify QueryMac.html, draft-review.html, business-app.jsx, editor.jsx all render correctly
