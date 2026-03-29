import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const CHICAGO_FONT = `"Geneva", "ChicagoFLF", "Monaco", monospace`;

// --- 1-bit style SVG icons ---
const Icons = {
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke="black" strokeWidth="2" />
      <line x1="11" y1="11" x2="15" y2="15" stroke="black" strokeWidth="2" />
    </svg>
  ),
  app: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="1" y="1" width="14" height="14" fill="black" />
      <rect x="3" y="3" width="10" height="10" fill="white" />
      <rect x="5" y="5" width="6" height="6" fill="black" />
    </svg>
  ),
  calc: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="1" y="1" width="14" height="14" stroke="black" strokeWidth="1" fill="white" />
      <rect x="3" y="3" width="10" height="3" fill="black" />
      <rect x="3" y="8" width="3" height="2" fill="black" />
      <rect x="8" y="8" width="5" height="2" fill="black" />
      <rect x="3" y="12" width="3" height="2" fill="black" />
      <rect x="8" y="12" width="5" height="2" fill="black" />
    </svg>
  ),
  folder: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d="M1 3 L1 14 L15 14 L15 5 L7 5 L6 3 Z" fill="white" stroke="black" strokeWidth="1" />
    </svg>
  ),
  globe: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" stroke="black" strokeWidth="1" fill="white" />
      <ellipse cx="8" cy="8" rx="3" ry="7" stroke="black" strokeWidth="1" fill="none" />
      <line x1="1" y1="8" x2="15" y2="8" stroke="black" strokeWidth="1" />
      <line x1="3" y1="4" x2="13" y2="4" stroke="black" strokeWidth="0.5" />
      <line x1="3" y1="12" x2="13" y2="12" stroke="black" strokeWidth="0.5" />
    </svg>
  ),
  clipboard: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="3" y="2" width="10" height="13" stroke="black" strokeWidth="1" fill="white" />
      <rect x="5" y="1" width="6" height="3" stroke="black" strokeWidth="1" fill="white" />
      <line x1="5" y1="7" x2="11" y2="7" stroke="black" strokeWidth="1" />
      <line x1="5" y1="9" x2="11" y2="9" stroke="black" strokeWidth="1" />
      <line x1="5" y1="11" x2="9" y2="11" stroke="black" strokeWidth="1" />
    </svg>
  ),
  snippet: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="2" y="1" width="12" height="14" stroke="black" strokeWidth="1" fill="white" />
      <line x1="4" y1="4" x2="12" y2="4" stroke="black" strokeWidth="1" />
      <line x1="4" y1="6" x2="10" y2="6" stroke="black" strokeWidth="1" />
      <line x1="4" y1="8" x2="12" y2="8" stroke="black" strokeWidth="1" />
      <line x1="4" y1="10" x2="8" y2="10" stroke="black" strokeWidth="1" />
    </svg>
  ),
  gear: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="3" stroke="black" strokeWidth="1.5" fill="white" />
      {[0, 45, 90, 135].map((a) => (
        <line
          key={a}
          x1={8 + 5 * Math.cos((a * Math.PI) / 180)}
          y1={8 + 5 * Math.sin((a * Math.PI) / 180)}
          x2={8 + 7 * Math.cos((a * Math.PI) / 180)}
          y2={8 + 7 * Math.sin((a * Math.PI) / 180)}
          stroke="black"
          strokeWidth="2"
        />
      ))}
      {[180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={8 + 5 * Math.cos((a * Math.PI) / 180)}
          y1={8 + 5 * Math.sin((a * Math.PI) / 180)}
          x2={8 + 7 * Math.cos((a * Math.PI) / 180)}
          y2={8 + 7 * Math.sin((a * Math.PI) / 180)}
          stroke="black"
          strokeWidth="2"
        />
      ))}
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" stroke="black" strokeWidth="1" fill="white" />
      <line x1="8" y1="8" x2="8" y2="3" stroke="black" strokeWidth="1.5" />
      <line x1="8" y1="8" x2="12" y2="8" stroke="black" strokeWidth="1" />
      <circle cx="8" cy="8" r="1" fill="black" />
    </svg>
  ),
  mac: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="3" y="1" width="10" height="11" rx="1" stroke="black" strokeWidth="1" fill="white" />
      <rect x="5" y="3" width="6" height="6" fill="black" />
      <rect x="6" y="12" width="4" height="1" fill="black" />
      <rect x="4" y="13" width="8" height="1" fill="black" />
    </svg>
  ),
  bookmark: (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d="M3 1 L13 1 L13 15 L8 11 L3 15 Z" stroke="black" strokeWidth="1" fill="white" />
    </svg>
  ),
  command: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 0.5C1.84 0.5 0.5 1.84 0.5 3.5C0.5 5.16 1.84 6.5 3.5 6.5H5V5H3.5C2.67 5 2 4.33 2 3.5C2 2.67 2.67 2 3.5 2C4.33 2 5 2.67 5 3.5V5H9V3.5C9 2.67 9.67 2 10.5 2C11.33 2 12 2.67 12 3.5C12 4.33 11.33 5 10.5 5H9V6.5H10.5C12.16 6.5 13.5 5.16 13.5 3.5C13.5 1.84 12.16 0.5 10.5 0.5C8.84 0.5 7.5 1.84 7.5 3.5V5H6.5V3.5C6.5 1.84 5.16 0.5 3.5 0.5Z" fill="black" />
      <path d="M5 9V7.5H6.5V9H5Z" fill="black" />
      <path d="M7.5 9V7.5H9V9H7.5Z" fill="black" />
      <path d="M3.5 7.5H5V9H3.5C2.67 9 2 9.67 2 10.5C2 11.33 2.67 12 3.5 12C4.33 12 5 11.33 5 10.5V9H6.5V10.5C6.5 12.16 5.16 13.5 3.5 13.5C1.84 13.5 0.5 12.16 0.5 10.5C0.5 8.84 1.84 7.5 3.5 7.5Z" fill="black" />
      <path d="M9 10.5V9H10.5C11.33 9 12 9.67 12 10.5C12 11.33 11.33 12 10.5 12C9.67 12 9 11.33 9 10.5Z" fill="black" />
      <path d="M10.5 7.5H9V9H10.5C12.16 7.5 13.5 8.84 13.5 10.5C13.5 12.16 12.16 13.5 10.5 13.5C8.84 13.5 7.5 12.16 7.5 10.5V9H9V10.5C9 11.33 9.67 12 10.5 12C11.33 12 12 11.33 12 10.5C12 9.67 11.33 9 10.5 9Z" fill="black" />
      <rect x="5" y="5" width="4" height="4" fill="black" />
    </svg>
  ),
  arrow: (
    <svg width="8" height="8" viewBox="0 0 8 8">
      <path d="M2 1 L6 4 L2 7" stroke="black" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  enter: (
    <svg width="12" height="12" viewBox="0 0 12 12">
      <path d="M10 2 L10 7 L3 7" stroke="black" strokeWidth="1.5" fill="none" />
      <path d="M5 5 L3 7 L5 9" stroke="black" strokeWidth="1.5" fill="none" />
    </svg>
  ),
};

