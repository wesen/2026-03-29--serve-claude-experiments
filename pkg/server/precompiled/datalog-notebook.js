import React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
const SAMPLE_DB = {
  facts: [
    ["parent", "tom", "bob"],
    ["parent", "tom", "liz"],
    ["parent", "bob", "ann"],
    ["parent", "bob", "pat"],
    ["parent", "pat", "jim"],
    ["parent", "liz", "mia"],
    ["male", "tom", null],
    ["male", "bob", null],
    ["male", "pat", null],
    ["male", "jim", null],
    ["female", "liz", null],
    ["female", "ann", null],
    ["female", "mia", null],
    ["likes", "bob", "ann"],
    ["likes", "tom", "liz"],
    ["likes", "mia", "jim"],
    ["edge", "a", "b"],
    ["edge", "b", "c"],
    ["edge", "c", "d"],
    ["edge", "a", "d"],
    ["edge", "d", "e"],
    ["edge", "b", "e"]
  ],
  rules: [
    { head: ["ancestor", "X", "Y"], body: [["parent", "X", "Y"]] },
    { head: ["ancestor", "X", "Y"], body: [["parent", "X", "Z"], ["ancestor", "Z", "Y"]] },
    { head: ["father", "X", "Y"], body: [["parent", "X", "Y"], ["male", "X", null]] },
    { head: ["mother", "X", "Y"], body: [["parent", "X", "Y"], ["female", "X", null]] },
    { head: ["sibling", "X", "Y"], body: [["parent", "Z", "X"], ["parent", "Z", "Y"]] },
    { head: ["path", "X", "Y"], body: [["edge", "X", "Y"]] },
    { head: ["path", "X", "Y"], body: [["edge", "X", "Z"], ["path", "Z", "Y"]] }
  ]
};
function evaluateQuery(queryText, db) {
  const text = queryText.trim().replace(/\.$/, "");
  const match = text.match(/^\?-\s*(\w+)\(([^)]*)\)/);
  if (!match) return { error: "Syntax: ?- relation(arg1, arg2)." };
  const [, rel, argsStr] = match;
  const args = argsStr.split(",").map((a) => a.trim());
  function isVar(s) {
    return s && /^[A-Z_]/.test(s);
  }
  function unify(pattern, fact, bindings) {
    const b = { ...bindings };
    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i], f = fact[i];
      if (p === null || f === null) {
        if (p !== null && f !== null) return null;
        continue;
      }
      if (isVar(p)) {
        if (b[p] !== void 0) {
          if (b[p] !== f) return null;
        } else {
          b[p] = f;
        }
      } else {
        if (p !== f) return null;
      }
    }
    return b;
  }
  function queryRelation(relation, pattern, visited = /* @__PURE__ */ new Set()) {
    const key = `${relation}(${pattern.join(",")})`;
    if (visited.has(key)) return [];
    visited.add(key);
    let results2 = [];
    for (const fact of db.facts) {
      if (fact[0] !== relation) continue;
      const fArgs = fact.slice(1);
      const b = unify(pattern, fArgs, {});
      if (b) results2.push(b);
    }
    for (const rule of db.rules) {
      if (rule.head[0] !== relation) continue;
      const ruleArgs = rule.head.slice(1);
      const initialBindings = {};
      let valid = true;
      for (let i = 0; i < pattern.length; i++) {
        if (!isVar(pattern[i]) && pattern[i] !== null) {
          if (isVar(ruleArgs[i])) initialBindings[ruleArgs[i]] = pattern[i];
          else if (ruleArgs[i] !== pattern[i]) {
            valid = false;
            break;
          }
        }
      }
      if (!valid) continue;
      const bodyResults = evaluateBody(rule.body, [initialBindings], visited);
      for (const b of bodyResults) {
        const result = {};
        for (let i = 0; i < pattern.length; i++) {
          if (isVar(pattern[i])) {
            const rArg = ruleArgs[i];
            result[pattern[i]] = isVar(rArg) ? b[rArg] : rArg;
          }
        }
        results2.push(result);
      }
    }
    return results2;
  }
  function evaluateBody(body, bindingsList, visited) {
    let current = bindingsList;
    for (const goal of body) {
      const [gRel, ...gArgs] = goal;
      let next = [];
      for (const bindings of current) {
        const resolved = gArgs.map((a) => a !== null && isVar(a) && bindings[a] !== void 0 ? bindings[a] : a);
        const matches = queryRelation(gRel, resolved, new Set(visited));
        for (const m of matches) {
          const merged = { ...bindings, ...m };
          let ok = true;
          for (let i = 0; i < gArgs.length; i++) {
            if (gArgs[i] !== null && isVar(gArgs[i]) && bindings[gArgs[i]] !== void 0) {
              const resolvedVal = m[gArgs[i]] !== void 0 ? m[gArgs[i]] : resolved[i];
              if (resolvedVal !== void 0 && resolvedVal !== bindings[gArgs[i]]) {
                ok = false;
                break;
              }
            }
          }
          if (ok) {
            for (let i = 0; i < gArgs.length; i++) {
              if (gArgs[i] !== null && isVar(gArgs[i])) {
                if (m[resolved[i]] !== void 0) merged[gArgs[i]] = m[resolved[i]];
                else if (!isVar(resolved[i])) merged[gArgs[i]] = resolved[i];
              }
            }
            next.push(merged);
          }
        }
      }
      current = next;
    }
    return current;
  }
  const results = queryRelation(rel, args);
  const vars = args.filter(isVar);
  if (vars.length === 0) return { success: results.length > 0, count: results.length };
  const unique = [];
  const seen = /* @__PURE__ */ new Set();
  for (const r of results) {
    const key = vars.map((v) => r[v] || "?").join("|");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  return { vars, results: unique };
}
const ditherBg = `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='black'/%3E%3Crect x='2' y='2' width='1' height='1' fill='black'/%3E%3C/svg%3E")`;
const stripeBg = `url("data:image/svg+xml,%3Csvg width='6' height='2' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='6' height='1' fill='black'/%3E%3C/svg%3E")`;
function MacWindow({ title, x, y, w, h, children, zIndex, onFocus, style, titleExtra }) {
  return /* @__PURE__ */ React.createElement("div", { onClick: onFocus, style: {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    background: "white",
    border: "2px solid black",
    boxShadow: "2px 2px 0 black",
    display: "flex",
    flexDirection: "column",
    zIndex,
    ...style
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    background: "white",
    borderBottom: "2px solid black",
    padding: "2px 4px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "default",
    userSelect: "none",
    backgroundImage: stripeBg,
    backgroundSize: "6px 2px"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    width: 12,
    height: 12,
    border: "2px solid black",
    background: "white",
    flexShrink: 0
  } }), /* @__PURE__ */ React.createElement("div", { style: {
    flex: 1,
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 12,
    background: "white",
    padding: "0 8px",
    letterSpacing: 0.5
  } }, title), titleExtra), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" } }, children), /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderLeft: "2px solid black",
    borderTop: "2px solid black",
    background: "white",
    backgroundImage: stripeBg,
    backgroundSize: "4px 2px"
  } }));
}
function MacButton({ label, onClick, active, style: s }) {
  return /* @__PURE__ */ React.createElement("button", { onClick, style: {
    fontFamily: "inherit",
    fontSize: 12,
    padding: "3px 14px",
    background: active ? "black" : "white",
    color: active ? "white" : "black",
    border: "2px solid black",
    borderRadius: 8,
    cursor: "pointer",
    boxShadow: active ? "none" : "1px 1px 0 black",
    ...s
  } }, label);
}
function MacScrollbar({ scrollRef }) {
  const [thumb, setThumb] = useState({ top: 0, height: 20 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const ratio = el.clientHeight / el.scrollHeight;
      const trackH = el.clientHeight - 32;
      setThumb({ top: el.scrollTop / el.scrollHeight * trackH + 16, height: Math.max(20, ratio * trackH) });
    };
    update();
    el.addEventListener("scroll", update);
    return () => el.removeEventListener("scroll", update);
  }, [scrollRef]);
  return /* @__PURE__ */ React.createElement("div", { style: { width: 16, background: "white", borderLeft: "2px solid black", position: "relative", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { height: 16, borderBottom: "1px solid black", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 8, lineHeight: 1 } }, "\u25B2")), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: thumb.top, width: 14, height: thumb.height, background: "white", border: "1px solid black", left: 0 } }), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", bottom: 0, height: 16, width: "100%", borderTop: "1px solid black", display: "flex", alignItems: "center", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 8, lineHeight: 1 } }, "\u25BC")));
}
function GraphCanvas({ facts, highlight }) {
  const canvasRef = useRef(null);
  const [nodes, setNodes] = useState({});
  const [dragging, setDragging] = useState(null);
  const edges = facts.filter((f) => ["parent", "edge", "likes", "path"].includes(f[0]) && f[2]);
  const nodeSet = /* @__PURE__ */ new Set();
  edges.forEach(([, a, b]) => {
    nodeSet.add(a);
    nodeSet.add(b);
  });
  useEffect(() => {
    const n = {};
    const arr = [...nodeSet];
    const cx = 200, cy = 160, r = 120;
    arr.forEach((name, i) => {
      const angle = i / arr.length * Math.PI * 2 - Math.PI / 2;
      n[name] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    setNodes(n);
  }, [facts.length]);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 420, 340);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 420, 340);
    for (let yy = 0; yy < 340; yy += 4) {
      for (let xx = yy % 8 === 0 ? 0 : 2; xx < 420; xx += 4) {
        ctx.fillStyle = "#ddd";
        ctx.fillRect(xx, yy, 1, 1);
      }
    }
    edges.forEach(([rel, a, b]) => {
      if (!nodes[a] || !nodes[b]) return;
      const isHL = highlight.some((h) => h[1] === a && h[2] === b);
      ctx.beginPath();
      ctx.moveTo(nodes[a].x, nodes[a].y);
      ctx.lineTo(nodes[b].x, nodes[b].y);
      ctx.strokeStyle = isHL ? "black" : "#999";
      ctx.lineWidth = isHL ? 3 : 1;
      ctx.setLineDash(rel === "likes" ? [4, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      const dx = nodes[b].x - nodes[a].x, dy = nodes[b].y - nodes[a].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const ux = dx / len, uy = dy / len;
        const ax = nodes[b].x - ux * 16, ay = nodes[b].y - uy * 16;
        ctx.beginPath();
        ctx.moveTo(ax - uy * 5, ay + ux * 5);
        ctx.lineTo(nodes[b].x - ux * 12, nodes[b].y - uy * 12);
        ctx.lineTo(ax + uy * 5, ay - ux * 5);
        ctx.fillStyle = isHL ? "black" : "#999";
        ctx.fill();
      }
    });
    Object.entries(nodes).forEach(([name, pos]) => {
      const isHL = highlight.some((h) => h[1] === name || h[2] === name);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = isHL ? "black" : "white";
      ctx.fill();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = isHL ? "white" : "black";
      ctx.font = "bold 11px 'Geneva', 'Chicago', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, pos.x, pos.y);
    });
  }, [nodes, edges, highlight, dragging]);
  const onMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    for (const [name, pos] of Object.entries(nodes)) {
      if (Math.hypot(mx - pos.x, my - pos.y) < 16) {
        setDragging(name);
        return;
      }
    }
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setNodes((n) => ({ ...n, [dragging]: { x: e.clientX - rect.left, y: e.clientY - rect.top } }));
  };
  const onMouseUp = () => setDragging(null);
  return /* @__PURE__ */ React.createElement(
    "canvas",
    {
      ref: canvasRef,
      width: 420,
      height: 340,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp,
      style: { cursor: dragging ? "grabbing" : "default", imageRendering: "pixelated" }
    }
  );
}
function App() {
  const [cells, setCells] = useState([
    { id: 1, query: "?- parent(tom, X).", output: null, collapsed: false },
    { id: 2, query: "?- ancestor(tom, X).", output: null, collapsed: false },
    { id: 3, query: "?- father(X, Y).", output: null, collapsed: false }
  ]);
  const [highlight, setHighlight] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [focusZ, setFocusZ] = useState({ notebook: 2, graph: 1 });
  const [tab, setTab] = useState("facts");
  const scrollRef = useRef(null);
  const scrollRef2 = useRef(null);
  const nextId = useRef(4);
  const runCell = (id) => {
    setCells((cs) => cs.map((c) => {
      if (c.id !== id) return c;
      const result = evaluateQuery(c.query, SAMPLE_DB);
      let output;
      if (result.error) output = `\u26A0 ${result.error}`;
      else if (result.success !== void 0) output = result.success ? `\u2713 true (${result.count} matches)` : "\u2717 false";
      else {
        const rows = result.results.map((r) => result.vars.map((v) => r[v] || "?").join(", "));
        output = `${result.vars.join(" | ")}
${"\u2500".repeat(30)}
${rows.join("\n")}
\u2500\u2500 ${rows.length} result(s)`;
        const hl = result.results.map((r) => {
          const vals = result.vars.map((v) => r[v]);
          return [null, vals[0], vals[1] || vals[0]];
        });
        setHighlight(hl);
      }
      return { ...c, output };
    }));
  };
  const runAll = () => cells.forEach((c) => runCell(c.id));
  const addCell = () => {
    setCells((cs) => [...cs, { id: nextId.current++, query: "?- ", output: null, collapsed: false }]);
  };
  const deleteCell = (id) => setCells((cs) => cs.filter((c) => c.id !== id));
  const updateQuery = (id, query) => setCells((cs) => cs.map((c) => c.id === id ? { ...c, query } : c));
  const menuBar = [
    { label: "\u{130D1} File", items: ["New Notebook", "Open\u2026", "Save", "\u2500", "Quit"] },
    { label: "Edit", items: ["Undo \u2318Z", "Cut \u2318X", "Copy \u2318C", "Paste \u2318V"] },
    { label: "Query", items: ["Run Cell \u2318\u21A9", "Run All \u2318\u21E7\u21A9", "\u2500", "Add Cell", "Clear Outputs"] },
    { label: "Graph", items: ["Reset Layout", "Show Labels", "\u2500", "Export as PICT"] },
    { label: "Help", items: ["About DatalogDB\u2026", "Datalog Reference"] }
  ];
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100vh",
        background: "#c0c0c0",
        backgroundImage: ditherBg,
        backgroundSize: "4px 4px",
        fontFamily: "'Geneva', 'Chicago', 'Monaco', 'Courier New', monospace",
        fontSize: 12,
        color: "black",
        overflow: "hidden",
        position: "relative",
        cursor: "default"
      },
      onClick: () => setActiveMenu(null)
    },
    /* @__PURE__ */ React.createElement("div", { style: {
      height: 22,
      background: "white",
      borderBottom: "2px solid black",
      display: "flex",
      alignItems: "center",
      padding: "0 8px",
      gap: 0,
      position: "relative",
      zIndex: 100
    } }, menuBar.map((menu, mi) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: mi,
        style: { position: "relative" },
        onClick: (e) => {
          e.stopPropagation();
          setActiveMenu(activeMenu === mi ? null : mi);
        },
        onMouseEnter: () => activeMenu !== null && setActiveMenu(mi)
      },
      /* @__PURE__ */ React.createElement("div", { style: {
        padding: "2px 12px",
        fontWeight: mi === 0 ? "bold" : "normal",
        background: activeMenu === mi ? "black" : "transparent",
        color: activeMenu === mi ? "white" : "black",
        fontSize: 12
      } }, menu.label),
      activeMenu === mi && /* @__PURE__ */ React.createElement("div", { style: {
        position: "absolute",
        top: 20,
        left: 0,
        background: "white",
        border: "2px solid black",
        boxShadow: "2px 2px 0 black",
        minWidth: 180,
        zIndex: 999,
        padding: "2px 0"
      } }, menu.items.map(
        (item, ii) => item === "\u2500" ? /* @__PURE__ */ React.createElement("div", { key: ii, style: { borderTop: "1px dashed black", margin: "2px 4px" } }) : /* @__PURE__ */ React.createElement(
          "div",
          {
            key: ii,
            style: { padding: "3px 16px", cursor: "default" },
            onMouseEnter: (e) => {
              e.target.style.background = "black";
              e.target.style.color = "white";
            },
            onMouseOver: (e) => {
              e.target.style.background = "black";
              e.target.style.color = "white";
            },
            onMouseOut: (e) => {
              e.target.style.background = "white";
              e.target.style.color = "black";
            },
            onClick: () => {
              if (item === "Run All \u2318\u21E7\u21A9") runAll();
              if (item === "Add Cell") addCell();
              if (item === "Clear Outputs") setCells((cs) => cs.map((c) => ({ ...c, output: null })));
              if (item.startsWith("About")) setAboutOpen(true);
              setActiveMenu(null);
            }
          },
          item
        )
      ))
    )), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, letterSpacing: 1 } }, (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))),
    /* @__PURE__ */ React.createElement(
      MacWindow,
      {
        title: "DatalogDB \u2014 Untitled Notebook",
        x: 16,
        y: 32,
        w: 540,
        h: 540,
        zIndex: focusZ.notebook,
        onFocus: () => setFocusZ({ notebook: 3, graph: 2 }),
        titleExtra: /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, background: "white", padding: "0 4px" } }, /* @__PURE__ */ React.createElement(MacButton, { label: "\u25B6 Run All", onClick: runAll }), /* @__PURE__ */ React.createElement(MacButton, { label: "+ Cell", onClick: addCell }))
      },
      /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flex: 1, overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { ref: scrollRef, style: { flex: 1, overflow: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 } }, cells.map((cell, ci) => /* @__PURE__ */ React.createElement("div", { key: cell.id, style: { border: "2px solid black", background: "white" } }, /* @__PURE__ */ React.createElement("div", { style: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        borderBottom: "1px solid black",
        background: "#eee",
        backgroundImage: ditherBg,
        backgroundSize: "4px 4px"
      } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", fontSize: 10, width: 50 } }, "In [", ci + 1, "]:"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement(MacButton, { label: "\u25B6", onClick: () => runCell(cell.id), style: { padding: "1px 8px", fontSize: 10 } }), /* @__PURE__ */ React.createElement(MacButton, { label: "\u2715", onClick: () => deleteCell(cell.id), style: { padding: "1px 6px", fontSize: 10 } })), /* @__PURE__ */ React.createElement("div", { style: { padding: 0, position: "relative" } }, /* @__PURE__ */ React.createElement(
        "textarea",
        {
          value: cell.query,
          onChange: (e) => updateQuery(cell.id, e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              runCell(cell.id);
            }
          },
          spellCheck: false,
          style: {
            width: "100%",
            minHeight: 36,
            padding: "6px 8px",
            border: "none",
            outline: "none",
            fontFamily: "'Monaco', 'Courier New', monospace",
            fontSize: 13,
            background: "white",
            resize: "vertical",
            boxSizing: "border-box"
          }
        }
      )), cell.output && /* @__PURE__ */ React.createElement("div", { style: {
        borderTop: "1px dashed black",
        padding: "6px 8px",
        fontFamily: "'Monaco', 'Courier New', monospace",
        fontSize: 11,
        background: "#f8f8f0",
        whiteSpace: "pre-wrap",
        lineHeight: 1.5
      } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", fontSize: 10 } }, "Out[", ci + 1, "]: "), cell.output))), /* @__PURE__ */ React.createElement("div", { style: {
        margin: "4px 0 8px",
        padding: 8,
        border: "1px dashed #999",
        fontSize: 10,
        color: "#666",
        lineHeight: 1.6
      } }, /* @__PURE__ */ React.createElement("b", null, "Try:"), " ?- parent(tom, X). \xA0|\xA0 ?- ancestor(tom, X). \xA0|\xA0 ?- father(X, Y).", /* @__PURE__ */ React.createElement("br", null), "?- sibling(X, Y). \xA0|\xA0 ?- path(a, X). \xA0|\xA0 ?- mother(X, Y).", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("i", null, "\u2318+Enter to run cell \xA0\u2022\xA0 Variables start with uppercase"))), /* @__PURE__ */ React.createElement(MacScrollbar, { scrollRef }))
    ),
    /* @__PURE__ */ React.createElement(
      MacWindow,
      {
        title: "Graph Explorer",
        x: 572,
        y: 32,
        w: 450,
        h: 430,
        zIndex: focusZ.graph,
        onFocus: () => setFocusZ({ notebook: 2, graph: 3 })
      },
      /* @__PURE__ */ React.createElement("div", { style: { display: "flex", borderBottom: "2px solid black" } }, ["graph", "facts", "rules"].map((t) => /* @__PURE__ */ React.createElement("div", { key: t, onClick: () => setTab(t), style: {
        padding: "4px 16px",
        cursor: "default",
        fontWeight: tab === t ? "bold" : "normal",
        background: tab === t ? "white" : "#ddd",
        borderRight: "1px solid black",
        borderBottom: tab === t ? "2px solid white" : "none",
        marginBottom: tab === t ? -2 : 0,
        textTransform: "capitalize",
        fontSize: 11
      } }, t === "graph" ? "\u2B21 Graph" : t === "facts" ? "\u25A4 Facts" : "\u2699 Rules"))),
      tab === "graph" && /* @__PURE__ */ React.createElement("div", { style: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement(GraphCanvas, { facts: SAMPLE_DB.facts, highlight }), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid black", padding: "3px 8px", fontSize: 10, background: "#eee" } }, "Drag nodes to reposition \u2022 Solid=parent/edge, Dashed=likes \u2022 ", highlight.length > 0 ? `${highlight.length} highlighted` : "Run a query to highlight")),
      tab === "facts" && /* @__PURE__ */ React.createElement("div", { style: { flex: 1, display: "flex", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { ref: scrollRef2, style: { flex: 1, overflow: "auto", padding: 4 } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { borderBottom: "2px solid black", position: "sticky", top: 0, background: "white" } }, /* @__PURE__ */ React.createElement("th", { style: { textAlign: "left", padding: "3px 6px", fontWeight: "bold" } }, "Relation"), /* @__PURE__ */ React.createElement("th", { style: { textAlign: "left", padding: "3px 6px" } }, "Arg 1"), /* @__PURE__ */ React.createElement("th", { style: { textAlign: "left", padding: "3px 6px" } }, "Arg 2"))), /* @__PURE__ */ React.createElement("tbody", null, SAMPLE_DB.facts.map(([rel, a, b], i) => /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: "1px dotted #999" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "2px 6px", fontWeight: "bold" } }, rel), /* @__PURE__ */ React.createElement("td", { style: { padding: "2px 6px" } }, a), /* @__PURE__ */ React.createElement("td", { style: { padding: "2px 6px", color: b ? "black" : "#999" } }, b || "\u2014")))))), /* @__PURE__ */ React.createElement(MacScrollbar, { scrollRef: scrollRef2 })),
      tab === "rules" && /* @__PURE__ */ React.createElement("div", { style: { flex: 1, overflow: "auto", padding: 8, fontSize: 11, lineHeight: 1.8 } }, SAMPLE_DB.rules.map((rule, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { padding: "2px 0", borderBottom: "1px dotted #ccc" } }, /* @__PURE__ */ React.createElement("b", null, rule.head[0]), "(", rule.head.slice(1).join(", "), ") :- ", rule.body.map((b) => `${b[0]}(${b.slice(1).filter((x) => x !== null).join(", ")})`).join(", "), ".")))
    ),
    aboutOpen && /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: 340,
      background: "white",
      border: "2px solid black",
      boxShadow: "4px 4px 0 black",
      padding: 0
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      borderBottom: "2px solid black",
      padding: "2px 8px",
      textAlign: "center",
      backgroundImage: stripeBg,
      backgroundSize: "6px 2px",
      fontWeight: "bold",
      fontSize: 12
    } }, /* @__PURE__ */ React.createElement("span", { style: { background: "white", padding: "0 8px" } }, "About DatalogDB")), /* @__PURE__ */ React.createElement("div", { style: { padding: 20, textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 36, marginBottom: 8 } }, "\u2B21"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold", fontSize: 14, marginBottom: 4 } }, "DatalogDB Notebook"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "#666", marginBottom: 12 } }, "Version 1.0 \u2022 A Graph Database", /* @__PURE__ */ React.createElement("br", null), "Datalog Query Environment"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, margin: "8px 0", padding: 8, background: "#f5f5f5", border: "1px solid #ccc", textAlign: "left", lineHeight: 1.6 } }, "A notebook-style interface for querying graph data using Datalog. Supports facts, rules, recursive queries, and interactive graph exploration."), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 9, color: "#999", marginTop: 8 } }, "\xA9 2026 DatalogDB \u2022 For Macintosh"), /* @__PURE__ */ React.createElement(MacButton, { label: "OK", onClick: () => setAboutOpen(false), style: { marginTop: 12 } })))),
    /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 20,
      borderTop: "2px solid black",
      background: "white",
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      fontSize: 10,
      justifyContent: "space-between"
    } }, /* @__PURE__ */ React.createElement("span", null, "\u{1F4BE} ", SAMPLE_DB.facts.length, " facts \u2022 ", SAMPLE_DB.rules.length, " rules loaded"), /* @__PURE__ */ React.createElement("span", null, cells.filter((c) => c.output).length, "/", cells.length, " cells evaluated"), /* @__PURE__ */ React.createElement("span", null, "DatalogDB v1.0"))
  );
}
const __artifactDefault = App;
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(__artifactDefault));
