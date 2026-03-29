import { useState, useEffect, useRef, useCallback } from "react";

/* ───────── DEMO DATA ───────── */
const DEMO_TEXT = [
  "Writing well is mostly about rewriting. The first draft exists to get ideas out of your head and onto the page, where you can actually look at them. Most writers will tell you their first drafts are terrible, which is both reassuring and true.",
  "The hard part comes after. Editing requires a different mindset than writing — you need to be willing to cut sentences you're proud of, rearrange paragraphs that felt natural when you wrote them, and admit that your clever metaphor doesn't actually work. It's surgery, not painting.",
  "Good editors read slowly. They notice when a sentence makes them pause or reread. They ask whether each word earns its place. They're suspicious of adverbs and watch for repeated phrases. Most importantly, they remember that clarity is more valuable than cleverness."
];

const INITIAL_ANNOTATIONS = [
  { id: 1, type: "rephrase", original: "mostly about rewriting", suggestions: [
    { text: "really just rewriting", rationale: "More direct and conversational." },
    { text: "an exercise in rewriting", rationale: "Slightly more formal, frames it as a discipline." }
  ], activeSuggestion: null },
  { id: 2, type: "clarity", original: "where you can actually look at them", suggestions: [
    { text: "where you can examine them properly", rationale: "'Look at' is vague — 'examine' implies critical attention." },
    { text: "where they become visible to your critical eye", rationale: "More vivid, makes the shift in perspective explicit." },
    { text: "where you can see what you actually think", rationale: "Gets at the deeper point — writing reveals thought." }
  ], activeSuggestion: null },
  { id: 3, type: "cut", original: "which is both reassuring and true", suggestions: [
    { text: "which is reassuring", rationale: "If it's reassuring, calling it 'true' is redundant." }
  ], activeSuggestion: null },
  { id: 4, type: "rephrase", original: "It's surgery, not painting", suggestions: [
    { text: "It's demolition, not decoration", rationale: "Stronger contrast — editing often means tearing things apart." },
    { text: "It's triage, not painting", rationale: "Keeps the medical metaphor but emphasizes prioritization." }
  ], activeSuggestion: null },
  { id: 5, type: "note", original: "clarity is more valuable than cleverness", suggestions: [
    { text: "clarity is more valuable than cleverness", rationale: "This is great. Don't touch it — it's the thesis of the whole piece." }
  ], activeSuggestion: null },
  { id: 6, type: "rephrase", original: "They're suspicious of adverbs", suggestions: [
    { text: "They distrust adverbs", rationale: "More active and punchy." },
    { text: "They hunt adverbs", rationale: "Playful, gives the editor more agency." }
  ], activeSuggestion: null }
];

const TYPE_CONFIG = {
  rephrase: { label: "Rephrase", pattern: "░░" },
  clarity:  { label: "Clarity",  pattern: "▓▓" },
  note:     { label: "Note",     pattern: "══" },
  cut:      { label: "Cut",      pattern: "╳╳" }
};

/* ───────── TEXT SEGMENT BUILDER ───────── */
function buildSegments(text, anns) {
  const matches = [];
  for (const ann of anns) {
    const idx = text.indexOf(ann.original);
    if (idx !== -1) matches.push({ start: idx, end: idx + ann.original.length, ann });
  }
  matches.sort((a, b) => a.start - b.start);
  const segs = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start > pos) segs.push({ text: text.slice(pos, m.start) });
    const display = m.ann.activeSuggestion !== null
      ? m.ann.suggestions[m.ann.activeSuggestion].text : m.ann.original;
    segs.push({ text: display, ann: m.ann, replaced: m.ann.activeSuggestion !== null });
    pos = m.end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) });
  return segs;
}