// --- Mock Data ---
const APPS = [
  { name: "Finder", category: "app", icon: Icons.folder },
  { name: "SimpleText", category: "app", icon: Icons.snippet },
  { name: "Calculator", category: "app", icon: Icons.calc },
  { name: "System Profiler", category: "app", icon: Icons.mac },
  { name: "Scrapbook", category: "app", icon: Icons.bookmark },
  { name: "Control Panel", category: "app", icon: Icons.gear },
  { name: "Alarm Clock", category: "app", icon: Icons.clock },
  { name: "HyperCard", category: "app", icon: Icons.app },
  { name: "MacPaint", category: "app", icon: Icons.app },
  { name: "MacDraw", category: "app", icon: Icons.app },
  { name: "ResEdit", category: "app", icon: Icons.gear },
  { name: "TeachText", category: "app", icon: Icons.snippet },
];

const FILES = [
  { name: "ReadMe.txt", path: "~/Documents/", category: "file", icon: Icons.snippet },
  { name: "Budget 1991.xls", path: "~/Documents/", category: "file", icon: Icons.snippet },
  { name: "Letter to Mom", path: "~/Documents/", category: "file", icon: Icons.snippet },
  { name: "Vacation Photos", path: "~/Pictures/", category: "file", icon: Icons.folder },
  { name: "System Folder", path: "~/", category: "file", icon: Icons.folder },
  { name: "Fonts", path: "~/System Folder/", category: "file", icon: Icons.folder },
  { name: "Startup Items", path: "~/System Folder/", category: "file", icon: Icons.folder },
  { name: "My Novel Draft.txt", path: "~/Documents/", category: "file", icon: Icons.snippet },
];

