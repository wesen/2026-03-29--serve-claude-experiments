import { useState, useEffect, useRef, useCallback } from "react";

const CHICAGO_FONT = `"Geneva", "ChicagoFLF", "VT323", monospace`;

// ─── pixel-perfect patterns ──────────────────────────────────────────
const stripedBg = `repeating-linear-gradient(
  0deg,
  #000 0px, #000 1px,
  #fff 1px, #fff 2px
)`;

const checkerBg = `url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='2' height='2' fill='%23000'/%3E%3Crect x='2' y='2' width='2' height='2' fill='%23000'/%3E%3C/svg%3E")`;

// ─── Classic Mac Button ──────────────────────────────────────────────
function MacButton({ children, onClick, primary, disabled, style }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      style={{
        fontFamily: CHICAGO_FONT,
        fontSize: 12,
        padding: "4px 16px",
        background: pressed ? "#000" : "#fff",
        color: pressed ? "#fff" : "#000",
        border: "2px solid #000",
        borderRadius: primary ? 8 : 3,
        outline: primary ? "3px solid #000" : "none",
        outlineOffset: primary ? 1 : 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        imageRendering: "pixelated",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Classic Mac Checkbox ────────────────────────────────────────────
function MacCheckbox({ checked, onChange, label }) {
  return (
    <label
      style={{
        fontFamily: CHICAGO_FONT,
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span
        onClick={onChange}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          border: "2px solid #000",
          background: "#fff",
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {checked ? "✕" : ""}
      </span>
      {label}
    </label>
  );
}

// ─── Title Bar (System 7 style) ─────────────────────────────────────
function TitleBar({ title, onClose, active = true }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 20,
        background: active ? stripedBg : "#fff",
        borderBottom: "2px solid #000",
        padding: "0 4px",
        flexShrink: 0,
      }}
    >
      {/* close box */}
      <div
        onClick={onClose}
        style={{
          width: 13,
          height: 13,
          border: "2px solid #000",
          background: "#fff",
          cursor: "pointer",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
      {/* title */}
      <div
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: CHICAGO_FONT,
          fontSize: 12,
          fontWeight: "bold",
          background: active ? "#fff" : "transparent",
          margin: "0 8px",
          padding: "0 12px",
          whiteSpace: "nowrap",
          lineHeight: "18px",
        }}
      >
        {title}
      </div>
      {/* zoom box */}
      <div
        style={{
          width: 13,
          height: 13,
          border: "2px solid #000",
          background: "#fff",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 7, height: 7, border: "1px solid #000" }} />
      </div>
    </div>
  );
}

// ─── Mac Window ─────────────────────────────────────────────────────
function MacWindow({ title, children, style, onClose, active = true }) {
  return (
    <div
      style={{
        border: "2px solid #000",
        boxShadow: "2px 2px 0 #000",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <TitleBar title={title} onClose={onClose} active={active} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Scrollable area with Mac scrollbar ─────────────────────────────
function MacScroll({ children, style }) {
  const ref = useRef(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [showThumb, setShowThumb] = useState(false);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    const pct = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
    setScrollPct(pct);
    setShowThumb(el.scrollHeight > el.clientHeight);
  };

  useEffect(() => {
    const el = ref.current;
    if (el) {
      setShowThumb(el.scrollHeight > el.clientHeight);
    }
  }, [children]);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", ...style }}>
      <div
        ref={ref}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          scrollbarWidth: "none",
        }}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {children}
      </div>
      {/* classic scrollbar */}
      <div
        style={{
          width: 16,
          borderLeft: "2px solid #000",
          background: checkerBg,
          backgroundSize: "4px 4px",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {/* up arrow */}
        <div
          style={{
            height: 16,
            borderBottom: "2px solid #000",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
          }}
        >
          ▲
        </div>
        {/* thumb */}
        {showThumb && (
          <div
            style={{
              position: "absolute",
              top: 16 + scrollPct * 60 + "%",
              left: 0,
              right: 0,
              height: 24,
              background: "#fff",
              border: "1px solid #000",
              transform: `translateY(-${scrollPct * 100}%)`,
            }}
          />
        )}
        {/* down arrow */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 16,
            borderTop: "2px solid #000",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
          }}
        >
          ▼
        </div>
      </div>
    </div>
  );
}

// ─── Progress bar (barberpole) ──────────────────────────────────────
function MacProgress({ progress, indeterminate }) {
  return (
    <div
      style={{
        height: 16,
        border: "2px solid #000",
        background: "#fff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: indeterminate ? "100%" : `${progress}%`,
          background: indeterminate
            ? `repeating-linear-gradient(-45deg, #000 0px, #000 4px, #fff 4px, #fff 8px)`
            : "#000",
          backgroundSize: indeterminate ? "16px 16px" : undefined,
          animation: indeterminate ? "barberpole 0.6s linear infinite" : undefined,
          transition: indeterminate ? undefined : "width 0.3s",
        }}
      />
    </div>
  );
}

// ─── Source card ─────────────────────────────────────────────────────
function SourceCard({ index, title, url, snippet }) {
  return (
    <div
      style={{
        border: "2px solid #000",
        padding: 8,
        marginBottom: 6,
        background: "#fff",
        fontFamily: CHICAGO_FONT,
        fontSize: 11,
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <span
          style={{
            background: "#000",
            color: "#fff",
            width: 18,
            height: 18,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          {index}
        </span>
        <span style={{ fontWeight: "bold", wordBreak: "break-word" }}>{title}</span>
      </div>
      <div style={{ color: "#555", fontSize: 10, marginBottom: 2, wordBreak: "break-all" }}>
        📄 {url}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.4 }}>{snippet}</div>
    </div>
  );
}

// ─── Fake research data ─────────────────────────────────────────────
const DEMO_STEPS = [
  { type: "status", text: "Formulating research plan..." },
  { type: "status", text: "Searching: initial query analysis" },
  {
    type: "source",
    title: "Wikipedia — Overview",
    url: "en.wikipedia.org/wiki/...",
    snippet: "A comprehensive overview of the topic with historical context and key developments.",
  },
  { type: "status", text: "Analyzing source content..." },
  { type: "thinking", text: "The initial sources suggest this topic has multiple facets. I need to explore the technical aspects more deeply and find recent developments." },
  {
    type: "source",
    title: "Nature — Recent Study",
    url: "nature.com/articles/...",
    snippet: "Peer-reviewed research published in 2025 presenting new findings in this domain.",
  },
  { type: "status", text: "Searching: recent developments 2025" },
  {
    type: "source",
    title: "ArXiv — Technical Paper",
    url: "arxiv.org/abs/2501...",
    snippet: "Pre-print describing a novel approach that significantly improves upon prior methods.",
  },
  { type: "thinking", text: "These papers reveal a clear trend. Let me verify with industry sources and look for contradicting viewpoints to ensure balanced coverage." },
  { type: "status", text: "Cross-referencing findings..." },
  {
    type: "source",
    title: "MIT Technology Review",
    url: "technologyreview.com/...",
    snippet: "Industry analysis covering practical applications and commercial implications.",
  },
  {
    type: "source",
    title: "Stanford HAI Report",
    url: "hai.stanford.edu/...",
    snippet: "Policy perspective addressing societal impact, ethics, and governance frameworks.",
  },
  { type: "status", text: "Synthesizing 5 sources into report..." },
  { type: "thinking", text: "I now have sufficient high-quality sources covering technical, practical, and policy dimensions. Synthesizing into a comprehensive report." },
  { type: "done" },
];

// ─── Main App ────────────────────────────────────────────────────────
export default function DeepResearchApp() {
  const [query, setQuery] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [steps, setSteps] = useState([]);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState("");
  const [showAbout, setShowAbout] = useState(false);
  const [depthLevel, setDepthLevel] = useState("standard");
  const [webSearch, setWebSearch] = useState(true);
  const [academicOnly, setAcademicOnly] = useState(false);
  const stepsEndRef = useRef(null);
  const timerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [steps, scrollToBottom]);

  const startResearch = () => {
    if (!query.trim() || isResearching) return;
    setIsResearching(true);
    setSteps([]);
    setReport("");
    setProgress(0);

    let i = 0;
    timerRef.current = setInterval(() => {
      if (i < DEMO_STEPS.length) {
        const step = DEMO_STEPS[i];
        setSteps((prev) => [...prev, step]);
        setProgress(((i + 1) / DEMO_STEPS.length) * 100);
        if (step.type === "done") {
          clearInterval(timerRef.current);
          setIsResearching(false);
          setReport(
            `# Research Report\n\n## Query: "${query}"\n\nBased on analysis of 5 high-quality sources, here is a comprehensive synthesis of findings.\n\n### Key Findings\n\n• Recent peer-reviewed studies (Nature, 2025) demonstrate significant advances in this area, with measurable improvements over previous approaches.\n\n• Technical pre-prints on ArXiv propose novel methodologies that address longstanding limitations, showing promise for near-term practical applications.\n\n• Industry analysis from MIT Technology Review confirms growing commercial interest, with several major organizations investing in implementation.\n\n### Analysis\n\nThe convergence of academic research and industry adoption suggests this field is at an inflection point. The Stanford HAI report adds important context about governance and ethical considerations that will shape future development.\n\n### Conclusion\n\nThe evidence strongly supports continued momentum in this domain. Key areas to watch include regulatory developments and the transition from research prototypes to production systems.\n\n---\n📎 5 sources cited · Research depth: ${depthLevel} · ${new Date().toLocaleDateString()}`
          );
        }
        i++;
      }
    }, 900);
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const sourceCount = steps.filter((s) => s.type === "source").length;

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: checkerBg,
        backgroundColor: "#c0c0c0",
        backgroundSize: "4px 4px",
        fontFamily: CHICAGO_FONT,
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
        @keyframes barberpole {
          0% { background-position: 0 0; }
          100% { background-position: 16px 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        * { box-sizing: border-box; image-rendering: pixelated; }
      `}</style>

      {/* ── Menu Bar ── */}
      <div
        style={{
          height: 22,
          background: "#fff",
          borderBottom: "2px solid #000",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          gap: 16,
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        <span style={{ fontSize: 14, cursor: "default" }}>🍎</span>
        <span style={{ fontWeight: "bold", cursor: "default" }}>File</span>
        <span style={{ fontWeight: "bold", cursor: "default" }}>Edit</span>
        <span
          style={{ fontWeight: "bold", cursor: "pointer" }}
          onClick={() => setShowAbout(true)}
        >
          About
        </span>
        <span style={{ fontWeight: "bold", cursor: "default" }}>Special</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontWeight: "bold" }}>
          {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
      </div>

      {/* ── Desktop ── */}
      <div
        style={{
          flex: 1,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "hidden",
        }}
      >
        {/* ── Main Research Window ── */}
        <MacWindow
          title="🔍 Deep Research"
          active={true}
          onClose={() => {}}
          style={{ flex: 1, minHeight: 0 }}
        >
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* ── Left: Controls ── */}
            <div
              style={{
                width: 240,
                borderRight: "2px solid #000",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                flexShrink: 0,
                background: "#fff",
              }}
            >
              {/* Query input */}
              <div>
                <div
                  style={{
                    fontFamily: CHICAGO_FONT,
                    fontSize: 11,
                    fontWeight: "bold",
                    marginBottom: 4,
                  }}
                >
                  Research Query:
                </div>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What would you like to research?"
                  disabled={isResearching}
                  style={{
                    width: "100%",
                    height: 72,
                    border: "2px solid #000",
                    fontFamily: CHICAGO_FONT,
                    fontSize: 12,
                    padding: 6,
                    resize: "none",
                    background: isResearching ? "#eee" : "#fff",
                    outline: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) startResearch();
                  }}
                />
              </div>

              {/* Depth selector */}
              <div>
                <div
                  style={{
                    fontFamily: CHICAGO_FONT,
                    fontSize: 11,
                    fontWeight: "bold",
                    marginBottom: 6,
                  }}
                >
                  Research Depth:
                </div>
                {["quick", "standard", "thorough"].map((level) => (
                  <label
                    key={level}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                      cursor: "pointer",
                      fontFamily: CHICAGO_FONT,
                      fontSize: 11,
                    }}
                  >
                    <span
                      onClick={() => !isResearching && setDepthLevel(level)}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "2px solid #000",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {depthLevel === level && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#000",
                          }}
                        />
                      )}
                    </span>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                    <span style={{ color: "#666", fontSize: 10 }}>
                      {level === "quick"
                        ? "(~2 min)"
                        : level === "standard"
                        ? "(~5 min)"
                        : "(~15 min)"}
                    </span>
                  </label>
                ))}
              </div>

              {/* Options */}
              <div
                style={{
                  borderTop: "1px solid #000",
                  paddingTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: "bold", fontSize: 11, marginBottom: 2 }}>
                  Options:
                </div>
                <MacCheckbox
                  checked={webSearch}
                  onChange={() => !isResearching && setWebSearch(!webSearch)}
                  label="Web search"
                />
                <MacCheckbox
                  checked={academicOnly}
                  onChange={() => !isResearching && setAcademicOnly(!academicOnly)}
                  label="Academic sources only"
                />
              </div>

              <div style={{ flex: 1 }} />

              {/* Action button */}
              <MacButton
                primary
                onClick={startResearch}
                disabled={!query.trim() || isResearching}
              >
                {isResearching ? "Researching…" : "⌘ Begin Research"}
              </MacButton>

              {/* Status */}
              {isResearching && (
                <div style={{ fontSize: 10, color: "#333" }}>
                  📡 {sourceCount} source{sourceCount !== 1 ? "s" : ""} found
                </div>
              )}
            </div>

            {/* ── Right: Research Activity ── */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                background: "#fff",
              }}
            >
              {/* Progress bar */}
              {(isResearching || report) && (
                <div style={{ padding: "8px 12px 4px", flexShrink: 0 }}>
                  <MacProgress
                    progress={progress}
                    indeterminate={isResearching && progress < 15}
                  />
                  <div
                    style={{
                      fontSize: 10,
                      marginTop: 3,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{isResearching ? "Researching…" : "✓ Complete"}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>
              )}

              {/* Steps / Report area */}
              <MacScroll style={{ flex: 1 }}>
                <div style={{ padding: 12 }}>
                  {/* Empty state */}
                  {!isResearching && steps.length === 0 && !report && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "48px 24px",
                        color: "#666",
                      }}
                    >
                      <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                      <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8 }}>
                        Deep Research
                      </div>
                      <div style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>
                        Enter a research query and click "Begin Research" to start.
                        I'll search multiple sources, analyze findings, and synthesize
                        a comprehensive report.
                      </div>
                      <div
                        style={{
                          marginTop: 16,
                          fontSize: 10,
                          color: "#999",
                          borderTop: "1px solid #ccc",
                          paddingTop: 8,
                        }}
                      >
                        ⌘+Enter to start · Tip: be specific for better results
                      </div>
                    </div>
                  )}

                  {/* Activity log */}
                  {steps
                    .filter((s) => s.type !== "done")
                    .map((step, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        {step.type === "status" && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "#555",
                              padding: "3px 0",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            {isResearching &&
                            i === steps.filter((s) => s.type !== "done").length - 1 ? (
                              <span style={{ animation: "blink 1s step-end infinite" }}>
                                ▶
                              </span>
                            ) : (
                              <span>✓</span>
                            )}
                            {step.text}
                          </div>
                        )}
                        {step.type === "source" && (
                          <SourceCard
                            index={
                              steps
                                .slice(0, i + 1)
                                .filter((s) => s.type === "source").length
                            }
                            title={step.title}
                            url={step.url}
                            snippet={step.snippet}
                          />
                        )}
                        {step.type === "thinking" && (
                          <div
                            style={{
                              border: "1px dashed #000",
                              padding: 8,
                              marginBottom: 4,
                              fontSize: 11,
                              fontStyle: "italic",
                              color: "#444",
                              background: "#f8f8f8",
                            }}
                          >
                            💭 {step.text}
                          </div>
                        )}
                      </div>
                    ))}

                  {/* Final report */}
                  {report && (
                    <div
                      style={{
                        border: "2px solid #000",
                        marginTop: 12,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          background: "#000",
                          color: "#fff",
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      >
                        📋 RESEARCH REPORT
                      </div>
                      <div
                        style={{
                          padding: 12,
                          fontSize: 12,
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          fontFamily: CHICAGO_FONT,
                        }}
                      >
                        {report}
                      </div>
                    </div>
                  )}
                  <div ref={stepsEndRef} />
                </div>
              </MacScroll>
            </div>
          </div>
        </MacWindow>
      </div>

      {/* ── About Dialog ── */}
      {showAbout && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setShowAbout(false)}
        >
          <MacWindow
            title="About Deep Research"
            onClose={() => setShowAbout(false)}
            style={{ width: 320 }}
          >
            <div
              style={{
                padding: 20,
                textAlign: "center",
                fontFamily: CHICAGO_FONT,
                fontSize: 12,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 48, marginBottom: 8 }}>🔬</div>
              <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>
                Deep Research
              </div>
              <div style={{ fontSize: 11, marginBottom: 2 }}>Version 1.0</div>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 16 }}>
                © 2026 Macintosh Research Systems
              </div>
              <div
                style={{
                  borderTop: "1px solid #000",
                  paddingTop: 12,
                  fontSize: 11,
                  lineHeight: 1.6,
                  marginBottom: 16,
                }}
              >
                A multi-source research assistant that searches, analyzes, and
                synthesizes information into comprehensive reports.
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#888",
                  marginBottom: 16,
                }}
              >
                Built for Macintosh System 7
                <br />
                Requires 4 MB RAM · 68040 or later
              </div>
              <MacButton onClick={() => setShowAbout(false)} primary>
                OK
              </MacButton>
            </div>
          </MacWindow>
        </div>
      )}
    </div>
  );
}
