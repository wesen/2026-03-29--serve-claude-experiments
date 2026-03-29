import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
const MONO = {
  bg: "#e8e4d4",
  bgDark: "#d4d0c0",
  white: "#f5f2e8",
  black: "#1a1a1a",
  border: "#1a1a1a",
  shadow: "#8a8878",
  accent: "#1a8a7a",
  accentLight: "#d0ece8",
  accentDim: "#2a6a60",
  red: "#c44a3f",
  yellow: "#c4a03f",
  green: "#3fa05a",
  textMuted: "#6a6858"
};
const CHICAGO = `"Chicago_", "Geneva", "Monaco", monospace`;
const PIXEL_BORDER = `2px solid ${MONO.black}`;
const INITIAL_TREE = [
  {
    id: "n_banner",
    role: "banner",
    name: "",
    depth: 0,
    children: [
      { id: "n_1", role: "link", name: "Demo Shop", depth: 1, href: "/", attrs: {} },
      { id: "n_2", role: "link", name: "Products", depth: 1, href: "/products", attrs: {} },
      { id: "n_3", role: "link", name: "Cart (0)", depth: 1, href: "/cart", attrs: {} },
      { id: "n_4", role: "link", name: "Sign In", depth: 1, href: "/login", attrs: {} }
    ]
  },
  {
    id: "n_main",
    role: "main",
    name: "",
    depth: 0,
    children: [
      { id: "n_5", role: "heading", name: "Welcome to Demo Shop", depth: 1, level: 1, attrs: {} },
      { id: "n_6", role: "paragraph", name: "Free shipping on orders over $50", depth: 1, attrs: {} },
      {
        id: "n_region",
        role: "region",
        name: "Featured Products",
        depth: 1,
        children: [
          {
            id: "n_li1",
            role: "listitem",
            name: "",
            depth: 2,
            children: [
              { id: "n_7", role: "img", name: "Wireless Headphones", depth: 3, attrs: { size: "120\xD7120" } },
              { id: "n_8", role: "heading", name: "Wireless Headphones", depth: 3, level: 3, attrs: {} },
              { id: "n_9", role: "text", name: "$79.99", depth: 3, attrs: {} },
              { id: "n_10", role: "button", name: "Add to Cart", depth: 3, attrs: { disabled: false } }
            ]
          },
          {
            id: "n_li2",
            role: "listitem",
            name: "",
            depth: 2,
            children: [
              { id: "n_11", role: "img", name: "USB-C Hub", depth: 3, attrs: { size: "120\xD7120" } },
              { id: "n_12", role: "heading", name: "USB-C Hub", depth: 3, level: 3, attrs: {} },
              { id: "n_13", role: "text", name: "$34.99", depth: 3, attrs: {} },
              { id: "n_14", role: "button", name: "Add to Cart", depth: 3, attrs: { disabled: false } }
            ]
          },
          {
            id: "n_li3",
            role: "listitem",
            name: "",
            depth: 2,
            children: [
              { id: "n_15", role: "img", name: "Mechanical Keyboard", depth: 3, attrs: { size: "120\xD7120" } },
              { id: "n_16", role: "heading", name: "Mechanical Keyboard", depth: 3, level: 3, attrs: {} },
              { id: "n_17", role: "text", name: "$129.99", depth: 3, attrs: {} },
              { id: "n_18", role: "button", name: "Add to Cart", depth: 3, attrs: { disabled: false } }
            ]
          }
        ]
      },
      { id: "n_19", role: "link", name: "View all products \u2192", depth: 1, href: "/products", attrs: {} }
    ]
  },
  {
    id: "n_footer",
    role: "contentinfo",
    name: "",
    depth: 0,
    children: [{ id: "n_20", role: "text", name: "\xA9 2026 Demo Shop Inc.", depth: 1, attrs: {} }]
  }
];
const LOCATORS = {
  n_10: [
    { kind: "role", value: `getByRole('button', { name: 'Add to Cart' }).first()`, rank: 1 },
    { kind: "text", value: `getByText('Add to Cart').first()`, rank: 2 },
    { kind: "testid", value: "(not available)", rank: 3 }
  ],
  n_14: [
    { kind: "role", value: `getByRole('button', { name: 'Add to Cart' }).nth(1)`, rank: 1 },
    { kind: "text", value: `getByText('Add to Cart').nth(1)`, rank: 2 }
  ],
  n_18: [
    { kind: "role", value: `getByRole('button', { name: 'Add to Cart' }).nth(2)`, rank: 1 },
    { kind: "text", value: `getByText('Add to Cart').nth(2)`, rank: 2 }
  ],
  n_4: [
    { kind: "role", value: `getByRole('link', { name: 'Sign In' })`, rank: 1 },
    { kind: "text", value: `getByText('Sign In')`, rank: 2 }
  ],
  n_5: [
    { kind: "role", value: `getByRole('heading', { name: 'Welcome to Demo Shop' })`, rank: 1 }
  ]
};
const NODE_ACTIONS = {
  button: ["click", "hover", "focus"],
  link: ["click", "hover", "focus"],
  textbox: ["fill", "press", "focus", "clear"],
  checkbox: ["check", "uncheck", "focus"],
  combobox: ["selectOption", "focus"],
  heading: ["\u2014"],
  text: ["\u2014"],
  img: ["\u2014"],
  paragraph: ["\u2014"],
  listitem: ["\u2014"],
  region: ["\u2014"],
  banner: ["\u2014"],
  main: ["\u2014"],
  contentinfo: ["\u2014"]
};
const INITIAL_TIMELINE = [
  { t: "00.000", type: "session_created", detail: "ctx_01", status: "ok" },
  { t: "00.012", type: "page_created", detail: "p_001", status: "ok" },
  { t: "00.089", type: "goto", detail: "https://demo-shop.test/", status: "ok" },
  { t: "00.210", type: "request", detail: "GET /  \u2192  200", status: "ok" },
  { t: "00.340", type: "request", detail: "GET /assets/style.css  \u2192  200", status: "ok" },
  { t: "00.380", type: "request", detail: "GET /api/featured  \u2192  200", status: "ok" },
  { t: "00.890", type: "nav_committed", detail: "https://demo-shop.test/", status: "ok" },
  { t: "00.901", type: "snapshot", detail: "nodes=24", status: "ok" }
];
function TitleBar({ title, onClose, onMinimize, onZoom, style }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        background: MONO.white,
        borderBottom: PIXEL_BORDER,
        display: "flex",
        alignItems: "center",
        height: 26,
        padding: "0 8px",
        userSelect: "none",
        cursor: "default",
        ...style
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginRight: 12 } }, [MONO.red, MONO.yellow, MONO.green].map((c, i) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: i,
        onClick: i === 0 ? onClose : i === 1 ? onMinimize : onZoom,
        style: {
          width: 12,
          height: 12,
          borderRadius: 6,
          background: c,
          border: `1px solid ${MONO.black}`,
          cursor: "pointer"
        }
      }
    ))),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          flex: 1,
          textAlign: "center",
          fontSize: 12,
          fontFamily: CHICAGO,
          fontWeight: "bold",
          letterSpacing: 0.5,
          color: MONO.black,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis"
        }
      },
      title
    ),
    /* @__PURE__ */ React.createElement("div", { style: { width: 54 } })
  );
}
function MacWindow({ title, children, style, bodyStyle, onClose, onMinimize, onZoom }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        border: PIXEL_BORDER,
        background: MONO.bg,
        boxShadow: `3px 3px 0 ${MONO.shadow}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...style
      }
    },
    /* @__PURE__ */ React.createElement(TitleBar, { title, onClose, onMinimize, onZoom }),
    /* @__PURE__ */ React.createElement("div", { style: { flex: 1, overflow: "auto", ...bodyStyle } }, children)
  );
}
function MenuBar() {
  const items = ["File", "Session", "Page", "Actions", "View", "Help"];
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        background: MONO.white,
        borderBottom: PIXEL_BORDER,
        display: "flex",
        alignItems: "center",
        height: 24,
        padding: "0 12px",
        gap: 0,
        fontFamily: CHICAGO,
        fontSize: 12,
        fontWeight: "bold",
        userSelect: "none"
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: { marginRight: 16, fontSize: 14 } }, "\u{1F3AD}"),
    items.map((item) => /* @__PURE__ */ React.createElement(
      "span",
      {
        key: item,
        style: {
          padding: "2px 10px",
          cursor: "default",
          borderRadius: 2
        },
        onMouseEnter: (e) => (e.target.style.background = MONO.black, e.target.style.color = MONO.white),
        onMouseLeave: (e) => (e.target.style.background = "transparent", e.target.style.color = MONO.black)
      },
      item
    )),
    /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: MONO.textMuted, fontWeight: "normal" } }, "Playwright v1.42 \u2014 Chromium")
  );
}
function RoleIcon({ role }) {
  const map = {
    banner: "\u25A4",
    main: "\u25E7",
    contentinfo: "\u25A5",
    heading: "H",
    paragraph: "\xB6",
    link: "\u26D3",
    button: "\u25C9",
    text: "T",
    img: "\u{1F5BC}",
    region: "\u25EB",
    listitem: "\u25AA",
    textbox: "\u25AD",
    checkbox: "\u2610",
    combobox: "\u229F",
    form: "\u{1F4CB}"
  };
  return /* @__PURE__ */ React.createElement(
    "span",
    {
      style: {
        display: "inline-block",
        width: 16,
        textAlign: "center",
        fontSize: 10,
        color: MONO.textMuted,
        fontFamily: CHICAGO,
        flexShrink: 0
      }
    },
    map[role] || "\xB7"
  );
}
function TreeNode({ node, depth = 0, selectedId, onSelect }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const isInteractive = ["button", "link", "textbox", "checkbox", "combobox"].includes(node.role);
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: () => onSelect(node),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px 2px " + (12 + depth * 16) + "px",
        cursor: "pointer",
        background: isSelected ? MONO.black : "transparent",
        color: isSelected ? MONO.white : MONO.black,
        fontFamily: CHICAGO,
        fontSize: 11,
        lineHeight: "18px",
        borderLeft: isInteractive && !isSelected ? `2px solid ${MONO.accent}` : "2px solid transparent"
      }
    },
    hasChildren ? /* @__PURE__ */ React.createElement(
      "span",
      {
        onClick: (e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        },
        style: { width: 12, textAlign: "center", fontSize: 9, flexShrink: 0, cursor: "pointer" }
      },
      expanded ? "\u25BC" : "\u25B6"
    ) : /* @__PURE__ */ React.createElement("span", { style: { width: 12 } }),
    /* @__PURE__ */ React.createElement(RoleIcon, { role: node.role }),
    /* @__PURE__ */ React.createElement("span", { style: { color: isSelected ? MONO.accentLight : MONO.accent, fontWeight: "bold", flexShrink: 0 } }, "[", node.role, node.level ? ` h${node.level}` : "", "]"),
    node.name && /* @__PURE__ */ React.createElement(
      "span",
      {
        style: {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: isSelected ? MONO.white : MONO.black
        }
      },
      '"',
      node.name,
      '"'
    ),
    node.href && /* @__PURE__ */ React.createElement("span", { style: { color: isSelected ? "#aaa" : MONO.textMuted, fontSize: 10, flexShrink: 0 } }, "\u2192 ", node.href)
  ), hasChildren && expanded && node.children.map((child) => /* @__PURE__ */ React.createElement(TreeNode, { key: child.id, node: child, depth: depth + 1, selectedId, onSelect })));
}
function LocatorPane({ node }) {
  if (!node) return /* @__PURE__ */ React.createElement("div", { style: { padding: 12, fontFamily: CHICAGO, fontSize: 11, color: MONO.textMuted, textAlign: "center" } }, "Select a node to inspect");
  const locators = LOCATORS[node.id] || [
    { kind: "role", value: `getByRole('${node.role}'${node.name ? `, { name: '${node.name}' }` : ""})`, rank: 1 }
  ];
  const actions = NODE_ACTIONS[node.role] || ["\u2014"];
  return /* @__PURE__ */ React.createElement("div", { style: { fontFamily: CHICAGO, fontSize: 11, color: MONO.black } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 10px", borderBottom: `1px solid ${MONO.shadow}`, background: MONO.accentLight } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold", marginBottom: 2 } }, /* @__PURE__ */ React.createElement("span", { style: { color: MONO.accent } }, "[", node.role, "]"), " ", node.name && `"${node.name}"`), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: MONO.textMuted } }, "id: ", node.id, " \xB7 frame: f_main")), /* @__PURE__ */ React.createElement("div", { style: { padding: "6px 10px", borderBottom: `1px solid ${MONO.shadow}` } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold", marginBottom: 4, fontSize: 10, color: MONO.textMuted, textTransform: "uppercase", letterSpacing: 1 } }, "Locators"), locators.map((l, i) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: i,
      style: {
        display: "flex",
        gap: 6,
        alignItems: "flex-start",
        padding: "3px 0",
        borderLeft: i === 0 ? `2px solid ${MONO.accent}` : "2px solid transparent",
        paddingLeft: 6
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: { color: MONO.textMuted, flexShrink: 0, width: 14 } }, l.rank, "."),
    /* @__PURE__ */ React.createElement("code", { style: { fontSize: 10, wordBreak: "break-all", color: l.value.includes("not available") ? MONO.textMuted : MONO.black } }, l.value)
  ))), /* @__PURE__ */ React.createElement("div", { style: { padding: "6px 10px", borderBottom: `1px solid ${MONO.shadow}` } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold", marginBottom: 6, fontSize: 10, color: MONO.textMuted, textTransform: "uppercase", letterSpacing: 1 } }, "Actions"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, actions.map((a) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: a,
      disabled: a === "\u2014",
      style: {
        fontFamily: CHICAGO,
        fontSize: 10,
        padding: "3px 8px",
        border: PIXEL_BORDER,
        background: a === "\u2014" ? MONO.bgDark : MONO.white,
        color: a === "\u2014" ? MONO.textMuted : MONO.black,
        cursor: a === "\u2014" ? "default" : "pointer",
        boxShadow: a === "\u2014" ? "none" : `1px 1px 0 ${MONO.shadow}`
      }
    },
    a === "click" ? "\u25B6 " : "",
    a
  )))), /* @__PURE__ */ React.createElement("div", { style: { padding: "6px 10px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold", marginBottom: 4, fontSize: 10, color: MONO.textMuted, textTransform: "uppercase", letterSpacing: 1 } }, "Attributes"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, lineHeight: "16px" } }, /* @__PURE__ */ React.createElement("div", null, "visible: ", /* @__PURE__ */ React.createElement("span", { style: { color: MONO.green } }, "true")), /* @__PURE__ */ React.createElement("div", null, "enabled: ", /* @__PURE__ */ React.createElement("span", { style: { color: MONO.green } }, "true")), node.attrs?.disabled !== void 0 && /* @__PURE__ */ React.createElement("div", null, "disabled: ", /* @__PURE__ */ React.createElement("span", { style: { color: node.attrs.disabled ? MONO.red : MONO.green } }, String(node.attrs.disabled))), node.href && /* @__PURE__ */ React.createElement("div", null, "href: ", /* @__PURE__ */ React.createElement("span", { style: { color: MONO.accent } }, node.href)), node.attrs?.size && /* @__PURE__ */ React.createElement("div", null, "size: ", node.attrs.size))));
}
function TimelinePane({ events }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events]);
  const typeColors = {
    session_created: MONO.textMuted,
    page_created: MONO.textMuted,
    goto: MONO.accent,
    nav_committed: MONO.accent,
    request: MONO.black,
    snapshot: MONO.accentDim,
    action_started: MONO.yellow,
    action_finished: MONO.green,
    dialog_opened: MONO.red,
    error: MONO.red
  };
  return /* @__PURE__ */ React.createElement("div", { ref, style: { fontFamily: CHICAGO, fontSize: 10, lineHeight: "16px", padding: "4px 0", maxHeight: "100%", overflow: "auto" } }, events.map((ev, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", gap: 8, padding: "1px 10px", alignItems: "baseline" } }, /* @__PURE__ */ React.createElement("span", { style: { color: MONO.textMuted, flexShrink: 0, width: 42, textAlign: "right", fontVariantNumeric: "tabular-nums" } }, ev.t), /* @__PURE__ */ React.createElement("span", { style: { color: typeColors[ev.type] || MONO.black, fontWeight: "bold", flexShrink: 0, width: 110 } }, ev.type), /* @__PURE__ */ React.createElement("span", { style: { color: MONO.black, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ev.detail), /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", flexShrink: 0 } }, ev.status === "ok" ? /* @__PURE__ */ React.createElement("span", { style: { color: MONO.green } }, "\u2713") : ev.status === "err" ? /* @__PURE__ */ React.createElement("span", { style: { color: MONO.red } }, "\u2717") : /* @__PURE__ */ React.createElement("span", { style: { color: MONO.yellow } }, "\u25D0")))), /* @__PURE__ */ React.createElement("div", { style: { padding: "2px 10px", color: MONO.accent } }, "\u258C"));
}
function SessionRail({ sessions, activePageId, onSelectPage }) {
  return /* @__PURE__ */ React.createElement("div", { style: { fontFamily: CHICAGO, fontSize: 11, padding: "8px 0" } }, sessions.map((s) => /* @__PURE__ */ React.createElement("div", { key: s.id, style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "2px 10px", fontWeight: "bold", display: "flex", alignItems: "center", gap: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9 } }, "\u25BC"), " ", s.id), /* @__PURE__ */ React.createElement("div", { style: { padding: "0 10px 0 18px", fontSize: 10, color: MONO.textMuted } }, s.browser, " \xB7 ", s.auth || "no auth"), s.pages.map((p) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: p.id,
      onClick: () => onSelectPage(p.id),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px 3px 22px",
        cursor: "pointer",
        background: activePageId === p.id ? MONO.black : "transparent",
        color: activePageId === p.id ? MONO.white : MONO.black
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: { color: activePageId === p.id ? MONO.green : MONO.accent } }, "\u25CF"),
    /* @__PURE__ */ React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.label),
    p.dialog && /* @__PURE__ */ React.createElement("span", { style: { color: MONO.red, fontSize: 9 } }, "\u26A0")
  )))));
}
function StatusBar({ url, loadTime, nodeCount }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        height: 22,
        borderTop: PIXEL_BORDER,
        background: MONO.bgDark,
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        fontFamily: CHICAGO,
        fontSize: 10,
        color: MONO.textMuted,
        gap: 16
      }
    },
    /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { color: MONO.green } }, "\u25CF"), " connected"),
    /* @__PURE__ */ React.createElement("span", null, "URL: ", /* @__PURE__ */ React.createElement("span", { style: { color: MONO.black } }, url)),
    /* @__PURE__ */ React.createElement("span", null, "load: ", loadTime),
    /* @__PURE__ */ React.createElement("span", null, "nodes: ", nodeCount),
    /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }),
    /* @__PURE__ */ React.createElement("span", null, "ctx_01 / p_001")
  );
}
function CommandInput({ onExecute }) {
  const [cmd, setCmd] = useState("goto");
  const [arg, setArg] = useState("");
  const cmds = ["goto", "click", "fill", "press", "check", "selectOption", "snapshot", "waitFor"];
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderTop: `1px solid ${MONO.shadow}`,
        background: MONO.bgDark,
        fontFamily: CHICAGO,
        fontSize: 11
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: { color: MONO.accent, fontWeight: "bold" } }, "\u25B6"),
    /* @__PURE__ */ React.createElement(
      "select",
      {
        value: cmd,
        onChange: (e) => setCmd(e.target.value),
        style: {
          fontFamily: CHICAGO,
          fontSize: 10,
          padding: "2px 4px",
          border: PIXEL_BORDER,
          background: MONO.white,
          cursor: "pointer"
        }
      },
      cmds.map((c) => /* @__PURE__ */ React.createElement("option", { key: c, value: c }, c))
    ),
    /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: arg,
        onChange: (e) => setArg(e.target.value),
        placeholder: cmd === "goto" ? "https://..." : cmd === "fill" ? "value" : "target",
        onKeyDown: (e) => e.key === "Enter" && onExecute(cmd, arg),
        style: {
          flex: 1,
          fontFamily: CHICAGO,
          fontSize: 10,
          padding: "3px 6px",
          border: PIXEL_BORDER,
          background: MONO.white,
          outline: "none"
        }
      }
    ),
    /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => onExecute(cmd, arg),
        style: {
          fontFamily: CHICAGO,
          fontSize: 10,
          padding: "3px 10px",
          border: PIXEL_BORDER,
          background: MONO.white,
          cursor: "pointer",
          boxShadow: `1px 1px 0 ${MONO.shadow}`,
          fontWeight: "bold"
        }
      },
      "Execute"
    )
  );
}
function PlaywrightBrowser() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [timeline, setTimeline] = useState(INITIAL_TIMELINE);
  const [tree] = useState(INITIAL_TREE);
  const [showAbout, setShowAbout] = useState(false);
  const sessions = [
    {
      id: "ctx_01",
      browser: "chromium",
      auth: "no auth",
      pages: [
        { id: "p_001", label: "/ \u2014 Demo Shop", dialog: false }
      ]
    }
  ];
  const handleExecute = useCallback((cmd, arg) => {
    const t = (timeline.length * 0.12 + 1).toFixed(3).padStart(6, "0");
    setTimeline((prev) => [
      ...prev,
      { t, type: "action_started", detail: `${cmd} ${arg}`, status: "ok" }
    ]);
    setTimeout(() => {
      const t2 = (parseFloat(t) + 0.08).toFixed(3).padStart(6, "0");
      setTimeline((prev) => [
        ...prev,
        { t: t2, type: "action_finished", detail: `${cmd} ok`, status: "ok" },
        { t: (parseFloat(t2) + 0.01).toFixed(3).padStart(6, "0"), type: "snapshot", detail: "nodes=24 ~2 changed", status: "ok" }
      ]);
    }, 400);
  }, [timeline]);
  const patternSvg = `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='%23d4d0c0' opacity='0.4'/%3E%3C/svg%3E")`;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100vh",
        background: `${MONO.bg} ${patternSvg}`,
        display: "flex",
        flexDirection: "column",
        fontFamily: CHICAGO,
        color: MONO.black,
        overflow: "hidden",
        position: "relative"
      }
    },
    /* @__PURE__ */ React.createElement("style", null, `
        @font-face {
          font-family: 'Chicago_';
          src: local('Geneva'), local('Monaco'), local('Menlo');
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 12px; }
        ::-webkit-scrollbar-track { background: ${MONO.bgDark}; border-left: ${PIXEL_BORDER}; }
        ::-webkit-scrollbar-thumb { background: ${MONO.shadow}; border: 1px solid ${MONO.black}; }
        ::selection { background: ${MONO.black}; color: ${MONO.white}; }
      `),
    /* @__PURE__ */ React.createElement(MenuBar, null),
    /* @__PURE__ */ React.createElement("div", { style: { flex: 1, display: "flex", overflow: "hidden", padding: 6, gap: 6 } }, /* @__PURE__ */ React.createElement(
      MacWindow,
      {
        title: "Sessions",
        style: { width: 170, flexShrink: 0 },
        bodyStyle: { padding: 0 }
      },
      /* @__PURE__ */ React.createElement(SessionRail, { sessions, activePageId: "p_001", onSelectPage: () => {
      } }),
      /* @__PURE__ */ React.createElement("div", { style: { borderTop: `1px solid ${MONO.shadow}`, padding: "6px 10px", fontSize: 10, color: MONO.textMuted } }, /* @__PURE__ */ React.createElement("div", null, "browser: chromium"), /* @__PURE__ */ React.createElement("div", null, "viewport: 1280\xD7720"), /* @__PURE__ */ React.createElement("div", null, "locale: en-US"))
    ), /* @__PURE__ */ React.createElement(
      MacWindow,
      {
        title: "Structure \u2014 demo-shop.test/",
        style: { flex: 1, minWidth: 0 },
        bodyStyle: { padding: 0 }
      },
      /* @__PURE__ */ React.createElement("div", { style: { borderBottom: `1px solid ${MONO.shadow}`, padding: "4px 10px", fontSize: 10, display: "flex", gap: 8, color: MONO.textMuted, background: MONO.bgDark } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", color: MONO.black } }, "Page: p_001"), /* @__PURE__ */ React.createElement("span", null, "\xB7"), /* @__PURE__ */ React.createElement("span", null, "URL: https://demo-shop.test/"), /* @__PURE__ */ React.createElement("span", null, "\xB7"), /* @__PURE__ */ React.createElement("span", null, "200 OK"), /* @__PURE__ */ React.createElement("span", null, "\xB7"), /* @__PURE__ */ React.createElement("span", null, "0.9s"), /* @__PURE__ */ React.createElement("span", null, "\xB7"), /* @__PURE__ */ React.createElement("span", null, 'Title: "Demo Shop \u2014 Home"')),
      /* @__PURE__ */ React.createElement("div", { style: { overflow: "auto", flex: 1 } }, tree.map((node) => /* @__PURE__ */ React.createElement(
        TreeNode,
        {
          key: node.id,
          node,
          depth: 0,
          selectedId: selectedNode?.id,
          onSelect: setSelectedNode
        }
      ))),
      /* @__PURE__ */ React.createElement(CommandInput, { onExecute: handleExecute })
    ), /* @__PURE__ */ React.createElement("div", { style: { width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React.createElement(
      MacWindow,
      {
        title: selectedNode ? `Inspect: [${selectedNode.role}]` : "Inspector",
        style: { flex: 1, minHeight: 0 },
        bodyStyle: { padding: 0, overflow: "auto" }
      },
      /* @__PURE__ */ React.createElement(LocatorPane, { node: selectedNode })
    ), /* @__PURE__ */ React.createElement(
      MacWindow,
      {
        title: "Timeline",
        style: { height: 220, flexShrink: 0 },
        bodyStyle: { padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
      },
      /* @__PURE__ */ React.createElement(TimelinePane, { events: timeline })
    ))),
    /* @__PURE__ */ React.createElement(StatusBar, { url: "https://demo-shop.test/", loadTime: "0.9s", nodeCount: 24 }),
    showAbout && /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100
        },
        onClick: () => setShowAbout(false)
      },
      /* @__PURE__ */ React.createElement(
        MacWindow,
        {
          title: "About Playwright Browser",
          style: { width: 320 },
          bodyStyle: { padding: 20, textAlign: "center" },
          onClose: () => setShowAbout(false)
        },
        /* @__PURE__ */ React.createElement("div", { style: { fontSize: 32, marginBottom: 8 } }, "\u{1F3AD}"),
        /* @__PURE__ */ React.createElement("div", { style: { fontFamily: CHICAGO, fontSize: 13, fontWeight: "bold", marginBottom: 4 } }, "Playwright Browser"),
        /* @__PURE__ */ React.createElement("div", { style: { fontFamily: CHICAGO, fontSize: 10, color: MONO.textMuted, lineHeight: "16px" } }, "A semantic page inspector", /* @__PURE__ */ React.createElement("br", null), "built on Playwright's accessibility tree.", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("br", null), "v0.1.0 \xB7 Chromium \xB7 Go + React", /* @__PURE__ */ React.createElement("br", null), "\xA9 2026")
      )
    )
  );
}
const __artifactDefault = PlaywrightBrowser;
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(__artifactDefault));