const BOOKMARKS = [
  { name: "Apple Computer", url: "apple.com", category: "bookmark", icon: Icons.globe },
  { name: "MacWorld Online", url: "macworld.com", category: "bookmark", icon: Icons.globe },
  { name: "Info-Mac Archive", url: "info-mac.org", category: "bookmark", icon: Icons.globe },
  { name: "TidBITS", url: "tidbits.com", category: "bookmark", icon: Icons.globe },
];

const CLIPBOARD_HISTORY = [
  { name: '"Hello, World!"', time: "2 min ago", category: "clipboard", icon: Icons.clipboard },
  { name: "192.168.1.1", time: "5 min ago", category: "clipboard", icon: Icons.clipboard },
  { name: '"Meeting at 3pm"', time: "12 min ago", category: "clipboard", icon: Icons.clipboard },
  { name: "file:///Macintosh HD/...", time: "1 hr ago", category: "clipboard", icon: Icons.clipboard },
];

const SNIPPETS = [
  { name: "Email Signature", preview: "Best regards, ...", category: "snippet", icon: Icons.snippet },
  { name: "Lorem Ipsum", preview: "Lorem ipsum dolor...", category: "snippet", icon: Icons.snippet },
  { name: "Shrug ¯\\_(ツ)_/¯", preview: "¯\\_(ツ)_/¯", category: "snippet", icon: Icons.snippet },
  { name: "Phone Number", preview: "(555) 867-5309", category: "snippet", icon: Icons.snippet },
];

const SYSTEM_COMMANDS = [
  { name: "Empty Trash", category: "system", icon: Icons.gear, action: "empty-trash" },
  { name: "Restart", category: "system", icon: Icons.mac, action: "restart" },
  { name: "Shut Down", category: "system", icon: Icons.mac, action: "shutdown" },
  { name: "Sleep", category: "system", icon: Icons.clock, action: "sleep" },
  { name: "Lock Screen", category: "system", icon: Icons.mac, action: "lock" },
  { name: "Show Desktop", category: "system", icon: Icons.mac, action: "desktop" },
  { name: "About This Macintosh", category: "system", icon: Icons.mac, action: "about" },
];

const ALL_ITEMS = [...APPS, ...FILES, ...BOOKMARKS, ...CLIPBOARD_HISTORY, ...SNIPPETS, ...SYSTEM_COMMANDS];

const CATEGORY_LABELS = {
  app: "Applications",
  file: "Files & Folders",
  bookmark: "Bookmarks",
  clipboard: "Clipboard History",
  snippet: "Snippets",
  system: "System",
  calc: "Calculator",
  web: "Web Search",
};

// --- Dither pattern as inline SVG data URI ---
const ditherBg = `url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='black'/%3E%3Crect x='2' y='2' width='1' height='1' fill='black'/%3E%3C/svg%3E")`;

// --- Evaluate simple math ---
function tryMath(expr) {
  try {
    const sanitized = expr.replace(/[^0-9+\-*/().%^ ]/g, "");
    if (!sanitized.trim() || !/\d/.test(sanitized)) return null;
    if (!/[+\-*/^%]/.test(sanitized)) return null;
    const result = Function(`"use strict"; return (${sanitized.replace(/\^/g, "**")})`)();
    if (typeof result === "number" && isFinite(result)) return result;
  } catch {}
  return null;
}