/* ───────── MAC WINDOW (stable, outside component) ───────── */
function MacWindow({ title, x, y, w, h, z, onClose, onFocus, onDragStart, onResizeStart, children }) {
  return (
    <div
      onMouseDown={onFocus}
      style={{
        position: "absolute", left: x, top: y, width: w, height: h, zIndex: z,
        display: "flex", flexDirection: "column",
        border: "2px solid #000", boxShadow: "3px 3px 0 #000",
        background: "#fff",
      }}
    >
      <div
        onMouseDown={onDragStart}
        style={{
          height: 22, display: "flex", alignItems: "center",
          background: "repeating-linear-gradient(180deg, #fff 0px, #fff 1px, #000 1px, #000 2px)",
          borderBottom: "2px solid #000", cursor: "grab", flexShrink: 0,
          userSelect: "none", position: "relative",
        }}
      >
        {onClose && (
          <div
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onClose(); }}
            style={{
              width: 14, height: 14, border: "2px solid #000",
              background: "#fff", marginLeft: 5, cursor: "pointer",
              flexShrink: 0, position: "relative", zIndex: 2,
            }}
          />
        )}
        <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
          <span style={{
            fontFamily: "'Silkscreen', monospace", fontSize: 11,
            background: "#fff", padding: "0 8px",
          }}>{title}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {children}
      </div>
      {onResizeStart && (
        <div
          onMouseDown={onResizeStart}
          style={{
            position: "absolute", bottom: 0, right: 0, width: 16, height: 16,
            cursor: "nwse-resize",
            background: "linear-gradient(135deg, transparent 50%, #000 50%, #000 56%, transparent 56%, transparent 72%, #000 72%, #000 78%, transparent 78%)",
          }}
        />
      )}
    </div>
  );
}

/* ───────── WINDOW MANAGER HOOK ───────── */
function useWindowManager(initial) {
  const [wins, setWins] = useState(initial);
  const zRef = useRef(10);
  const dragRef = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "drag") {
        setWins(p => ({ ...p, [d.id]: { ...p[d.id], x: e.clientX - d.ox, y: e.clientY - d.oy } }));
      } else {
        setWins(p => ({ ...p, [d.id]: { ...p[d.id],
          w: Math.max(220, e.clientX - d.sx + d.sw),
          h: Math.max(140, e.clientY - d.sy + d.sh),
        }}));
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const focus = useCallback((id) => {
    zRef.current++;
    setWins(p => ({ ...p, [id]: { ...p[id], z: zRef.current } }));
  }, []);

  const startDrag = useCallback((id, e) => {
    e.preventDefault();
    focus(id);
    setWins(p => {
      dragRef.current = { id, mode: "drag", ox: e.clientX - p[id].x, oy: e.clientY - p[id].y };
      return p;
    });
  }, [focus]);

  const startResize = useCallback((id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setWins(p => {
      dragRef.current = { id, mode: "resize", sx: e.clientX, sy: e.clientY, sw: p[id].w, sh: p[id].h };
      return p;
    });
  }, []);

  return { wins, focus, startDrag, startResize };
}

