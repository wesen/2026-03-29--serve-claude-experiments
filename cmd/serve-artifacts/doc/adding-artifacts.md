---
Title: "Adding New Artifacts to the Server"
Slug: "adding-artifacts"
Short: "How to add HTML and JSX artifacts so the server can discover and serve them."
Topics:
- artifacts
- getting-started
Commands:
- serve
- list
Flags:
- dir
IsTopLevel: true
IsTemplate: false
ShowPerDefault: true
SectionType: Tutorial
---

The artifact server discovers files by scanning a directory at request time.
Every `.html` or `.jsx` file in that directory becomes a servable artifact — no
configuration files, no registration step, no rebuild.  Drop a file in, refresh
the browser, and it appears.  This page explains the conventions your files must
follow, what happens behind the scenes, and how to troubleshoot when an artifact
does not render.

## Supported artifact types

The server recognises two file extensions.  Everything else in the directory is
silently ignored.

| Extension | Type | How it is served |
|-----------|------|------------------|
| `.html` / `.htm` | HTML | Served directly as-is with `Content-Type: text/html`. The file must be a complete, self-contained HTML document. |
| `.jsx` | JSX (React) | Wrapped in a host page that loads React 18 from esm.sh and Babel standalone from unpkg. The JSX source is fetched by the browser, transformed at runtime, and mounted into a `<div id="root">`. |

## Adding an HTML artifact

An HTML artifact is a single file containing everything the browser needs:
markup, styles, and scripts.  The server reads the file and sends it to the
browser with only two small injections — a floating "back to index" navigation
button and, when `--watch` is active, a tiny auto-reload script.

### Requirements

Your HTML file must:

1. Be a complete document starting with `<!DOCTYPE html>` (or at least `<html>`).
2. Contain a `<body>` tag — the server injects the navigation bar before
   `</body>`.  If there is no `</body>`, injection is skipped silently but the
   nav button will not appear.
3. Have all styles and scripts inline.  External stylesheet or script references
   are allowed but the server does not serve them — they must be absolute URLs
   (CDNs are fine).

### Title extraction

The server extracts a display title from the first `<title>` tag it finds in the
opening 4 KB of the file.  If no title is found, the filename (minus extension)
is used instead.

### Example: minimal HTML artifact

Save this as `hello.html` in your artifacts directory:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hello World</title>
  <style>
    body { font-family: sans-serif; display: grid; place-items: center; height: 100vh; }
    h1 { font-size: 3em; }
  </style>
</head>
<body>
  <h1>Hello from an artifact!</h1>
</body>
</html>
```

Then run:

```bash
serve-artifacts serve --dir ./my-artifacts
```

Visit `http://localhost:8080` and you will see "Hello World" in the listing.
Click it to view the artifact.

## Adding a JSX artifact

JSX artifacts are React component files.  The server does not compile them — it
serves the raw source to the browser alongside Babel standalone, which
transforms JSX to plain JavaScript at runtime.  React and ReactDOM are loaded
from the esm.sh CDN via an import map, so your component can use standard React
imports without a bundler.

### Requirements

Your JSX file must:

1. Export a single default function component using `export default function
   ComponentName()`.  The server parses this line to determine the component
   name for auto-mounting.  Arrow functions (`export default () => ...`) are
   **not** supported because the server cannot extract a name from them.

2. Import React hooks and utilities from `"react"`:
   ```jsx
   import { useState, useEffect, useRef } from "react";
   ```
   The server prepends `import React from "react"` automatically because
   Babel's classic JSX transform compiles `<div>` into `React.createElement("div")`
   which requires `React` to be in scope.

3. Be a single file.  All data, helper functions, sub-components, and styles
   must live in the same `.jsx` file.  There is no module resolution beyond
   what the import map provides.

4. Define CSS as a JavaScript template literal and inject it via
   `<style>{CSS}</style>` inside the component's return value.  This is the
   pattern Claude uses when generating artifacts.

### What the server provides

When you visit `/view/my-component`, the server generates a host HTML page
that does the following:

1. Declares an **import map** so that `import ... from "react"` resolves to
   `https://esm.sh/react@18.3.1` (and similarly for `react-dom` and
   `react-dom/client`).