// --- Styles ---
const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: ditherBg,
    backgroundSize: "4px 4px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 80,
    fontFamily: CHICAGO_FONT,
    fontSize: 12,
    zIndex: 9999,
    imageRendering: "pixelated",
  },
  window: {
    width: 540,
    background: "white",
    border: "2px solid black",
    boxShadow: "4px 4px 0px black",
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100vh - 140px)",
  },
  titleBar: {
    height: 22,
    background: "white",
    borderBottom: "2px solid black",
    display: "flex",
    alignItems: "center",
    padding: "0 6px",
    gap: 8,
    cursor: "default",
    userSelect: "none",
    flexShrink: 0,
  },
  closeBox: {
    width: 13,
    height: 13,
    border: "1px solid black",
    background: "white",
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  titleLines: {
    flex: 1,
    height: 12,
    background: `repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 1px,
      black 1px,
      black 2px,
      transparent 2px,
      transparent 3px
    )`,
  },
  titleText: {
    fontFamily: CHICAGO_FONT,
    fontSize: 11,
    fontWeight: "bold",
    padding: "0 8px",
    background: "white",
    whiteSpace: "nowrap",
  },
  searchArea: {
    padding: "10px 12px 8px",
    borderBottom: "1px solid black",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontFamily: CHICAGO_FONT,
    fontSize: 14,
    border: "none",
    outline: "none",
    background: "transparent",
    letterSpacing: 0.5,
  },
  modeBar: {
    display: "flex",
    borderBottom: "1px solid black",
    background: "white",
    flexShrink: 0,
    overflowX: "auto",
  },
  modeTab: (active) => ({
    padding: "5px 10px",
    fontFamily: CHICAGO_FONT,
    fontSize: 10,
    cursor: "pointer",
    background: active ? "black" : "white",
    color: active ? "white" : "black",
    border: "none",
    borderRight: "1px solid black",
    whiteSpace: "nowrap",
    userSelect: "none",
    letterSpacing: 0.3,
  }),
  results: {
    flex: 1,
    overflowY: "auto",
    minHeight: 100,
  },
  sectionLabel: {
    fontFamily: CHICAGO_FONT,
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    padding: "8px 12px 3px",
    color: "black",
    borderBottom: "1px dotted black",
    userSelect: "none",
  },
  resultItem: (selected) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    cursor: "pointer",
    background: selected ? "black" : "white",
    color: selected ? "white" : "black",
    userSelect: "none",
  }),
  resultIcon: (selected) => ({
    width: 20,
    height: 20,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    filter: selected ? "invert(1)" : "none",
  }),
  resultName: {
    flex: 1,
    fontFamily: CHICAGO_FONT,
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  resultMeta: (selected) => ({
    fontFamily: CHICAGO_FONT,
    fontSize: 10,
    color: selected ? "#ccc" : "#666",
    whiteSpace: "nowrap",
  }),
  statusBar: {
    height: 20,
    borderTop: "2px solid black",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 10px",
    fontFamily: CHICAGO_FONT,
    fontSize: 9,
    background: "white",
    flexShrink: 0,
    userSelect: "none",
  },
  calcDisplay: {
    fontFamily: CHICAGO_FONT,
    fontSize: 24,
    textAlign: "right",
    padding: "12px 16px",
    borderBottom: "2px solid black",
    background: "white",
    letterSpacing: 1,
  },
  kbd: {
    fontFamily: CHICAGO_FONT,
    fontSize: 9,
    border: "1px solid black",
    borderRadius: 2,
    padding: "1px 4px",
    background: "white",
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    lineHeight: 1,
  },
  actionHint: (selected) => ({
    display: "flex",
    alignItems: "center",
    gap: 3,
    filter: selected ? "invert(1)" : "none",
  }),
  emptyState: {
    padding: "30px 20px",
    textAlign: "center",
    fontFamily: CHICAGO_FONT,
    fontSize: 11,
    color: "#666",
  },
};