/* ══════════ APP ══════════ */
export default function EditorApp() {
  const [annotations, setAnnotations] = useState(INITIAL_ANNOTATIONS);
  const [activeId, setActiveId] = useState(null);
  const [showDSL, setShowDSL] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [dslText, setDslText] = useState("");
  const [dslError, setDslError] = useState(null);
  const [selectedText, setSelectedText] = useState("");
  const [selPopup, setSelPopup] = useState(null);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const articleRef = useRef(null);
  const chatEndRef = useRef(null);
  const selTimer = useRef(null);

  const { wins, focus, startDrag, startResize } = useWindowManager({
    doc:       { x: 16,  y: 10,  w: 520, h: 500, z: 1 },
    inspector: { x: 560, y: 10,  w: 380, h: 500, z: 2 },
    dsl:       { x: 80,  y: 50,  w: 520, h: 480, z: 3 },
    chat:      { x: 560, y: 320, w: 380, h: 340, z: 4 },
  });

  const active = annotations.find(a => a.id === activeId);

  useEffect(() => {
    if (showDSL) setDslText(JSON.stringify(annotations, null, 2));
  }, [showDSL, annotations]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, chatLoading]);

  useEffect(() => {
    const h = () => setMenuOpen(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  /* ── Text selection detection (document-level) ── */
  useEffect(() => {
    const handler = () => {
      clearTimeout(selTimer.current);
      selTimer.current = setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text && text.length > 3 && articleRef.current?.contains(sel.anchorNode)) {
          try {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSelectedText(text);
            setSelPopup({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
          } catch { setSelPopup(null); }
        } else {
          setSelPopup(null);
        }
      }, 50);
    };
    document.addEventListener("mouseup", handler);
    return () => document.removeEventListener("mouseup", handler);
  }, []);

  const toggleSuggestion = (annId, sugIdx) => {
    setAnnotations(prev => prev.map(a =>
      a.id !== annId ? a : { ...a, activeSuggestion: a.activeSuggestion === sugIdx ? null : sugIdx }
    ));
  };

  const applyDSL = () => {
    try {
      const parsed = JSON.parse(dslText);
      if (!Array.isArray(parsed)) throw new Error("Root must be an array");
      setAnnotations(parsed);
      setDslError(null);
    } catch (e) { setDslError(e.message); }
  };

  const openChatFromSelection = () => {
    setShowChat(true);
    focus("chat");
    setChatMsgs([{ role: "system", text: `Selected: "${selectedText}"` }]);
    setChatInput("");
    setSelPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMsgs(p => [...p, { role: "user", text: userMsg }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const ctxMsg = chatMsgs.find(m => m.role === "system");
      const sel = ctxMsg ? ctxMsg.text.replace('Selected: "', '').replace(/"$/, '') : selectedText;
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a writing editor. The user selected this text from a draft:\n"${sel}"\n\nRespond ONLY with a JSON array of 1-3 suggestion objects. Each has "text" (replacement) and "rationale" (1 sentence). No markdown, no backticks, just raw JSON array.`,
          messages: [{ role: "user", content: userMsg }]
        })
      });
      const data = await resp.json();
      const raw = data.content?.map(c => c.text || "").join("") || "[]";
      const suggestions = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setAnnotations(p => [...p, {
        id: Date.now(), type: "rephrase", original: sel, suggestions, activeSuggestion: null
      }]);
      setChatMsgs(p => [...p, {
        role: "assistant",
        text: `Added ${suggestions.length} suggestion${suggestions.length !== 1 ? "s" : ""} for "${sel.slice(0, 35)}${sel.length > 35 ? "…" : ""}"`
      }]);
    } catch (e) {
      setChatMsgs(p => [...p, { role: "assistant", text: `Error: ${e.message}` }]);
    }
    setChatLoading(false);
  };

  const handleAnnClick = useCallback((annId) => {
    setActiveId(annId);
    focus("inspector");
  }, [focus]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: `repeating-conic-gradient(#ddd 0% 25%, #f0f0f0 0% 50%) 0 0 / 4px 4px`,
      fontFamily: "'Silkscreen', monospace", fontSize: 12,
      overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap" rel="stylesheet" />

      {/* ── MENU BAR ── */}
      <div style={{
        height: 24, background: "#fff", borderBottom: "2px solid #000",
        display: "flex", alignItems: "center", paddingLeft: 8,
        position: "relative", zIndex: 99999,
      }}>
        <span style={{ fontSize: 14, marginRight: 14 }}>🍎</span>
        {[
          { label: "File", items: [{ label: "  About Editor", action: () => {} }] },
          { label: "View", items: [
            { label: (showDSL ? "✓" : "  ") + " DSL Editor", action: () => { setShowDSL(!showDSL); if (!showDSL) focus("dsl"); }},
            { label: (showChat ? "✓" : "  ") + " Chat", action: () => { setShowChat(!showChat); if (!showChat) focus("chat"); }},
          ]},
        ].map(menu => (
          <div key={menu.label} style={{ position: "relative" }}>
            <div
              onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === menu.label ? null : menu.label); }}
              style={{
                padding: "2px 12px", cursor: "pointer",
                background: menuOpen === menu.label ? "#000" : "transparent",
                color: menuOpen === menu.label ? "#fff" : "#000", fontSize: 12,
              }}
            >{menu.label}</div>
            {menuOpen === menu.label && (
              <div style={{
                position: "absolute", top: "100%", left: 0,
                background: "#fff", border: "2px solid #000",
                boxShadow: "3px 3px 0 #000", minWidth: 180, zIndex: 100000,
              }}>
                {menu.items.map((item, i) => (
                  <div key={i}
                    onClick={e => { e.stopPropagation(); item.action(); setMenuOpen(null); }}
                    style={{ padding: "4px 14px", cursor: "pointer", fontSize: 11, whiteSpace: "pre" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
                  >{item.label}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── DESKTOP ── */}
      <div style={{ position: "relative", width: "100%", height: "calc(100% - 24px)" }}>

        {/* DOCUMENT */}
        <MacWindow title="Untitled Draft" {...wins.doc}
          onFocus={() => focus("doc")}
          onDragStart={e => startDrag("doc", e)}
          onResizeStart={e => startResize("doc", e)}>
          <div ref={articleRef} style={{
            padding: "16px 20px",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 15, lineHeight: 1.75, color: "#000",
            userSelect: "text", cursor: "text",
          }}>
            {DEMO_TEXT.map((para, pi) => {
              const segs = buildSegments(para, annotations);
              return (
                <p key={pi} style={{ marginBottom: 16 }}>
                  {segs.map((seg, si) => {
                    if (!seg.ann) return <span key={si}>{seg.text}</span>;
                    const isActive = seg.ann.id === activeId;
                    const t = seg.ann.type;
                    return (
                      <span key={si}
                        onClick={e => { e.stopPropagation(); handleAnnClick(seg.ann.id); }}
                        style={{
                          cursor: "pointer",
                          borderBottom: "2px dotted #000",
                          background: isActive ? "#000" : seg.replaced ? "#bbb" : "transparent",
                          color: isActive ? "#fff" : "#000",
                          fontStyle: seg.replaced ? "italic" : "normal",
                          padding: "1px 2px",
                        }}
                      >{seg.text}<sup style={{
                          fontSize: 7, fontFamily: "'Silkscreen', monospace",
                          marginLeft: 1, color: isActive ? "#fff" : "#666",
                        }}>{TYPE_CONFIG[t].pattern}</sup></span>
                    );
                  })}
                </p>
              );
            })}
          </div>
        </MacWindow>

        {/* INSPECTOR */}
        <MacWindow title="Inspector" {...wins.inspector}
          onFocus={() => focus("inspector")}
          onDragStart={e => startDrag("inspector", e)}
          onResizeStart={e => startResize("inspector", e)}>
          <div style={{ padding: 12 }}>
            {!active ? (
              <div style={{ color: "#888", fontSize: 11, padding: 24, textAlign: "center" }}>
                Click an underlined annotation<br/>in the document to inspect.
              </div>
            ) : (
              <>
                <div style={{
                  display: "inline-block", border: "2px solid #000",
                  padding: "2px 10px", marginBottom: 12, fontSize: 11,
                  background: active.type === "note" ? "#fff" : "#000",
                  color: active.type === "note" ? "#000" : "#fff",
                }}>{TYPE_CONFIG[active.type].pattern} {TYPE_CONFIG[active.type].label}</div>

                <div style={{
                  borderLeft: "3px solid #000", paddingLeft: 10,
                  marginBottom: 14, fontFamily: "Georgia, serif",
                  fontSize: 13, fontStyle: "italic", color: "#555",
                }}>"{active.original}"</div>

                <div style={{ fontSize: 10, marginBottom: 8, color: "#888" }}>
                  SUGGESTIONS ({active.suggestions.length})
                </div>

                {active.suggestions.map((sug, i) => {
                  const isOn = active.activeSuggestion === i;
                  return (
                    <div key={i} style={{
                      border: "2px solid #000", marginBottom: 10,
                      background: isOn ? "#000" : "#fff",
                      color: isOn ? "#fff" : "#000",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "flex-start",
                        padding: "8px 10px", gap: 10,
                        borderBottom: isOn ? "1px solid #444" : "1px solid #ccc",
                      }}>
                        <span style={{ fontFamily: "Georgia, serif", fontSize: 13, flex: 1 }}>
                          "{sug.text}"
                        </span>
                        <button
                          onClick={() => toggleSuggestion(active.id, i)}
                          style={{
                            border: "2px solid " + (isOn ? "#fff" : "#000"),
                            background: isOn ? "#fff" : "#000",
                            color: isOn ? "#000" : "#fff",
                            fontSize: 9, padding: "3px 10px", cursor: "pointer",
                            flexShrink: 0, fontFamily: "'Silkscreen', monospace",
                          }}
                        >{isOn ? "Revert" : "Apply"}</button>
                      </div>
                      <div style={{
                        padding: "6px 10px", fontSize: 11,
                        color: isOn ? "#aaa" : "#666",
                      }}>{sug.rationale}</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </MacWindow>

        {/* DSL EDITOR */}
        {showDSL && (
          <MacWindow title="DSL Editor" {...wins.dsl}
            onClose={() => setShowDSL(false)}
            onFocus={() => focus("dsl")}
            onDragStart={e => startDrag("dsl", e)}
            onResizeStart={e => startResize("dsl", e)}>
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <textarea
                value={dslText}
                onChange={e => { setDslText(e.target.value); setDslError(null); }}
                spellCheck={false}
                style={{
                  flex: 1, resize: "none", border: "none",
                  fontFamily: "'Courier New', monospace", fontSize: 11,
                  lineHeight: 1.5, padding: 12, outline: "none",
                  background: "#fff", color: "#000", minHeight: 0,
                }}
              />
              <div style={{
                padding: "8px 12px", display: "flex",
                justifyContent: "space-between", alignItems: "center",
                background: "#e8e8e8", borderTop: "2px solid #000", flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 10, color: dslError ? "#000" : "#888",
                  fontWeight: dslError ? 700 : 400,
                }}>{dslError ? `⚠ ${dslError}` : "Edit JSON → Apply"}</span>
                <button onClick={applyDSL} style={{
                  border: "2px solid #000", background: "#000", color: "#fff",
                  fontSize: 10, padding: "3px 16px", cursor: "pointer",
                  fontFamily: "'Silkscreen', monospace",
                }}>Apply</button>
              </div>
            </div>
          </MacWindow>
        )}

        {/* CHAT */}
        {showChat && (
          <MacWindow title="Ask Editor" {...wins.chat}
            onClose={() => setShowChat(false)}
            onFocus={() => focus("chat")}
            onDragStart={e => startDrag("chat", e)}
            onResizeStart={e => startResize("chat", e)}>
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{
                flex: 1, overflowY: "auto", padding: 10,
                borderBottom: "2px solid #000", minHeight: 0,
              }}>
                {chatMsgs.length === 0 && (
                  <div style={{ color: "#888", fontSize: 10, textAlign: "center", padding: 24 }}>
                    Select text in the document,<br/>then click ✦ to start.
                  </div>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} style={{
                    marginBottom: 8, fontSize: 11,
                    fontFamily: m.role === "system" ? "'Silkscreen', monospace" : "Georgia, serif",
                    color: m.role === "system" ? "#888" : "#000",
                    background: m.role === "assistant" ? "#e8e8e8" : "transparent",
                    padding: m.role === "assistant" ? "6px 8px" : "2px 0",
                    border: m.role === "assistant" ? "1px solid #ccc" : "none",
                  }}>
                    {m.role === "user" && <span style={{ fontSize: 9, color: "#888" }}>YOU: </span>}
                    {m.role === "assistant" && <span style={{ fontSize: 9, color: "#888" }}>EDITOR: </span>}
                    {m.text}
                  </div>
                ))}
                {chatLoading && <div style={{ fontSize: 10, color: "#888" }}>Thinking...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: "flex", flexShrink: 0 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
                  placeholder="e.g. make this punchier"
                  style={{
                    flex: 1, border: "none", padding: "8px 12px",
                    fontFamily: "Georgia, serif", fontSize: 12,
                    outline: "none", background: "#fff",
                  }}
                />
                <button onClick={sendChat} style={{
                  border: "none", borderLeft: "2px solid #000",
                  background: "#000", color: "#fff", padding: "8px 16px",
                  fontSize: 11, cursor: "pointer", fontFamily: "'Silkscreen', monospace",
                }}>Send</button>
              </div>
            </div>
          </MacWindow>
        )}

        {/* SELECTION POPUP */}
        {selPopup && (
          <div style={{
            position: "fixed", left: selPopup.x, top: selPopup.y,
            transform: "translateX(-50%)", zIndex: 999999,
          }}>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={openChatFromSelection}
              style={{
                border: "2px solid #000", background: "#fff",
                boxShadow: "2px 2px 0 #000",
                fontSize: 10, padding: "4px 12px", cursor: "pointer",
                whiteSpace: "nowrap", fontFamily: "'Silkscreen', monospace",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
            >✦ Ask for suggestions</button>
          </div>
        )}
      </div>
    </div>
  );
}