2. Loads **Babel standalone** from unpkg, which processes
   `<script type="text/babel">` tags.

3. References your JSX file via
   `<script type="text/babel" data-type="module" src="/jsx/my-component">`.
   The `/jsx/` endpoint serves the raw file with two additions:
   - A `import React from "react";` line prepended at the top.
   - Auto-mount code appended at the bottom that calls `createRoot` and
     renders your component into `<div id="root">`.

4. Provides a clean CSS reset (`margin: 0; padding: 0; box-sizing: border-box`)
   and sets `html, body, #root` to `width: 100%; height: 100%` so your
   component gets the full viewport.

### Available React imports

The import map makes these modules available:

| Import path | Resolves to |
|-------------|-------------|
| `"react"` | `https://esm.sh/react@18.3.1` |
| `"react-dom"` | `https://esm.sh/react-dom@18.3.1` |
| `"react-dom/client"` | `https://esm.sh/react-dom@18.3.1/client` |
| `"react/jsx-runtime"` | `https://esm.sh/react@18.3.1/jsx-runtime` |

If your component imports anything else (e.g., `framer-motion`, `react-router`),
it will fail with a module resolution error.  You would need to extend the
import map in `pkg/server/templates/jsx-host.html`.

### Example: minimal JSX artifact

Save this as `counter.jsx` in your artifacts directory:

```jsx
import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ fontFamily: "sans-serif", textAlign: "center", paddingTop: 100 }}>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(c => c + 1)} style={{ fontSize: 20, padding: "8px 24px" }}>
        Increment
      </button>
    </div>
  );
}
```

Then run:

```bash
serve-artifacts serve --dir ./my-artifacts
```

Visit `http://localhost:8080` and click "Counter" in the listing.  The
interactive counter renders with working state.

## Dynamic discovery

The server scans the artifacts directory on every request to `/` (the index
page) and on every request to `/view/{name}`.  There is no file cache.  This
means:

- **Adding a file**: drop it into the directory and refresh the index page.
  It appears immediately.
- **Removing a file**: delete it from the directory.  The index updates on
  next refresh.  Existing browser tabs viewing that artifact will get a 404
  on reload.
- **Modifying a file**: save the file.  If `--watch` is active, all connected
  browsers auto-reload.  Otherwise, manually refresh.

## Using the list command to inspect artifacts

Before starting the server, you can inspect what the scanner finds:

```bash
# Table output (default)
serve-artifacts list --dir ./my-artifacts

# JSON output
serve-artifacts list --dir ./my-artifacts --output json

# Only JSX artifacts
serve-artifacts list --dir ./my-artifacts --type jsx

# Specific fields
serve-artifacts list --dir ./my-artifacts --fields name,type,title
```

This is useful for verifying that the scanner picks up your files and extracts
the correct titles.

## Watch mode

When you pass `--watch` (or `-w`) to the serve command, the server uses
fsnotify to monitor the artifacts directory for file changes.  When a file is
created, modified, or deleted, the server pushes a reload event to all connected
browsers via Server-Sent Events (SSE).

```bash
serve-artifacts serve --dir ./my-artifacts --watch
```

A small inline script is injected into every served page that connects to
`/events` and calls `location.reload()` when it receives a `reload` message.
The script auto-reconnects with a 2-second delay if the connection drops.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Artifact does not appear in listing | Wrong extension or file is in a subdirectory | Only `.html`, `.htm`, and `.jsx` files in the top-level directory are discovered. Move the file or rename it. |
| JSX artifact shows blank page | Component name mismatch | Check that you have `export default function YourName()` — the server uses this exact name for mounting. |
| "React is not defined" in console | Missing React import | The server prepends `import React from "react"` automatically.  If you still see this, check that the import map loads correctly (requires internet). |
| "Module not found" for third-party lib | Import map only covers React | Add the library to the import map in `pkg/server/templates/jsx-host.html`. |
| HTML artifact missing nav button | No `</body>` tag | The nav bar is injected before `</body>`.  Add the tag. |
| Watch mode not reloading | File changed outside watched directory | The watcher only monitors the top-level directory passed to `--dir`, not subdirectories. |

## See Also

- `serve-artifacts serve --help` — all flags for the serve command
- `serve-artifacts list --help` — all flags and output options for the list command