// --- Components ---
function RetroLauncher() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState("all");
  const [toast, setToast] = useState(null);
  const [visible, setVisible] = useState(true);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const itemRefs = useRef({});

  const mathResult = useMemo(() => tryMath(query), [query]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let items = ALL_ITEMS;
    if (mode !== "all") {
      items = items.filter((i) => i.category === mode);
    }
    if (q) {
      items = items.filter((i) => i.name.toLowerCase().includes(q) || (i.path && i.path.toLowerCase().includes(q)) || (i.url && i.url.toLowerCase().includes(q)));
    }

    const results = [];

    if (mathResult !== null) {
      results.push({
        name: `${query.trim()} = ${mathResult}`,
        category: "calc",
        icon: Icons.calc,
        _isCalc: true,
      });
    }

    if (q && q.length > 1) {
      results.push({
        name: `Search web for "${query.trim()}"`,
        category: "web",
        icon: Icons.globe,
        _isWeb: true,
      });
    }

    // Group by category
    const grouped = {};
    items.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    const order = ["app", "file", "bookmark", "clipboard", "snippet", "system"];
    order.forEach((cat) => {
      if (grouped[cat]) results.push(...grouped[cat]);
    });

    return results;
  }, [query, mode, mathResult]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, mode]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [visible]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleAction = useCallback(
    (item) => {
      if (!item) return;
      if (item._isCalc) {
        navigator.clipboard?.writeText(String(mathResult));
        showToast(`Copied "${mathResult}" to clipboard`);
      } else if (item._isWeb) {
        showToast(`Searching the web...`);
      } else if (item.category === "clipboard" || item.category === "snippet") {
        showToast(`Pasted: ${item.preview || item.name}`);
      } else if (item.category === "system") {
        showToast(`Executing: ${item.name}`);
      } else if (item.category === "bookmark") {
        showToast(`Opening: ${item.url}`);
      } else {
        showToast(`Launching: ${item.name}`);
      }
    },
    [mathResult, showToast]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleAction(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        if (query) setQuery("");
        else setVisible(false);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const modes = ["all", "app", "file", "bookmark", "clipboard", "snippet", "system"];
        const idx = modes.indexOf(mode);
        setMode(modes[(idx + 1) % modes.length]);
      }
    },
    [filtered, selectedIndex, handleAction, query, mode]
  );

  // Group results for display
  const groupedResults = useMemo(() => {
    const groups = [];
    let lastCat = null;
    let globalIdx = 0;
    filtered.forEach((item) => {
      if (item.category !== lastCat) {
        groups.push({ type: "label", label: CATEGORY_LABELS[item.category] || item.category });
        lastCat = item.category;
      }
      groups.push({ type: "item", item, globalIdx });
      globalIdx++;
    });
    return groups;
  }, [filtered]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!visible) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          fontFamily: CHICAGO_FONT,
          cursor: "pointer",
        }}
        onClick={() => setVisible(true)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, border: "2px solid black", padding: "10px 20px", boxShadow: "3px 3px 0 black" }}>
          <span style={{ display: "flex" }}>{Icons.command}</span>
          <span>Space</span>
        </div>
        <div style={{ fontSize: 11, color: "#666" }}>Click or press ⌘Space to open Launcher</div>
      </div>
    );
  }

  return (
    <div style={S.overlay} onClick={() => setVisible(false)}>
      {/* Menu Bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 22,
          background: "white",
          borderBottom: "2px solid black",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          fontFamily: CHICAGO_FONT,
          fontSize: 12,
          fontWeight: "bold",
          zIndex: 10000,
          gap: 16,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>&#63743;</span>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Special</span>
        <span style={{ marginLeft: "auto", fontWeight: "normal", fontSize: 11 }}>{timeStr}</span>
      </div>

      {/* Window */}
      <div style={S.window} onClick={(e) => e.stopPropagation()}>
        {/* Title Bar */}
        <div style={S.titleBar}>
          <div style={S.closeBox} onClick={() => setVisible(false)}>
            <svg width="7" height="7" viewBox="0 0 7 7"><rect width="7" height="7" fill="white" /></svg>
          </div>
          <div style={S.titleLines} />
          <span style={S.titleText}>✦ Launcher</span>
          <div style={S.titleLines} />
        </div>

        {/* Search */}
        <div style={S.searchArea}>
          <div style={{ display: "flex", flexShrink: 0 }}>{Icons.search}</div>
          <input ref={inputRef} style={S.searchInput} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search apps, files, actions…" spellCheck={false} autoFocus />
          {query && (
            <div
              style={{ cursor: "pointer", fontFamily: CHICAGO_FONT, fontSize: 10, border: "1px solid black", padding: "1px 5px", background: "white" }}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              Clear
            </div>
          )}
        </div>

        {/* Mode Tabs */}
        <div style={S.modeBar}>
          {[
            ["all", "All"],
            ["app", "Apps"],
            ["file", "Files"],
            ["bookmark", "Web"],
            ["clipboard", "Clipboard"],
            ["snippet", "Snippets"],
            ["system", "System"],
          ].map(([key, label]) => (
            <button key={key} style={S.modeTab(mode === key)} onClick={() => setMode(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div style={S.results} ref={resultsRef}>
          {groupedResults.length === 0 && !query && (
            <div style={S.emptyState}>
              <div style={{ marginBottom: 10, fontSize: 24 }}>✦</div>
              <div>Type to search applications, files,</div>
              <div>bookmarks, snippets & more.</div>
              <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <span style={S.kbd}>↑↓ Navigate</span>
                <span style={S.kbd}>⏎ Open</span>
                <span style={S.kbd}>Tab Modes</span>
                <span style={S.kbd}>Esc Close</span>
              </div>
            </div>
          )}
          {groupedResults.length === 0 && query && (
            <div style={S.emptyState}>
              <div style={{ marginBottom: 6 }}>No results for "{query}"</div>
              <div style={{ fontSize: 10, color: "#999" }}>Try a different search term</div>
            </div>
          )}
          {groupedResults.map((entry, i) => {
            if (entry.type === "label") {
              return (
                <div key={`label-${i}`} style={S.sectionLabel}>
                  {entry.label}
                </div>
              );
            }
            const { item, globalIdx } = entry;
            const sel = globalIdx === selectedIndex;
            return (
              <div
                key={`item-${globalIdx}`}
                ref={(el) => (itemRefs.current[globalIdx] = el)}
                style={S.resultItem(sel)}
                onClick={() => handleAction(item)}
                onMouseEnter={() => setSelectedIndex(globalIdx)}
              >
                <div style={S.resultIcon(sel)}>{item.icon}</div>
                <div style={S.resultName}>{item.name}</div>
                {item.path && <div style={S.resultMeta(sel)}>{item.path}</div>}
                {item.url && <div style={S.resultMeta(sel)}>{item.url}</div>}
                {item.time && <div style={S.resultMeta(sel)}>{item.time}</div>}
                {item.preview && <div style={S.resultMeta(sel)}>{item.preview}</div>}
                {sel && (
                  <div style={S.actionHint(sel)}>
                    <div style={{ display: "flex" }}>{Icons.enter}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Status Bar */}
        <div style={S.statusBar}>
          <span>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={S.kbd}>
              <span style={{ fontSize: 8 }}>⌘</span>Space
            </span>
            <span style={S.kbd}>Tab</span>
            <span style={S.kbd}>↑↓</span>
            <span style={S.kbd}>⏎</span>
            <span style={S.kbd}>Esc</span>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            background: "black",
            color: "white",
            fontFamily: CHICAGO_FONT,
            fontSize: 11,
            padding: "8px 16px",
            border: "2px solid white",
            boxShadow: "3px 3px 0 black",
            zIndex: 10001,
            animation: "fadeIn 0.15s ease",
          }}
        >
          {toast}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        ::-webkit-scrollbar { width: 14px; }
        ::-webkit-scrollbar-track { background: white; border-left: 1px solid black; }
        ::-webkit-scrollbar-thumb {
          background: white;
          border: 1px solid black;
          background-image: url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='black'/%3E%3Crect x='2' y='2' width='1' height='1' fill='black'/%3E%3C/svg%3E");
          background-size: 4px 4px;
        }
        ::-webkit-scrollbar-button:vertical:start:decrement,
        ::-webkit-scrollbar-button:vertical:end:increment {
          height: 14px;
          background: white;
          border: 1px solid black;
          display: block;
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

export default RetroLauncher;
