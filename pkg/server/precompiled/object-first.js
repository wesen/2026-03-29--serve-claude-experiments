import React from "react";
import { useState, useContext, createContext, useRef, useEffect, useCallback } from "react";
const TYPE_HIERARCHY = {
  "night-student": ["student"],
  "student": ["person"],
  "employee": ["person"],
  "person": ["t"],
  "directory": ["pathname"],
  "pathname": ["t"],
  "integer": ["number"],
  "float": ["number"],
  "number": ["t"],
  "t": []
};
function typeSatisfies(candidate, required) {
  if (!required) return false;
  if (candidate === required || required === "t") return true;
  return (TYPE_HIERARCHY[candidate] ?? []).some((s) => typeSatisfies(s, required));
}
const COMMANDS = [
  {
    id: "inspect",
    label: "Inspect",
    icon: "\u25CE",
    args: [{ label: "subject", type: "person" }],
    fn: (p) => `Inspect ${p.name.toUpperCase()}
  type:  ${p.ptype}
  email: ${p.email}
  dept:  ${p.dept}
  age:   ${p.age}`
  },
  {
    id: "email",
    label: "Compose Email",
    icon: "\u2301",
    args: [{ label: "recipient", type: "person" }],
    fn: (p) => `Compose-Email  To: <${p.email}>
  Draft created for ${p.name}.`
  },
  {
    id: "compare",
    label: "Compare",
    icon: "\u21CC",
    args: [
      { label: "first", type: "person" },
      { label: "second", type: "person" }
    ],
    fn: (a, b) => `Compare ${a.name} \u2194 ${b.name}
  age delta:  ${Math.abs(a.age - b.age)} yrs
  same dept:  ${a.dept === b.dept ? "yes \u2713" : "no \u2717"}
  types:      ${a.ptype} / ${b.ptype}`
  },
  {
    id: "stat",
    label: "File Info",
    icon: "\u2261",
    args: [{ label: "file", type: "pathname" }],
    fn: (f) => `Stat ${f.path}
  size:     ${f.size}
  modified: ${f.mtime}`
  },
  {
    id: "delete",
    label: "Delete",
    icon: "\u232B",
    args: [{ label: "target", type: "pathname" }],
    fn: (f) => `Delete ${f.path}
  ; destructive operation
  Removed.`
  },
  {
    id: "copy",
    label: "Copy File",
    icon: "\u2295",
    args: [
      { label: "source", type: "pathname" },
      { label: "dest", type: "pathname" }
    ],
    fn: (src, dst) => `Copy ${src.path}
  \u2192 ${dst.path}.bak
  Done.`
  },
  {
    id: "diff",
    label: "Diff Files",
    icon: "\u25B3",
    args: [
      { label: "file-a", type: "pathname" },
      { label: "file-b", type: "pathname" }
    ],
    fn: (a, b) => `Diff ${a.path}
     ${b.path}
  3 hunks, +18 / -7 lines.`
  }
];
const PEOPLE = [
  { id: 1, ptype: "person", name: "Ada Lovelace", email: "ada@engine.io", dept: "Mathematics", age: 36 },
  { id: 2, ptype: "employee", name: "Alan Turing", email: "turing@bletchley.uk", dept: "Cryptanalysis", age: 41 },
  { id: 3, ptype: "student", name: "Grace Hopper", email: "grace@yale.edu", dept: "Comp. Sci.", age: 26 },
  { id: 4, ptype: "night-student", name: "John McCarthy", email: "jmc@mit.edu", dept: "AI Lab", age: 24 },
  { id: 5, ptype: "employee", name: "Marvin Minsky", email: "minsky@mit.edu", dept: "AI Lab", age: 29 }
];
const FILES = [
  { path: "/home/ada/notes.lisp", size: "4.2K", mtime: "1843-10-12" },
  { path: "/usr/local/lisp/core.lisp", size: "128K", mtime: "1958-01-01" },
  { path: "/etc/genera/site-init.lisp", size: "2.1K", mtime: "1987-03-22" },
  { path: "/home/turing/enigma.pl", size: "16K", mtime: "1943-06-07" }
];
const SelectionCtx = createContext({
  selected: null,
  // { object, type, label } | null
  setSelected: null
});
const CollectCtx = createContext({
  activeType: null,
  onCollect: null,
  prompt: null
});
function useCommandRunner(onEmit) {
  const [pending, setPending] = useState(null);
  const onEmitRef = useRef(onEmit);
  onEmitRef.current = onEmit;
  const start = useCallback((def, argIdx, object) => {
    const args = new Array(def.args.length).fill(null);
    args[argIdx] = object;
    const nextNull = args.findIndex((a) => a === null);
    if (nextNull === -1) {
      setTimeout(() => onEmitRef.current(def.fn(...args), "res"), 0);
      return null;
    }
    return { def, args, nextArgIdx: nextNull };
  }, []);
  const startAndSet = useCallback((def, argIdx, object) => {
    const p = start(def, argIdx, object);
    setPending(p);
  }, [start]);
  const collect = useCallback((object) => {
    setPending((prev) => {
      if (!prev) return null;
      const args = [...prev.args];
      args[prev.nextArgIdx] = object;
      const nextNull = args.findIndex((a) => a === null);
      if (nextNull === -1) {
        setTimeout(() => onEmitRef.current(prev.def.fn(...args), "res"), 0);
        return null;
      }
      return { ...prev, args, nextArgIdx: nextNull };
    });
  }, []);
  const cancel = useCallback(() => setPending(null), []);
  const activeType = pending?.def.args[pending.nextArgIdx].type ?? null;
  const activeLabel = pending?.def.args[pending.nextArgIdx].label ?? null;
  const activeCmd = pending?.def.label ?? null;
  return { startAndSet, collect, cancel, pending, activeType, activeLabel, activeCmd };
}
function Selectable({ object, type, label, children }) {
  const { selected, setSelected } = useContext(SelectionCtx);
  const { activeType, onCollect } = useContext(CollectCtx);
  const [hover, setHover] = useState(false);
  const isSelected = selected?.object === object;
  const isSensitive = !!(activeType && typeSatisfies(type, activeType));
  const collectMode = !!activeType;
  const handleClick = (e) => {
    e.stopPropagation();
    if (isSensitive && onCollect) {
      onCollect(object);
    } else if (!collectMode) {
      setSelected(isSelected ? null : { object, type, label });
    }
  };
  const cls = [
    "sel",
    isSelected ? "sel-on" : "",
    isSensitive ? "sel-sensitive" : "",
    hover && isSensitive ? "sel-shover" : "",
    hover && isSelected ? "sel-shover" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement(
    "span",
    {
      className: cls,
      onClick: handleClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      "data-type": type
    },
    children,
    hover && (isSensitive || isSelected) && /* @__PURE__ */ React.createElement("span", { className: "sel-badge" }, type)
  );
}
function ActionWidget({ def, onStart, isCollectingFor }) {
  const { selected } = useContext(SelectionCtx);
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const compatIndices = selected ? def.args.reduce((acc, arg, i) => {
    if (typeSatisfies(selected.type, arg.type)) acc.push(i);
    return acc;
  }, []) : [];
  const isLit = compatIndices.length > 0;
  useEffect(() => {
    if (!isLit) setMenuOpen(false);
  }, [isLit]);
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => {
      if (!ref.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);
  const handleWidgetClick = () => {
    if (!isLit) return;
    setMenuOpen((m) => !m);
  };
  const handleMenuPick = (argIdx) => {
    setMenuOpen(false);
    onStart(def, argIdx, selected.object);
  };
  const cls = [
    "widget",
    isLit ? "widget-lit" : "",
    isCollectingFor ? "widget-collecting" : "",
    menuOpen ? "widget-open" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement("div", { ref, className: cls }, /* @__PURE__ */ React.createElement("div", { className: "widget-face", onClick: handleWidgetClick }, /* @__PURE__ */ React.createElement("span", { className: "widget-icon" }, def.icon), /* @__PURE__ */ React.createElement("div", { className: "widget-meta" }, /* @__PURE__ */ React.createElement("span", { className: "widget-label" }, def.label), /* @__PURE__ */ React.createElement("div", { className: "widget-sig" }, def.args.map((a, i) => /* @__PURE__ */ React.createElement(
    "span",
    {
      key: i,
      className: `widget-argpill${compatIndices.includes(i) ? " pill-match" : ""}`
    },
    a.label,
    /* @__PURE__ */ React.createElement("span", { className: "pill-colon" }, ":"),
    a.type
  )))), isLit && /* @__PURE__ */ React.createElement("span", { className: `widget-arrow${menuOpen ? " open" : ""}` }, "\u25BE")), menuOpen && isLit && selected && /* @__PURE__ */ React.createElement(
    ActionMenu,
    {
      def,
      selectedLabel: selected.label,
      selectedType: selected.type,
      compatIndices,
      onPick: handleMenuPick
    }
  ));
}
function ActionMenu({ def, selectedLabel, selectedType, compatIndices, onPick }) {
  const describe = (idx) => {
    const remaining = def.args.map((a, i) => i !== idx ? a.label : null).filter(Boolean);
    if (remaining.length === 0) return "\u2192 executes";
    return `\u2192 then pick: ${remaining.join(", ")}`;
  };
  return /* @__PURE__ */ React.createElement("div", { className: "action-menu" }, /* @__PURE__ */ React.createElement("div", { className: "action-menu-header" }, /* @__PURE__ */ React.createElement("span", { className: "action-sel-label" }, selectedLabel), /* @__PURE__ */ React.createElement("span", { className: "action-sel-type" }, selectedType)), /* @__PURE__ */ React.createElement("div", { className: "action-menu-title" }, "Use as:"), compatIndices.map((i) => /* @__PURE__ */ React.createElement("button", { key: i, className: "action-item", onClick: () => onPick(i) }, /* @__PURE__ */ React.createElement("span", { className: "action-item-inner" }, /* @__PURE__ */ React.createElement("span", { className: "action-slot" }, def.args[i].label), /* @__PURE__ */ React.createElement("span", { className: "action-continues" }, describe(i))))));
}
function App() {
  const [selected, setSelectedRaw] = useState(null);
  const [log, setLog] = useState([
    { id: 0, kind: "sys", text: "Object-first prototype loaded.\nClick any object to select it, then choose an action." }
  ]);
  const logRef = useRef(null);
  const nextId = useRef(1);
  const emit = (text, kind = "res") => setLog((prev) => [...prev, { id: nextId.current++, kind, text }]);
  const runner = useCommandRunner(emit);
  const setSelected = useCallback((s) => {
    runner.cancel();
    setSelectedRaw(s);
  }, [runner]);
  useEffect(() => {
    if (!runner.pending) setSelectedRaw(null);
  }, [runner.pending]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);
  const collectCtx = {
    activeType: runner.activeType,
    onCollect: runner.collect,
    prompt: runner.activeLabel
  };
  const collectingForId = runner.pending?.def.id ?? null;
  const handleStart = useCallback((def, argIdx, object) => {
    runner.startAndSet(def, argIdx, object);
  }, [runner]);
  let statusMode = "idle";
  let statusText = "Click any object to select it";
  if (runner.pending) {
    statusMode = "collecting";
    statusText = `${runner.activeCmd}  \u2192  select ${runner.activeLabel}`;
  } else if (selected) {
    statusMode = "selected";
    statusText = `${selected.label}  [${selected.type}]  \u2014 click a compatible action`;
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("style", null, CSS), /* @__PURE__ */ React.createElement(SelectionCtx.Provider, { value: { selected, setSelected } }, /* @__PURE__ */ React.createElement(CollectCtx.Provider, { value: collectCtx }, /* @__PURE__ */ React.createElement("div", { className: "app", onClick: () => {
    if (!runner.pending) setSelected(null);
  } }, /* @__PURE__ */ React.createElement("header", { className: "statusbar" }, /* @__PURE__ */ React.createElement("span", { className: "sb-brand" }, "\u229B OBJECT-FIRST PRESENTATIONS"), /* @__PURE__ */ React.createElement("span", { className: `sb-state sb-${statusMode}` }, statusMode === "collecting" && /* @__PURE__ */ React.createElement("span", { className: "sb-dot pulse" }), statusMode === "selected" && /* @__PURE__ */ React.createElement("span", { className: "sb-dot solid" }), /* @__PURE__ */ React.createElement("span", { className: "sb-text" }, statusText), (runner.pending || selected) && /* @__PURE__ */ React.createElement("button", { className: "sb-cancel", onClick: (e) => {
    e.stopPropagation();
    runner.cancel();
    setSelected(null);
  } }, "\u2715"))), /* @__PURE__ */ React.createElement("div", { className: "body" }, /* @__PURE__ */ React.createElement("section", { className: "objects-pane", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "pane-head" }, "Objects"), /* @__PURE__ */ React.createElement("div", { className: "obj-section" }, /* @__PURE__ */ React.createElement("div", { className: "obj-section-label" }, "People"), /* @__PURE__ */ React.createElement("table", { className: "obj-table" }, /* @__PURE__ */ React.createElement("tbody", null, PEOPLE.map((p) => /* @__PURE__ */ React.createElement("tr", { key: p.id, className: "obj-row" }, /* @__PURE__ */ React.createElement("td", { className: "obj-typetag" }, "[", p.ptype, "]"), /* @__PURE__ */ React.createElement("td", { className: "obj-cell" }, /* @__PURE__ */ React.createElement(Selectable, { object: p, type: p.ptype, label: p.name }, /* @__PURE__ */ React.createElement("span", { className: "obj-person" }, p.name))), /* @__PURE__ */ React.createElement("td", { className: "obj-meta" }, p.dept)))))), /* @__PURE__ */ React.createElement("div", { className: "obj-section" }, /* @__PURE__ */ React.createElement("div", { className: "obj-section-label" }, "Files"), /* @__PURE__ */ React.createElement("table", { className: "obj-table" }, /* @__PURE__ */ React.createElement("tbody", null, FILES.map((f) => /* @__PURE__ */ React.createElement("tr", { key: f.path, className: "obj-row" }, /* @__PURE__ */ React.createElement("td", { className: "obj-typetag" }, "[pathname]"), /* @__PURE__ */ React.createElement("td", { className: "obj-cell" }, /* @__PURE__ */ React.createElement(Selectable, { object: f, type: "pathname", label: f.path }, /* @__PURE__ */ React.createElement("span", { className: "obj-path" }, f.path))), /* @__PURE__ */ React.createElement("td", { className: "obj-meta obj-meta-right" }, f.size)))))), /* @__PURE__ */ React.createElement("div", { className: "obj-hint" }, runner.pending ? /* @__PURE__ */ React.createElement(React.Fragment, null, "\u2191 Click a highlighted object to fill ", /* @__PURE__ */ React.createElement("strong", null, runner.activeLabel), " (", runner.activeType, ")") : selected ? /* @__PURE__ */ React.createElement(React.Fragment, null, "\u2191 ", /* @__PURE__ */ React.createElement("strong", null, selected.label), " selected \u2014 choose an action \u2192") : /* @__PURE__ */ React.createElement(React.Fragment, null, "\u2191 Click any object to select it"))), /* @__PURE__ */ React.createElement("section", { className: "widgets-pane", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "pane-head" }, "Actions"), /* @__PURE__ */ React.createElement("div", { className: "widget-group" }, /* @__PURE__ */ React.createElement("div", { className: "widget-group-label" }, "Person operations"), COMMANDS.filter((c) => c.args.some((a) => typeSatisfies("person", a.type) || a.type === "person")).map((def) => /* @__PURE__ */ React.createElement(
    ActionWidget,
    {
      key: def.id,
      def,
      onStart: handleStart,
      isCollectingFor: collectingForId === def.id
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "widget-group" }, /* @__PURE__ */ React.createElement("div", { className: "widget-group-label" }, "File operations"), COMMANDS.filter((c) => c.args.some((a) => typeSatisfies("pathname", a.type) || a.type === "pathname")).map((def) => /* @__PURE__ */ React.createElement(
    ActionWidget,
    {
      key: def.id,
      def,
      onStart: handleStart,
      isCollectingFor: collectingForId === def.id
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "pane-hint" }, "Widgets highlight when the selected object's", /* @__PURE__ */ React.createElement("br", null), "type satisfies any of their argument types.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("em", null, "employee"), " and ", /* @__PURE__ */ React.createElement("em", null, "student"), " satisfy ", /* @__PURE__ */ React.createElement("em", null, "person"), ".")), /* @__PURE__ */ React.createElement("aside", { className: "listener" }, /* @__PURE__ */ React.createElement("div", { className: "pane-head" }, "Listener", /* @__PURE__ */ React.createElement("button", { className: "clear-btn", onClick: () => setLog([]) }, "clear")), /* @__PURE__ */ React.createElement("div", { className: "listener-scroll", ref: logRef }, log.map((e) => /* @__PURE__ */ React.createElement("div", { key: e.id, className: `log log-${e.kind}` }, /* @__PURE__ */ React.createElement("span", { className: "log-glyph" }, e.kind === "res" && "\u21D2 ", e.kind === "warn" && "\u26A0 ", e.kind === "sys" && "\xB7 "), /* @__PURE__ */ React.createElement("span", { className: "log-text" }, e.text))))))))));
}
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Martian+Mono:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:          #090c14;
    --bg2:         #0d1120;
    --bg3:         #111827;
    --border:      #1e2a40;
    --border2:     #2a3a58;

    --text:        #b8c8e0;
    --text-dim:    #4a5a72;
    --text-muted:  #2e3e56;

    --blue:        #4488ff;
    --blue-dim:    #2255aa;
    --blue-glow:   #88bbff;
    --cyan:        #22d4cc;
    --cyan-dim:    #116660;
    --lime:        #7edf5a;
    --lime-dim:    #3a6628;
    --lime-bg:     rgba(126,223,90,0.07);
    --lime-hover:  rgba(126,223,90,0.16);
    --orange:      #ff9944;
    --red:         #e05560;

    --sel-color:   #55aaff;
    --sel-bg:      rgba(68,136,255,0.10);
    --sel-border:  rgba(68,136,255,0.5);
    --sens-color:  #7edf5a;
    --sens-bg:     rgba(126,223,90,0.08);
    --sens-border: rgba(126,223,90,0.45);

    --font: 'Martian Mono', 'Courier New', monospace;
    --r: 3px;
  }

  html, body, #root { height: 100%; background: var(--bg); }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--font);
    font-size: 12px;
    line-height: 1.6;
    color: var(--text);
    background: var(--bg);
    cursor: default;
  }

  /* \u2500\u2500 STATUS BAR \u2500\u2500 */
  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 18px;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 16px;
  }
  .sb-brand {
    color: var(--blue);
    font-size: 10px;
    letter-spacing: 0.14em;
    white-space: nowrap;
    font-weight: 600;
  }
  .sb-state {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    transition: color .2s;
  }
  .sb-idle       { color: var(--text-dim); }
  .sb-selected   { color: var(--blue-glow); }
  .sb-collecting { color: var(--lime); }

  .sb-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .sb-dot.solid { background: var(--blue); box-shadow: 0 0 6px var(--blue); }
  .sb-dot.pulse {
    background: var(--lime);
    box-shadow: 0 0 6px var(--lime);
    animation: dpulse 1s ease-in-out infinite;
  }
  @keyframes dpulse {
    0%,100% { opacity:1; }
    50%      { opacity:.3; }
  }
  .sb-cancel {
    background: none;
    border: 1px solid var(--border2);
    color: var(--text-dim);
    cursor: pointer;
    padding: 1px 7px;
    font-family: var(--font);
    font-size: 10px;
    border-radius: var(--r);
    transition: color .15s, border-color .15s;
  }
  .sb-cancel:hover { color: var(--red); border-color: var(--red); }

  /* \u2500\u2500 BODY LAYOUT \u2500\u2500 */
  .body {
    display: grid;
    grid-template-columns: 320px 1fr 280px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .pane-head {
    font-size: 9px;
    letter-spacing: 0.18em;
    color: var(--blue-dim);
    text-transform: uppercase;
    font-weight: 600;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* \u2500\u2500 OBJECTS PANE \u2500\u2500 */
  .objects-pane {
    padding: 14px 16px;
    background: var(--bg);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .obj-section { margin-bottom: 20px; }
  .obj-section-label {
    font-size: 9px;
    letter-spacing: .12em;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .obj-table { width: 100%; border-collapse: collapse; }
  .obj-row { border-bottom: 1px solid #0d1120; }
  .obj-row:last-child { border-bottom: none; }
  .obj-typetag {
    font-size: 9px;
    color: var(--text-muted);
    padding: 4px 8px 4px 0;
    vertical-align: middle;
    width: 1%;
    white-space: nowrap;
  }
  .obj-cell  { padding: 4px 8px 4px 0; vertical-align: middle; }
  .obj-meta  { padding: 4px 0; font-size: 11px; color: var(--text-dim); vertical-align: middle; }
  .obj-meta-right { text-align: right; }
  .obj-person { color: var(--blue-glow); }
  .obj-path   { color: var(--cyan); font-size: 11px; }

  .obj-hint {
    margin-top: auto;
    padding-top: 14px;
    font-size: 10.5px;
    color: var(--text-dim);
    border-top: 1px solid var(--border);
    line-height: 1.7;
  }
  .obj-hint strong { color: var(--text); }

  /* \u2500\u2500 SELECTABLE \u2500\u2500 */
  .sel {
    position: relative;
    display: inline;
    padding: 1px 3px;
    border-radius: var(--r);
    cursor: pointer;
    transition: background .1s, outline-color .1s;
    outline: 1px solid transparent;
    outline-offset: 1px;
  }
  .sel:hover {
    outline-color: var(--border2);
  }
  .sel-on {
    background: var(--sel-bg);
    outline-color: var(--sel-border) !important;
    animation: sel-appear .2s ease-out;
  }
  @keyframes sel-appear {
    from { background: rgba(68,136,255,0.25); }
    to   { background: var(--sel-bg); }
  }
  .sel-sensitive {
    background: var(--sens-bg);
    outline-color: var(--sens-border) !important;
    animation: sens-appear .2s ease-out;
  }
  @keyframes sens-appear {
    from { background: rgba(126,223,90,0.22); }
    to   { background: var(--sens-bg); }
  }
  .sel-shover {
    background: var(--lime-hover) !important;
    cursor: crosshair;
  }
  .sel-on.sel-shover {
    background: rgba(68,136,255,0.2) !important;
    cursor: crosshair;
  }
  .sel-badge {
    position: absolute;
    bottom: calc(100% + 5px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg3);
    border: 1px solid var(--border2);
    color: var(--cyan);
    font-size: 9px;
    padding: 2px 7px;
    border-radius: var(--r);
    white-space: nowrap;
    pointer-events: none;
    z-index: 200;
    letter-spacing: .06em;
  }

  /* \u2500\u2500 WIDGETS PANE \u2500\u2500 */
  .widgets-pane {
    padding: 14px 18px;
    background: var(--bg2);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    border-right: 1px solid var(--border);
  }
  .widget-group { margin-bottom: 22px; }
  .widget-group-label {
    font-size: 9px;
    letter-spacing: .12em;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  /* \u2500\u2500 WIDGET \u2500\u2500 */
  .widget {
    position: relative;
    border: 1px solid var(--border);
    background: var(--bg3);
    border-radius: var(--r);
    margin-bottom: 5px;
    transition: border-color .15s, background .15s;
    overflow: visible;
  }
  .widget-face {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    cursor: default;
  }
  .widget-lit .widget-face { cursor: pointer; }
  .widget-lit {
    border-color: var(--lime-dim);
    background: var(--lime-bg);
    animation: widget-light .25s ease-out;
  }
  @keyframes widget-light {
    from { border-color: var(--lime); background: rgba(126,223,90,0.18); }
    to   { border-color: var(--lime-dim); background: var(--lime-bg); }
  }
  .widget-lit:hover { border-color: var(--lime); background: var(--lime-hover); }
  .widget-open {
    border-color: var(--lime) !important;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  .widget-collecting {
    border-color: var(--orange) !important;
    background: rgba(255,153,68,0.06) !important;
  }

  .widget-icon {
    font-size: 16px;
    color: var(--text-dim);
    flex-shrink: 0;
    width: 20px;
    text-align: center;
    transition: color .15s;
  }
  .widget-lit   .widget-icon { color: var(--lime); }
  .widget-collecting .widget-icon { color: var(--orange); }

  .widget-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .widget-label {
    font-size: 12px;
    color: var(--text-dim);
    font-weight: 500;
    transition: color .15s;
  }
  .widget-lit .widget-label        { color: var(--text); }
  .widget-collecting .widget-label { color: var(--orange); }

  .widget-sig {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .widget-argpill {
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 2px;
    border: 1px solid var(--border);
    color: var(--text-muted);
    background: var(--bg);
    letter-spacing: .03em;
    transition: color .15s, border-color .15s, background .15s;
  }
  .pill-colon { color: var(--text-muted); margin: 0 2px; }
  .pill-match {
    color: var(--lime);
    border-color: var(--lime-dim);
    background: rgba(126,223,90,0.08);
  }

  .widget-arrow {
    color: var(--lime-dim);
    font-size: 14px;
    flex-shrink: 0;
    transition: transform .15s, color .15s;
  }
  .widget-arrow.open { transform: rotate(180deg); color: var(--lime); }

  /* \u2500\u2500 ACTION MENU \u2500\u2500 */
  .action-menu {
    position: absolute;
    top: calc(100% + 1px);
    left: -1px;
    right: -1px;
    background: var(--bg3);
    border: 1px solid var(--lime);
    border-top: none;
    border-bottom-left-radius: var(--r);
    border-bottom-right-radius: var(--r);
    z-index: 300;
    overflow: hidden;
    animation: menu-drop .12s ease-out;
    box-shadow: 0 8px 20px rgba(0,0,0,0.5);
  }
  @keyframes menu-drop {
    from { opacity:0; transform: translateY(-4px); }
    to   { opacity:1; transform: translateY(0); }
  }
  .action-menu-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 7px 12px 5px;
    border-bottom: 1px solid var(--border);
  }
  .action-sel-label {
    font-size: 11.5px;
    color: var(--sel-color);
    font-weight: 500;
  }
  .action-sel-type {
    font-size: 9px;
    color: var(--text-dim);
    letter-spacing: .06em;
  }
  .action-menu-title {
    font-size: 9px;
    color: var(--text-muted);
    letter-spacing: .1em;
    text-transform: uppercase;
    padding: 6px 12px 3px;
  }
  .action-item {
    display: block;
    width: 100%;
    background: none;
    border: none;
    border-top: 1px solid var(--border);
    cursor: pointer;
    padding: 0;
    font-family: var(--font);
    text-align: left;
    transition: background .1s;
  }
  .action-item:hover { background: rgba(126,223,90,0.1); }
  .action-item-inner {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
  }
  .action-slot {
    font-size: 12px;
    color: var(--text);
    font-weight: 500;
  }
  .action-continues {
    font-size: 10px;
    color: var(--text-dim);
  }

  /* pane hint */
  .pane-hint {
    margin-top: auto;
    padding-top: 14px;
    font-size: 10.5px;
    color: var(--text-dim);
    border-top: 1px solid var(--border);
    line-height: 1.8;
    margin-top: 12px;
  }
  .pane-hint em { color: var(--cyan); font-style: normal; }

  /* \u2500\u2500 LISTENER \u2500\u2500 */
  .listener {
    background: var(--bg2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .listener .pane-head {
    padding: 12px 16px 8px;
    margin-bottom: 0;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    flex-shrink: 0;
  }
  .clear-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-dim);
    cursor: pointer;
    padding: 1px 8px;
    font-family: var(--font);
    font-size: 10px;
    border-radius: var(--r);
    transition: color .15s;
  }
  .clear-btn:hover { color: var(--red); border-color: var(--red); }
  .listener-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .log { display: flex; gap: 6px; align-items: flex-start; }
  .log-glyph { flex-shrink: 0; }
  .log-text  { white-space: pre; font-size: 11.5px; line-height: 1.7; }
  .log-res  .log-glyph { color: var(--lime); }
  .log-res  .log-text  { color: var(--text); }
  .log-warn .log-glyph { color: var(--red); }
  .log-warn .log-text  { color: #c08060; }
  .log-sys  .log-glyph { color: var(--text-muted); }
  .log-sys  .log-text  { color: var(--text-dim); }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
`;
const __artifactDefault = App;
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(__artifactDefault));
