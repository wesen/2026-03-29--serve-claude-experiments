import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
const CHICAGO_FONT = `"Geneva", "ChicagoFLF", "VT323", monospace`;
const stripedBg = `repeating-linear-gradient(
  0deg,
  #000 0px, #000 1px,
  #fff 1px, #fff 2px
)`;
const checkerBg = `url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='2' height='2' fill='%23000'/%3E%3Crect x='2' y='2' width='2' height='2' fill='%23000'/%3E%3C/svg%3E")`;
function MacButton({ children, onClick, primary, disabled, style }) {
  const [pressed, setPressed] = useState(false);
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      disabled,
      onMouseDown: () => setPressed(true),
      onMouseUp: () => setPressed(false),
      onMouseLeave: () => setPressed(false),
      onClick,
      style: {
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
        ...style
      }
    },
    children
  );
}
function MacCheckbox({ checked, onChange, label }) {
  return /* @__PURE__ */ React.createElement(
    "label",
    {
      style: {
        fontFamily: CHICAGO_FONT,
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        userSelect: "none"
      }
    },
    /* @__PURE__ */ React.createElement(
      "span",
      {
        onClick: onChange,
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          border: "2px solid #000",
          background: "#fff",
          fontSize: 10,
          lineHeight: 1
        }
      },
      checked ? "\u2715" : ""
    ),
    label
  );
}
function TitleBar({ title, onClose, active = true }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        height: 20,
        background: active ? stripedBg : "#fff",
        borderBottom: "2px solid #000",
        padding: "0 4px",
        flexShrink: 0
      }
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: onClose,
        style: {
          width: 13,
          height: 13,
          border: "2px solid #000",
          background: "#fff",
          cursor: "pointer",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          flex: 1,
          textAlign: "center",
          fontFamily: CHICAGO_FONT,
          fontSize: 12,
          fontWeight: "bold",
          background: active ? "#fff" : "transparent",
          margin: "0 8px",
          padding: "0 12px",
          whiteSpace: "nowrap",
          lineHeight: "18px"
        }
      },
      title
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          width: 13,
          height: 13,
          border: "2px solid #000",
          background: "#fff",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { width: 7, height: 7, border: "1px solid #000" } })
    )
  );
}
function MacWindow({ title, children, style, onClose, active = true }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        border: "2px solid #000",
        boxShadow: "2px 2px 0 #000",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        ...style
      }
    },
    /* @__PURE__ */ React.createElement(TitleBar, { title, onClose, active }),
    /* @__PURE__ */ React.createElement("div", { style: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" } }, children)
  );
}
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
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flex: 1, overflow: "hidden", ...style } }, /* @__PURE__ */ React.createElement(
    "div",
    {
      ref,
      onScroll: handleScroll,
      style: {
        flex: 1,
        overflowY: "auto",
        scrollbarWidth: "none"
      }
    },
    /* @__PURE__ */ React.createElement("style", null, `div::-webkit-scrollbar{display:none}`),
    children
  ), /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        width: 16,
        borderLeft: "2px solid #000",
        background: checkerBg,
        backgroundSize: "4px 4px",
        position: "relative",
        flexShrink: 0
      }
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          height: 16,
          borderBottom: "2px solid #000",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8
        }
      },
      "\u25B2"
    ),
    showThumb && /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: 16 + scrollPct * 60 + "%",
          left: 0,
          right: 0,
          height: 24,
          background: "#fff",
          border: "1px solid #000",
          transform: `translateY(-${scrollPct * 100}%)`
        }
      }
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
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
          fontSize: 8
        }
      },
      "\u25BC"
    )
  ));
}
function MacProgress({ progress, indeterminate }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        height: 16,
        border: "2px solid #000",
        background: "#fff",
        overflow: "hidden",
        position: "relative"
      }
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: indeterminate ? "100%" : `${progress}%`,
          background: indeterminate ? `repeating-linear-gradient(-45deg, #000 0px, #000 4px, #fff 4px, #fff 8px)` : "#000",
          backgroundSize: indeterminate ? "16px 16px" : void 0,
          animation: indeterminate ? "barberpole 0.6s linear infinite" : void 0,
          transition: indeterminate ? void 0 : "width 0.3s"
        }
      }
    )
  );
}
function SourceCard({ index, title, url, snippet }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        border: "2px solid #000",
        padding: 8,
        marginBottom: 6,
        background: "#fff",
        fontFamily: CHICAGO_FONT,
        fontSize: 11
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 4 } }, /* @__PURE__ */ React.createElement(
      "span",
      {
        style: {
          background: "#000",
          color: "#fff",
          width: 18,
          height: 18,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          flexShrink: 0
        }
      },
      index
    ), /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", wordBreak: "break-word" } }, title)),
    /* @__PURE__ */ React.createElement("div", { style: { color: "#555", fontSize: 10, marginBottom: 2, wordBreak: "break-all" } }, "\u{1F4C4} ", url),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, lineHeight: 1.4 } }, snippet)
  );
}
const DEMO_STEPS = [
  { type: "status", text: "Formulating research plan..." },
  { type: "status", text: "Searching: initial query analysis" },
  {
    type: "source",
    title: "Wikipedia \u2014 Overview",
    url: "en.wikipedia.org/wiki/...",
    snippet: "A comprehensive overview of the topic with historical context and key developments."
  },
  { type: "status", text: "Analyzing source content..." },
  { type: "thinking", text: "The initial sources suggest this topic has multiple facets. I need to explore the technical aspects more deeply and find recent developments." },
  {
    type: "source",
    title: "Nature \u2014 Recent Study",
    url: "nature.com/articles/...",
    snippet: "Peer-reviewed research published in 2025 presenting new findings in this domain."
  },
  { type: "status", text: "Searching: recent developments 2025" },
  {
    type: "source",
    title: "ArXiv \u2014 Technical Paper",
    url: "arxiv.org/abs/2501...",
    snippet: "Pre-print describing a novel approach that significantly improves upon prior methods."
  },
  { type: "thinking", text: "These papers reveal a clear trend. Let me verify with industry sources and look for contradicting viewpoints to ensure balanced coverage." },
  { type: "status", text: "Cross-referencing findings..." },
  {
    type: "source",
    title: "MIT Technology Review",
    url: "technologyreview.com/...",
    snippet: "Industry analysis covering practical applications and commercial implications."
  },
  {
    type: "source",
    title: "Stanford HAI Report",
    url: "hai.stanford.edu/...",
    snippet: "Policy perspective addressing societal impact, ethics, and governance frameworks."
  },
  { type: "status", text: "Synthesizing 5 sources into report..." },
  { type: "thinking", text: "I now have sufficient high-quality sources covering technical, practical, and policy dimensions. Synthesizing into a comprehensive report." },
  { type: "done" }
];
function DeepResearchApp() {
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
        setProgress((i + 1) / DEMO_STEPS.length * 100);
        if (step.type === "done") {
          clearInterval(timerRef.current);
          setIsResearching(false);
          setReport(
            `# Research Report

## Query: "${query}"

Based on analysis of 5 high-quality sources, here is a comprehensive synthesis of findings.

### Key Findings

\u2022 Recent peer-reviewed studies (Nature, 2025) demonstrate significant advances in this area, with measurable improvements over previous approaches.

\u2022 Technical pre-prints on ArXiv propose novel methodologies that address longstanding limitations, showing promise for near-term practical applications.

\u2022 Industry analysis from MIT Technology Review confirms growing commercial interest, with several major organizations investing in implementation.

### Analysis

The convergence of academic research and industry adoption suggests this field is at an inflection point. The Stanford HAI report adds important context about governance and ethical considerations that will shape future development.

### Conclusion

The evidence strongly supports continued momentum in this domain. Key areas to watch include regulatory developments and the transition from research prototypes to production systems.

---
\u{1F4CE} 5 sources cited \xB7 Research depth: ${depthLevel} \xB7 ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
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
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100vh",
        background: checkerBg,
        backgroundColor: "#c0c0c0",
        backgroundSize: "4px 4px",
        fontFamily: CHICAGO_FONT,
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }
    },
    /* @__PURE__ */ React.createElement("style", null, `
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
      `),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          height: 22,
          background: "#fff",
          borderBottom: "2px solid #000",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          gap: 16,
          flexShrink: 0,
          zIndex: 100
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, cursor: "default" } }, "\u{1F34E}"),
      /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", cursor: "default" } }, "File"),
      /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", cursor: "default" } }, "Edit"),
      /* @__PURE__ */ React.createElement(
        "span",
        {
          style: { fontWeight: "bold", cursor: "pointer" },
          onClick: () => setShowAbout(true)
        },
        "About"
      ),
      /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", cursor: "default" } }, "Special"),
      /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, fontWeight: "bold" } }, (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          flex: 1,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "hidden"
        }
      },
      /* @__PURE__ */ React.createElement(
        MacWindow,
        {
          title: "\u{1F50D} Deep Research",
          active: true,
          onClose: () => {
          },
          style: { flex: 1, minHeight: 0 }
        },
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flex: 1, overflow: "hidden" } }, /* @__PURE__ */ React.createElement(
          "div",
          {
            style: {
              width: 240,
              borderRight: "2px solid #000",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              flexShrink: 0,
              background: "#fff"
            }
          },
          /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                fontFamily: CHICAGO_FONT,
                fontSize: 11,
                fontWeight: "bold",
                marginBottom: 4
              }
            },
            "Research Query:"
          ), /* @__PURE__ */ React.createElement(
            "textarea",
            {
              value: query,
              onChange: (e) => setQuery(e.target.value),
              placeholder: "What would you like to research?",
              disabled: isResearching,
              style: {
                width: "100%",
                height: 72,
                border: "2px solid #000",
                fontFamily: CHICAGO_FONT,
                fontSize: 12,
                padding: 6,
                resize: "none",
                background: isResearching ? "#eee" : "#fff",
                outline: "none"
              },
              onKeyDown: (e) => {
                if (e.key === "Enter" && e.metaKey) startResearch();
              }
            }
          )),
          /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                fontFamily: CHICAGO_FONT,
                fontSize: 11,
                fontWeight: "bold",
                marginBottom: 6
              }
            },
            "Research Depth:"
          ), ["quick", "standard", "thorough"].map((level) => /* @__PURE__ */ React.createElement(
            "label",
            {
              key: level,
              style: {
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
                cursor: "pointer",
                fontFamily: CHICAGO_FONT,
                fontSize: 11
              }
            },
            /* @__PURE__ */ React.createElement(
              "span",
              {
                onClick: () => !isResearching && setDepthLevel(level),
                style: {
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "2px solid #000",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }
              },
              depthLevel === level && /* @__PURE__ */ React.createElement(
                "span",
                {
                  style: {
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#000"
                  }
                }
              )
            ),
            level.charAt(0).toUpperCase() + level.slice(1),
            /* @__PURE__ */ React.createElement("span", { style: { color: "#666", fontSize: 10 } }, level === "quick" ? "(~2 min)" : level === "standard" ? "(~5 min)" : "(~15 min)")
          ))),
          /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                borderTop: "1px solid #000",
                paddingTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6
              }
            },
            /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold", fontSize: 11, marginBottom: 2 } }, "Options:"),
            /* @__PURE__ */ React.createElement(
              MacCheckbox,
              {
                checked: webSearch,
                onChange: () => !isResearching && setWebSearch(!webSearch),
                label: "Web search"
              }
            ),
            /* @__PURE__ */ React.createElement(
              MacCheckbox,
              {
                checked: academicOnly,
                onChange: () => !isResearching && setAcademicOnly(!academicOnly),
                label: "Academic sources only"
              }
            )
          ),
          /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }),
          /* @__PURE__ */ React.createElement(
            MacButton,
            {
              primary: true,
              onClick: startResearch,
              disabled: !query.trim() || isResearching
            },
            isResearching ? "Researching\u2026" : "\u2318 Begin Research"
          ),
          isResearching && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "#333" } }, "\u{1F4E1} ", sourceCount, " source", sourceCount !== 1 ? "s" : "", " found")
        ), /* @__PURE__ */ React.createElement(
          "div",
          {
            style: {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "#fff"
            }
          },
          (isResearching || report) && /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 12px 4px", flexShrink: 0 } }, /* @__PURE__ */ React.createElement(
            MacProgress,
            {
              progress,
              indeterminate: isResearching && progress < 15
            }
          ), /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                fontSize: 10,
                marginTop: 3,
                display: "flex",
                justifyContent: "space-between"
              }
            },
            /* @__PURE__ */ React.createElement("span", null, isResearching ? "Researching\u2026" : "\u2713 Complete"),
            /* @__PURE__ */ React.createElement("span", null, Math.round(progress), "%")
          )),
          /* @__PURE__ */ React.createElement(MacScroll, { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: 12 } }, !isResearching && steps.length === 0 && !report && /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                textAlign: "center",
                padding: "48px 24px",
                color: "#666"
              }
            },
            /* @__PURE__ */ React.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u{1F50D}"),
            /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: "bold", marginBottom: 8 } }, "Deep Research"),
            /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" } }, `Enter a research query and click "Begin Research" to start. I'll search multiple sources, analyze findings, and synthesize a comprehensive report.`),
            /* @__PURE__ */ React.createElement(
              "div",
              {
                style: {
                  marginTop: 16,
                  fontSize: 10,
                  color: "#999",
                  borderTop: "1px solid #ccc",
                  paddingTop: 8
                }
              },
              "\u2318+Enter to start \xB7 Tip: be specific for better results"
            )
          ), steps.filter((s) => s.type !== "done").map((step, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { marginBottom: 8 } }, step.type === "status" && /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                fontSize: 11,
                color: "#555",
                padding: "3px 0",
                display: "flex",
                alignItems: "center",
                gap: 6
              }
            },
            isResearching && i === steps.filter((s) => s.type !== "done").length - 1 ? /* @__PURE__ */ React.createElement("span", { style: { animation: "blink 1s step-end infinite" } }, "\u25B6") : /* @__PURE__ */ React.createElement("span", null, "\u2713"),
            step.text
          ), step.type === "source" && /* @__PURE__ */ React.createElement(
            SourceCard,
            {
              index: steps.slice(0, i + 1).filter((s) => s.type === "source").length,
              title: step.title,
              url: step.url,
              snippet: step.snippet
            }
          ), step.type === "thinking" && /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                border: "1px dashed #000",
                padding: 8,
                marginBottom: 4,
                fontSize: 11,
                fontStyle: "italic",
                color: "#444",
                background: "#f8f8f8"
              }
            },
            "\u{1F4AD} ",
            step.text
          ))), report && /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                border: "2px solid #000",
                marginTop: 12,
                background: "#fff"
              }
            },
            /* @__PURE__ */ React.createElement(
              "div",
              {
                style: {
                  background: "#000",
                  color: "#fff",
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: "bold"
                }
              },
              "\u{1F4CB} RESEARCH REPORT"
            ),
            /* @__PURE__ */ React.createElement(
              "div",
              {
                style: {
                  padding: 12,
                  fontSize: 12,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  fontFamily: CHICAGO_FONT
                }
              },
              report
            )
          ), /* @__PURE__ */ React.createElement("div", { ref: stepsEndRef })))
        ))
      )
    ),
    showAbout && /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 200
        },
        onClick: () => setShowAbout(false)
      },
      /* @__PURE__ */ React.createElement(
        MacWindow,
        {
          title: "About Deep Research",
          onClose: () => setShowAbout(false),
          style: { width: 320 }
        },
        /* @__PURE__ */ React.createElement(
          "div",
          {
            style: {
              padding: 20,
              textAlign: "center",
              fontFamily: CHICAGO_FONT,
              fontSize: 12
            },
            onClick: (e) => e.stopPropagation()
          },
          /* @__PURE__ */ React.createElement("div", { style: { fontSize: 48, marginBottom: 8 } }, "\u{1F52C}"),
          /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold", fontSize: 14, marginBottom: 4 } }, "Deep Research"),
          /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, marginBottom: 2 } }, "Version 1.0"),
          /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "#666", marginBottom: 16 } }, "\xA9 2026 Macintosh Research Systems"),
          /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                borderTop: "1px solid #000",
                paddingTop: 12,
                fontSize: 11,
                lineHeight: 1.6,
                marginBottom: 16
              }
            },
            "A multi-source research assistant that searches, analyzes, and synthesizes information into comprehensive reports."
          ),
          /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                fontSize: 10,
                color: "#888",
                marginBottom: 16
              }
            },
            "Built for Macintosh System 7",
            /* @__PURE__ */ React.createElement("br", null),
            "Requires 4 MB RAM \xB7 68040 or later"
          ),
          /* @__PURE__ */ React.createElement(MacButton, { onClick: () => setShowAbout(false), primary: true }, "OK")
        )
      )
    )
  );
}
const __artifactDefault = DeepResearchApp;
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(__artifactDefault));
