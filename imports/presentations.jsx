import { useState, useContext, createContext, useCallback, useRef, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// TYPE SYSTEM
// A small lattice: typeSatisfies(candidate, required) walks up
// ═══════════════════════════════════════════════════════════════

const TYPE_HIERARCHY = {
  "night-student": ["student"],
  "student":       ["person"],
  "employee":      ["person"],
  "person":        ["t"],
  "directory":     ["pathname"],
  "pathname":      ["t"],
  "integer":       ["number"],
  "float":         ["number"],
  "number":        ["t"],
  "t":             [],
};

function typeSatisfies(candidate, required) {
  if (!required || required === null) return false;
  if (candidate === required || required === "t") return true;
  const supers = TYPE_HIERARCHY[candidate] ?? [];
  return supers.some(s => typeSatisfies(s, required));
}

// ═══════════════════════════════════════════════════════════════
// TRANSLATOR REGISTRY
// fromType → toType via a function; subtype-aware matching
// ═══════════════════════════════════════════════════════════════

const TRANSLATORS = [];

function defTranslator(fromType, toType, label, fn) {
  TRANSLATORS.push({ fromType, toType, label, fn });
}

function findTranslator(fromType, toType) {
  return TRANSLATORS.find(t =>
    typeSatisfies(fromType, t.fromType) &&
    typeSatisfies(t.toType, toType)
  ) ?? null;
}

// Built-in translators
defTranslator("person",   "person",   "Select",            x => x);
defTranslator("pathname", "pathname", "Select",            x => x);
defTranslator("directory","pathname", "Use as pathname",   x => x);
defTranslator("integer",  "number",   "Use as number",     x => x);
defTranslator("float",    "number",   "Use as number",     x => x);

// ═══════════════════════════════════════════════════════════════
// INPUT CONTEXT — broadcast from active command to all Presents
// ═══════════════════════════════════════════════════════════════

const InputCtx = createContext({
  activeType:    null,
  onPresent:     null,
  commandLabel:  null,
  prompt:        null,
});

// ═══════════════════════════════════════════════════════════════
// <Present>  THE CORE PRIMITIVE
// Wraps output; becomes sensitive when a compatible command waits
// ═══════════════════════════════════════════════════════════════

function Present({ object, type, children }) {
  const { activeType, onPresent } = useContext(InputCtx);
  const [hover, setHover] = useState(false);

  const sensitive  = !!(activeType && typeSatisfies(type, activeType));
  const translator = sensitive ? findTranslator(type, activeType) : null;

  const handleClick = () => {
    if (!sensitive || !onPresent) return;
    const resolved = translator ? translator.fn(object) : object;
    onPresent(resolved, type);
  };

  return (
    <span
      className={`pres${sensitive ? " pres-sensitive" : ""}${hover && sensitive ? " pres-hover" : ""}`}
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-ptype={type}
    >
      {children}
      {hover && sensitive && (
        <span className="pres-badge">{type}</span>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// useCommand  HOOK
// Collects N typed args in sequence, then fires commandFn
// ═══════════════════════════════════════════════════════════════

function useCommand(label, argSpecs, commandFn) {
  const [st, setSt] = useState({ active: false, idx: 0, args: [] });
  const cmdFnRef = useRef(commandFn);
  cmdFnRef.current = commandFn;

  const onPresent = useCallback((object) => {
    setSt(prev => {
      const args = [...prev.args, object];
      if (args.length >= argSpecs.length) {
        setTimeout(() => cmdFnRef.current(...args), 0);
        return { active: false, idx: 0, args: [] };
      }
      return { ...prev, idx: prev.idx + 1, args };
    });
  }, [argSpecs.length]);

  const invoke = () => setSt({ active: true, idx: 0, args: [] });
  const cancel = () => setSt({ active: false, idx: 0, args: [] });

  const spec = st.active ? argSpecs[st.idx] : null;

  return {
    invoke, cancel,
    isActive: st.active,
    collectedCount: st.args.length,
    inputCtx: st.active
      ? { activeType: spec?.type, onPresent, commandLabel: label, prompt: spec?.prompt }
      : { activeType: null, onPresent: null, commandLabel: null, prompt: null },
  };
}

// ═══════════════════════════════════════════════════════════════
// SAMPLE DOMAIN DATA
// ═══════════════════════════════════════════════════════════════

const PEOPLE = [
  { id:1, ptype:"person",       name:"Ada Lovelace",   email:"ada@engine.io",        dept:"Mathematics",   age:36 },
  { id:2, ptype:"employee",     name:"Alan Turing",    email:"turing@bletchley.uk",  dept:"Cryptanalysis", age:41 },
  { id:3, ptype:"student",      name:"Grace Hopper",   email:"grace@yale.edu",       dept:"Comp. Sci.",    age:26 },
  { id:4, ptype:"night-student",name:"John McCarthy",  email:"jmc@mit.edu",          dept:"AI Lab",        age:24 },
  { id:5, ptype:"employee",     name:"Marvin Minsky",  email:"minsky@mit.edu",       dept:"AI Lab",        age:29 },
];

const FILES = [
  { path:"/home/ada/notes.lisp",         size:"4.2K",  mtime:"1843-10-12" },
  { path:"/usr/local/lisp/core.lisp",    size:"128K",  mtime:"1958-01-01" },
  { path:"/etc/genera/site-init.lisp",   size:"2.1K",  mtime:"1987-03-22" },
  { path:"/home/turing/enigma.pl",       size:"16K",   mtime:"1943-06-07" },
];

const NUMBERS = [42, 1984, 6502, 65536];

// ═══════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const outputRef = useRef(null);
  const [log, setLog] = useState([
    { id:0, kind:"sys", text:"Presentation prototype loaded.\nInvoke a command, then click a highlighted object." }
  ]);
  const nextId = useRef(1);
  const emit = (text, kind="res") =>
    setLog(prev => [...prev, { id: nextId.current++, kind, text }]);

  // ── COMMANDS ────────────────────────────────────────────────

  const cmdInspect = useCommand(
    "Inspect Person",
    [{ type:"person", prompt:"click a person to inspect" }],
    (p) => emit(
`Inspect ${p.name.toUpperCase()}
  type:   ${p.ptype}
  email:  ${p.email}
  dept:   ${p.dept}
  age:    ${p.age}`, "res")
  );

  const cmdEmail = useCommand(
    "Compose Email",
    [{ type:"person", prompt:"click recipient" }],
    (p) => emit(`Compose-Email  To: <${p.email}>\n  Draft created for ${p.name}.`, "res")
  );

  const cmdCompare = useCommand(
    "Compare Persons",
    [
      { type:"person", prompt:"click first person" },
      { type:"person", prompt:"click second person" },
    ],
    (a, b) => emit(
`Compare ${a.name} ↔ ${b.name}
  age delta:  ${Math.abs(a.age - b.age)} years
  same dept:  ${a.dept === b.dept ? "yes ✓" : "no"}
  types:      ${a.ptype} / ${b.ptype}`, "res")
  );

  const cmdDelete = useCommand(
    "Delete File",
    [{ type:"pathname", prompt:"click file to delete" }],
    (f) => emit(`Delete ${f.path}\n  ; destructive operation\n  Removed.`, "warn")
  );

  const cmdCopy = useCommand(
    "Copy File",
    [{ type:"pathname", prompt:"click source file" }],
    (f) => emit(`Copy ${f.path}\n  → ${f.path}.bak\n  Done.`, "res")
  );

  const allCmds = [cmdInspect, cmdEmail, cmdCompare, cmdDelete, cmdCopy];
  const activeCmd = allCmds.find(c => c.isActive) ?? null;
  const globalCtx = activeCmd?.inputCtx ?? { activeType:null, onPresent:null, commandLabel:null, prompt:null };

  const invokeCmd = (cmd) => {
    allCmds.forEach(c => c.cancel());
    cmd.invoke();
  };

  // scroll listener to bottom
  useEffect(() => {
    if (outputRef.current)
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [log]);

  const CMDS = [
    { cmd:cmdInspect, label:"Inspect Person",    badge:"person" },
    { cmd:cmdEmail,   label:"Compose Email",     badge:"person" },
    { cmd:cmdCompare, label:"Compare Persons ×2",badge:"person×2" },
    { cmd:cmdDelete,  label:"Delete File",       badge:"pathname" },
    { cmd:cmdCopy,    label:"Copy File",         badge:"pathname" },
  ];

  return (
    <>
      <style>{CSS}</style>
      <InputCtx.Provider value={globalCtx}>
        <div className="app">

          {/* TOP STATUS BAR */}
          <header className="topbar">
            <span className="topbar-title">⊕ CLIM PRESENTATIONS — PROTOTYPE</span>
            {activeCmd
              ? <span className="topbar-status accepting">
                  <span className="dot pulse" />
                  <strong>{globalCtx.commandLabel}</strong>
                  <span className="sep">›</span>
                  {globalCtx.prompt}
                  {cmdCompare.isActive && cmdCompare.collectedCount === 1
                    && <span className="collected"> (1 collected)</span>}
                  <button className="cancel-x" onClick={() => allCmds.forEach(c => c.cancel())}>✕</button>
                </span>
              : <span className="topbar-status idle">Idle — invoke a command to activate input context</span>
            }
          </header>

          <div className="body">

            {/* ── LEFT: COMMAND TABLE ── */}
            <aside className="sidebar">
              <div className="sidebar-section-head">Command Table</div>
              <div className="cmd-list">
                {CMDS.map(({ cmd, label, badge }) => (
                  <button
                    key={label}
                    className={`cmd${cmd.isActive ? " cmd-on" : ""}`}
                    onClick={() => invokeCmd(cmd)}
                  >
                    <span className="cmd-name">{label}</span>
                    <span className="cmd-badge">{badge}</span>
                  </button>
                ))}
              </div>

              <div className="sidebar-section-head" style={{marginTop:28}}>Type Lattice</div>
              <pre className="type-tree">{`t
├─ person
│  ├─ employee
│  └─ student
│     └─ night-student
├─ pathname
│  └─ directory
└─ number
   ├─ integer
   └─ float`}</pre>
              <p className="tree-note">
                Subtype matching is automatic.<br/>
                A <em>night-student</em> satisfies<br/>
                <em>student</em>, <em>person</em>, or <em>t</em>.
              </p>
            </aside>

            {/* ── CENTER: OUTPUT PANE ── */}
            <main className="output-pane">
              <div className="pane-head">Output Pane</div>

              <section className="out-section">
                <div className="out-section-label">People</div>
                <table className="out-table">
                  <tbody>
                    {PEOPLE.map(p => (
                      <tr key={p.id} className="out-row">
                        <td className="out-typetag">[{p.ptype}]</td>
                        <td className="out-cell">
                          <Present object={p} type={p.ptype}>
                            <span className="val-person">{p.name}</span>
                          </Present>
                        </td>
                        <td className="out-meta">{p.dept}</td>
                        <td className="out-meta right">{p.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="out-section">
                <div className="out-section-label">Filesystem</div>
                <table className="out-table">
                  <tbody>
                    {FILES.map(f => (
                      <tr key={f.path} className="out-row">
                        <td className="out-typetag">[pathname]</td>
                        <td className="out-cell">
                          <Present object={f} type="pathname">
                            <span className="val-path">{f.path}</span>
                          </Present>
                        </td>
                        <td className="out-meta right">{f.size}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="out-section">
                <div className="out-section-label">Numbers</div>
                <div className="number-row">
                  {NUMBERS.map(n => (
                    <Present key={n} object={n} type="integer">
                      <span className="val-number">{n}</span>
                    </Present>
                  ))}
                </div>
              </section>

              <div className="pane-hint">
                All output above is live — objects remain clickable<br/>
                whenever a command is waiting for a compatible type.
              </div>
            </main>

            {/* ── RIGHT: LISTENER ── */}
            <aside className="listener">
              <div className="pane-head">
                Listener
                <button className="clear-btn" onClick={() => setLog([])}>clear</button>
              </div>
              <div className="listener-scroll" ref={outputRef}>
                {log.map(entry => (
                  <div key={entry.id} className={`log log-${entry.kind}`}>
                    <span className="log-arrow">
                      {entry.kind === "res"  && "⇒ "}
                      {entry.kind === "warn" && "⚠ "}
                      {entry.kind === "sys"  && "· "}
                    </span>
                    <span className="log-text">{entry.text}</span>
                  </div>
                ))}
              </div>
            </aside>

          </div>
        </div>
      </InputCtx.Provider>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES — Symbolics Lisp Machine amber-phosphor aesthetic
// ═══════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inconsolata:wdth,wght@100,300..900&family=Share+Tech+Mono&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0d0d0b;
    --bg2:       #131310;
    --bg3:       #1a1a15;
    --border:    #2e2e22;
    --amber:     #ffb347;
    --amber-dim: #a87030;
    --amber-glow:#ffd080;
    --green:     #7ec850;
    --cyan:      #5bc8c0;
    --red:       #e05050;
    --muted:     #5a5a45;
    --text:      #d4c89a;
    --text-dim:  #7a7058;
    --sensitive: #ffe090;
    --sens-bg:   rgba(255,180,60,0.10);
    --sens-hover-bg: rgba(255,180,60,0.22);
    --font-mono: 'Share Tech Mono', 'Inconsolata', monospace;
  }

  html, body, #root { height: 100%; background: var(--bg); color: var(--text); }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    background: var(--bg);
  }

  /* ── TOPBAR ── */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 18px;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    gap: 12px;
    flex-shrink: 0;
  }
  .topbar-title {
    color: var(--amber);
    letter-spacing: 0.12em;
    font-size: 11px;
    white-space: nowrap;
  }
  .topbar-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .topbar-status.idle { color: var(--muted); }
  .topbar-status.accepting { color: var(--amber-glow); }
  .topbar-status.accepting strong { color: var(--amber); }
  .dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--amber);
    flex-shrink: 0;
  }
  .dot.pulse { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse {
    0%,100% { opacity:1; box-shadow: 0 0 4px var(--amber); }
    50%      { opacity:.4; box-shadow: none; }
  }
  .sep { color: var(--amber-dim); }
  .collected { color: var(--green); font-size: 11px; }
  .cancel-x {
    background: none; border: 1px solid var(--border);
    color: var(--muted); cursor: pointer; padding: 1px 7px;
    font-family: var(--font-mono); font-size: 11px;
    border-radius: 2px; margin-left: 4px;
    transition: color .15s, border-color .15s;
  }
  .cancel-x:hover { color: var(--red); border-color: var(--red); }

  /* ── BODY ── */
  .body {
    display: grid;
    grid-template-columns: 220px 1fr 280px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    background: var(--bg2);
    border-right: 1px solid var(--border);
    padding: 16px 14px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sidebar-section-head {
    font-size: 10px;
    letter-spacing: 0.15em;
    color: var(--amber-dim);
    text-transform: uppercase;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 6px;
  }
  .cmd-list { display: flex; flex-direction: column; gap: 4px; }
  .cmd {
    background: var(--bg3);
    border: 1px solid var(--border);
    color: var(--text);
    cursor: pointer;
    padding: 7px 10px;
    text-align: left;
    font-family: var(--font-mono);
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: border-color .15s, background .15s;
    border-radius: 2px;
  }
  .cmd:hover { background: #1f1f18; border-color: var(--amber-dim); }
  .cmd.cmd-on {
    background: rgba(255,179,71,.08);
    border-color: var(--amber);
    color: var(--amber-glow);
  }
  .cmd-name { font-size: 12px; }
  .cmd-badge {
    font-size: 10px;
    color: var(--muted);
    letter-spacing: .05em;
  }
  .cmd.cmd-on .cmd-badge { color: var(--amber-dim); }

  .type-tree {
    font-size: 11px;
    color: var(--cyan);
    line-height: 1.7;
    background: var(--bg3);
    border: 1px solid var(--border);
    padding: 10px 12px;
    border-radius: 2px;
  }
  .tree-note {
    font-size: 10.5px;
    color: var(--text-dim);
    line-height: 1.6;
    padding: 6px 0;
  }
  .tree-note em { color: var(--cyan); font-style: normal; }

  /* ── OUTPUT PANE ── */
  .output-pane {
    padding: 16px 20px;
    overflow-y: auto;
    background: var(--bg);
  }
  .pane-head {
    font-size: 10px;
    letter-spacing: 0.15em;
    color: var(--amber-dim);
    text-transform: uppercase;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .out-section { margin-bottom: 20px; }
  .out-section-label {
    font-size: 10px;
    color: var(--muted);
    letter-spacing: .08em;
    margin-bottom: 6px;
  }
  .out-table { width: 100%; border-collapse: collapse; }
  .out-row { border-bottom: 1px solid #1a1a15; }
  .out-row:last-child { border-bottom: none; }
  .out-typetag {
    color: var(--muted);
    font-size: 10px;
    padding: 4px 10px 4px 0;
    white-space: nowrap;
    vertical-align: middle;
    width: 1%;
  }
  .out-cell { padding: 4px 12px 4px 0; vertical-align: middle; }
  .out-meta  { padding: 4px 0; color: var(--text-dim); font-size: 11px; vertical-align: middle; }
  .out-meta.right { text-align: right; }

  .val-person { color: var(--amber-glow); }
  .val-path   { color: var(--green); font-size: 12px; }
  .val-number {
    display: inline-block;
    color: var(--cyan);
    margin-right: 14px;
    font-size: 15px;
  }
  .number-row { display: flex; gap: 6px; flex-wrap: wrap; padding: 6px 0; }

  .pane-hint {
    font-size: 10.5px;
    color: var(--text-dim);
    border-top: 1px solid var(--border);
    padding-top: 12px;
    margin-top: 8px;
    line-height: 1.7;
  }

  /* ── PRESENTATION SENSITIVITY ── */
  .pres {
    position: relative;
    display: inline;
    border-radius: 2px;
    transition: background .1s;
  }
  .pres-sensitive {
    background: var(--sens-bg);
    outline: 1px solid rgba(255,179,71,0.3);
    outline-offset: 1px;
    animation: sensitize .25s ease-out;
  }
  @keyframes sensitize {
    from { background: rgba(255,180,60,0.25); }
    to   { background: var(--sens-bg); }
  }
  .pres-hover {
    background: var(--sens-hover-bg) !important;
    outline-color: var(--amber) !important;
    cursor: pointer;
  }
  .pres-badge {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--amber);
    color: #0d0d0b;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 2px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 100;
    font-weight: bold;
    letter-spacing: .05em;
  }

  /* ── LISTENER ── */
  .listener {
    background: var(--bg2);
    border-left: 1px solid var(--border);
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
    font-family: var(--font-mono);
    font-size: 10px;
    border-radius: 2px;
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
  .log-arrow { flex-shrink: 0; }
  .log-text   { white-space: pre; font-size: 12px; line-height: 1.7; }
  .log-res  .log-arrow { color: var(--amber); }
  .log-res  .log-text  { color: var(--text); }
  .log-warn .log-arrow { color: var(--red); }
  .log-warn .log-text  { color: #c08060; }
  .log-sys  .log-arrow { color: var(--muted); }
  .log-sys  .log-text  { color: var(--text-dim); }

  /* scrollbars */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg2); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
`;
