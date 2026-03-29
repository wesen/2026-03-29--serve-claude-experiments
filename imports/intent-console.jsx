import { useState, useEffect, useRef } from "react";

const MONO = "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'IBM Plex Sans', 'DM Sans', system-ui, sans-serif";

// Color system: warm amber/gold on deep charcoal — Smalltalk browser from the future
const C = {
  bg: "#1a1814",
  bgSurface: "#22201b",
  bgRaised: "#2a2722",
  bgHover: "#332f29",
  border: "#3d3830",
  borderActive: "#6b5c3e",
  text: "#e8dcc8",
  textMuted: "#9a8e7a",
  textDim: "#6b6050",
  accent: "#d4a856",
  accentDim: "#a68533",
  accentGlow: "rgba(212,168,86,0.12)",
  green: "#7ab87a",
  greenDim: "rgba(122,184,122,0.15)",
  red: "#c47272",
  redDim: "rgba(196,114,114,0.15)",
  blue: "#6b9fcc",
  blueDim: "rgba(107,159,204,0.15)",
  purple: "#a88bc7",
  purpleDim: "rgba(168,139,199,0.15)",
};

// Constraint chips
const CONSTRAINT_LIBRARY = [
  { id: "nonNegative", label: "nonNegative", desc: "Result ≥ 0" },
  { id: "deterministic", label: "deterministic", desc: "Same input → same output" },
  { id: "idempotent", label: "idempotent", desc: "Re-applying yields same state" },
  { id: "sideEffectFree", label: "sideEffectFree", desc: "No mutation of collaborators" },
  { id: "nilSafe", label: "nilSafe", desc: "Handles nil receivers/args gracefully" },
  { id: "bounded", label: "bounded", desc: "Result stays within domain range" },
  { id: "monotonic", label: "monotonic", desc: "Preserves ordering invariant" },
  { id: "commutative", label: "commutative", desc: "Arg order does not matter" },
];

const DEMO_CLASSES = ["Order", "Customer", "Invoice", "Cart", "Product", "Shipment", "Subscription"];

const DEMO_COLLABORATORS = [
  { name: "TaxPolicy", kind: "class", trusted: true },
  { name: "ShippingZone", kind: "class", trusted: true },
  { name: "Carrier", kind: "class", trusted: false },
  { name: "DiscountEngine", kind: "class", trusted: false },
  { name: "AuditLog", kind: "class", trusted: false },
  { name: "PaymentGateway", kind: "class", trusted: false },
];

const DEMO_FORBIDDEN = [
  "No direct database queries",
  "No hardcoded tax rates",
  "No mutating customer state",
];

function Tag({ children, color = C.accent, bg, onRemove, onClick, active, style = {} }) {
  const bgColor = bg || (active ? `${color}22` : `${color}11`);
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 3,
        fontSize: 12,
        fontFamily: MONO,
        color: active ? color : C.textMuted,
        background: bgColor,
        border: `1px solid ${active ? color + "44" : "transparent"}`,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s ease",
        userSelect: "none",
        ...style,
      }}
    >
      {children}
      {onRemove && (
        <span
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ cursor: "pointer", opacity: 0.5, marginLeft: 2, fontSize: 10 }}
        >
          ×
        </span>
      )}
    </span>
  );
}

function SectionLabel({ children, sub }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 10,
        fontFamily: MONO,
        color: C.textDim,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}>
        {children}
      </div>
      {sub && (
        <div style={{ fontSize: 11, fontFamily: SANS, color: C.textDim, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ExampleRow({ example, onChange, onRemove, index }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 32px 1fr 28px",
      gap: 8,
      alignItems: "center",
      marginBottom: 6,
    }}>
      <input
        value={example.input}
        onChange={(e) => onChange({ ...example, input: e.target.value })}
        placeholder="(Order subtotal: 100; discountRate: 0.2)"
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 3,
          color: C.text,
          fontFamily: MONO,
          fontSize: 12,
          padding: "6px 10px",
          outline: "none",
        }}
      />
      <span style={{
        textAlign: "center",
        color: C.textDim,
        fontFamily: MONO,
        fontSize: 12,
      }}>→</span>
      <input
        value={example.output}
        onChange={(e) => onChange({ ...example, output: e.target.value })}
        placeholder={example.kind === "raise" ? "InvalidDiscount" : "80"}
        style={{
          background: example.kind === "raise" ? C.redDim : C.bg,
          border: `1px solid ${example.kind === "raise" ? C.red + "33" : C.border}`,
          borderRadius: 3,
          color: example.kind === "raise" ? C.red : C.green,
          fontFamily: MONO,
          fontSize: 12,
          padding: "6px 10px",
          outline: "none",
        }}
      />
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          color: C.textDim,
          cursor: "pointer",
          fontSize: 14,
          padding: 0,
          fontFamily: MONO,
        }}
      >×</button>
    </div>
  );
}

// Candidate card after synthesis
function CandidateCard({ candidate, index, onAccept }) {
  const [expanded, setExpanded] = useState(index === 0);
  return (
    <div style={{
      background: C.bgSurface,
      border: `1px solid ${index === 0 ? C.accent + "44" : C.border}`,
      borderRadius: 4,
      marginBottom: 8,
      overflow: "hidden",
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          cursor: "pointer",
          background: index === 0 ? C.accentGlow : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: MONO,
            fontSize: 11,
            color: C.textDim,
            width: 18,
          }}>#{index + 1}</span>
          <span style={{
            fontFamily: MONO,
            fontSize: 12,
            color: C.text,
          }}>{candidate.label}</span>
          <span style={{
            fontSize: 10,
            fontFamily: MONO,
            color: candidate.confidence > 0.8 ? C.green : candidate.confidence > 0.5 ? C.accent : C.red,
            background: candidate.confidence > 0.8 ? C.greenDim : candidate.confidence > 0.5 ? C.accentGlow : C.redDim,
            padding: "2px 7px",
            borderRadius: 2,
          }}>
            {Math.round(candidate.confidence * 100)}% confidence
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10,
            fontFamily: MONO,
            color: C.green,
          }}>{candidate.examplesPassed}/{candidate.examplesTotal} examples</span>
          <span style={{
            color: C.textDim,
            fontSize: 12,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}>▾</span>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <pre style={{
            margin: 0,
            padding: "12px 14px",
            fontFamily: MONO,
            fontSize: 12,
            lineHeight: 1.6,
            color: C.text,
            background: C.bg,
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}>{candidate.code}</pre>
          <div style={{
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${C.border}`,
          }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {candidate.traits.map((t) => (
                <Tag key={t} color={C.blue}>{t}</Tag>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => onAccept("object")}
                style={{
                  background: C.bgHover,
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  color: C.textMuted,
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >install → object</button>
              <button
                onClick={() => onAccept("class")}
                style={{
                  background: C.bgHover,
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  color: C.textMuted,
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >install → class</button>
              <button
                onClick={() => onAccept("draft")}
                style={{
                  background: C.accentGlow,
                  border: `1px solid ${C.accent}44`,
                  borderRadius: 3,
                  color: C.accent,
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >draft only</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Synthesis animation dots
function SynthDots() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % 4), 350);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontFamily: MONO, color: C.accent }}>
      {"synthesizing" + ".".repeat(frame)}
    </span>
  );
}

export default function IntentConsole() {
  const [targetClass, setTargetClass] = useState("Order");
  const [selector, setSelector] = useState("shippingCost");
  const [intent, setIntent] = useState(
    "Compute shipping cost from package weight, destination zone, and carrier rate table. Free shipping for orders over $100."
  );
  const [constraints, setConstraints] = useState(["nonNegative", "deterministic", "sideEffectFree"]);
  const [collaborators, setCollaborators] = useState(
    DEMO_COLLABORATORS.map((c) => ({ ...c }))
  );
  const [forbidden, setForbidden] = useState([...DEMO_FORBIDDEN]);
  const [newForbidden, setNewForbidden] = useState("");
  const [examples, setExamples] = useState([
    { input: "(Order weight: 2.5 zone: #east carrier: #standard)", output: "12.50", kind: "value" },
    { input: "(Order weight: 1.0 zone: #west carrier: #express)", output: "18.75", kind: "value" },
    { input: "(Order weight: 0.5 zone: #east subtotal: 150)", output: "0", kind: "value" },
    { input: "(Order weight: -1 zone: #east)", output: "InvalidWeight", kind: "raise" },
  ]);
  const [phase, setPhase] = useState("authoring"); // authoring | synthesizing | reviewing
  const [candidates, setCandidates] = useState([]);
  const [installLog, setInstallLog] = useState(null);
  const synthTimer = useRef(null);

  const toggleConstraint = (id) => {
    setConstraints((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleCollaboratorTrust = (name) => {
    setCollaborators((prev) =>
      prev.map((c) => (c.name === name ? { ...c, trusted: !c.trusted } : c))
    );
  };

  const addExample = () => {
    setExamples((prev) => [...prev, { input: "", output: "", kind: "value" }]);
  };

  const addForbidden = () => {
    if (newForbidden.trim()) {
      setForbidden((prev) => [...prev, newForbidden.trim()]);
      setNewForbidden("");
    }
  };

  const synthesize = () => {
    setPhase("synthesizing");
    setInstallLog(null);
    synthTimer.current = setTimeout(() => {
      setCandidates([
        {
          label: "Weight × zone rate, free over $100",
          confidence: 0.92,
          examplesPassed: 4,
          examplesTotal: 4,
          traits: ["uses TaxPolicy", "uses ShippingZone", "guard clause"],
          code: `shippingCost
    "Compute shipping from weight, zone, carrier.
     Free for orders over $100."
    | rate |
    self weight < 0
        ifTrue: [ InvalidWeight signal ].
    self subtotal >= 100
        ifTrue: [ ^ 0 ].
    rate := ShippingZone
        rateFor: self zone
        carrier: (self carrier ifNil: [ #standard ]).
    ^ (self weight * rate) roundTo: 0.01`,
        },
        {
          label: "Lookup table with carrier override",
          confidence: 0.78,
          examplesPassed: 3,
          examplesTotal: 4,
          traits: ["uses Carrier", "uses ShippingZone", "table-driven"],
          code: `shippingCost
    "Carrier-first lookup with zone adjustment."
    | base zoneMultiplier |
    self weight < 0
        ifTrue: [ InvalidWeight signal ].
    self subtotal >= 100
        ifTrue: [ ^ 0 ].
    base := Carrier
        baseCostFor: self weight
        method: (self carrier ifNil: [ #standard ]).
    zoneMultiplier := ShippingZone
        multiplierFor: self zone.
    ^ (base * zoneMultiplier) roundTo: 0.01`,
        },
        {
          label: "Flat + per-kg with zone surcharge",
          confidence: 0.61,
          examplesPassed: 2,
          examplesTotal: 4,
          traits: ["simple arithmetic", "no collaborator lookup"],
          code: `shippingCost
    "Flat fee + per-kg rate + zone surcharge."
    | flat perKg surcharge |
    self weight < 0
        ifTrue: [ InvalidWeight signal ].
    self subtotal >= 100
        ifTrue: [ ^ 0 ].
    flat := 5.00.
    perKg := 3.00.
    surcharge := self zone = #west
        ifTrue: [ 4.75 ]
        ifFalse: [ 0 ].
    ^ (flat + (self weight * perKg) + surcharge)
        roundTo: 0.01`,
        },
      ]);
      setPhase("reviewing");
    }, 2200);
  };

  const handleAccept = (candidateIdx, scope) => {
    const c = candidates[candidateIdx];
    setInstallLog({
      label: c.label,
      scope,
      time: new Date().toLocaleTimeString(),
    });
  };

  const reset = () => {
    setPhase("authoring");
    setCandidates([]);
    setInstallLog(null);
    if (synthTimer.current) clearTimeout(synthTimer.current);
  };

  return (
    <div style={{
      fontFamily: SANS,
      background: C.bg,
      color: C.text,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: `1px solid ${C.border}`,
        background: C.bgSurface,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{
            fontFamily: MONO,
            fontSize: 13,
            color: C.accent,
            fontWeight: 600,
          }}>Intent Console</span>
          <span style={{
            fontSize: 11,
            color: C.textDim,
            fontFamily: MONO,
          }}>screen 9 · behavior request authoring</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {phase === "reviewing" && (
            <button
              onClick={reset}
              style={{
                background: "none",
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                color: C.textMuted,
                fontFamily: MONO,
                fontSize: 11,
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >← back to intent</button>
          )}
          <span style={{
            fontSize: 10,
            fontFamily: MONO,
            padding: "3px 8px",
            borderRadius: 2,
            color: phase === "authoring" ? C.accent : phase === "synthesizing" ? C.blue : C.green,
            background: phase === "authoring" ? C.accentGlow : phase === "synthesizing" ? C.blueDim : C.greenDim,
          }}>
            {phase === "authoring" ? "composing" : phase === "synthesizing" ? "synthesizing" : "reviewing candidates"}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
      }}>
        {/* Left: Intent authoring */}
        <div style={{
          flex: phase === "reviewing" ? "0 0 420px" : 1,
          borderRight: `1px solid ${C.border}`,
          overflowY: "auto",
          padding: 20,
          transition: "flex 0.3s ease",
        }}>
          {/* Target + Selector */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Target</SectionLabel>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                style={{
                  background: C.bgRaised,
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  color: C.accent,
                  fontFamily: MONO,
                  fontSize: 13,
                  padding: "6px 10px",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                  paddingRight: 24,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b6050'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                }}
              >
                {DEMO_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span style={{ color: C.textDim, fontFamily: MONO, fontSize: 13 }}>&gt;&gt;</span>
              <input
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                style={{
                  background: C.bgRaised,
                  border: `1px solid ${C.borderActive}`,
                  borderRadius: 3,
                  color: C.text,
                  fontFamily: MONO,
                  fontSize: 13,
                  padding: "6px 10px",
                  outline: "none",
                  flex: 1,
                }}
                placeholder="selectorName"
              />
            </div>
          </div>

          {/* Intent */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel sub="What should this method do? Natural language.">Intent</SectionLabel>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: C.bgRaised,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                color: C.text,
                fontFamily: SANS,
                fontSize: 13,
                lineHeight: 1.5,
                padding: "10px 12px",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Constraints */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel sub="Semantic properties this method must satisfy.">Constraints</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CONSTRAINT_LIBRARY.map((c) => (
                <Tag
                  key={c.id}
                  active={constraints.includes(c.id)}
                  color={C.accent}
                  onClick={() => toggleConstraint(c.id)}
                >
                  {c.label}
                </Tag>
              ))}
            </div>
          </div>

          {/* Collaborators */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel sub="Which objects may this method interact with?">Trusted Collaborators</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {collaborators.map((c) => (
                <Tag
                  key={c.name}
                  active={c.trusted}
                  color={c.trusted ? C.green : C.textDim}
                  onClick={() => toggleCollaboratorTrust(c.name)}
                >
                  {c.trusted ? "✓ " : ""}{c.name}
                </Tag>
              ))}
            </div>
          </div>

          {/* Forbidden */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel sub="Things the synthesizer must NOT do.">Forbidden Shortcuts</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {forbidden.map((f, i) => (
                <Tag
                  key={i}
                  active
                  color={C.red}
                  onRemove={() => setForbidden((prev) => prev.filter((_, j) => j !== i))}
                >
                  {f}
                </Tag>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={newForbidden}
                onChange={(e) => setNewForbidden(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addForbidden()}
                placeholder="Add restriction…"
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  color: C.text,
                  fontFamily: SANS,
                  fontSize: 12,
                  padding: "5px 10px",
                  outline: "none",
                  flex: 1,
                }}
              />
              <button
                onClick={addForbidden}
                style={{
                  background: C.bgHover,
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  color: C.textMuted,
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "5px 10px",
                  cursor: "pointer",
                }}
              >add</button>
            </div>
          </div>

          {/* Examples */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel sub="Executable examples the synthesizer must satisfy.">Examples</SectionLabel>
            {examples.map((ex, i) => (
              <ExampleRow
                key={i}
                example={ex}
                index={i}
                onChange={(updated) =>
                  setExamples((prev) => prev.map((e, j) => (j === i ? updated : e)))
                }
                onRemove={() => setExamples((prev) => prev.filter((_, j) => j !== i))}
              />
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                onClick={addExample}
                style={{
                  background: "none",
                  border: `1px dashed ${C.border}`,
                  borderRadius: 3,
                  color: C.textDim,
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "5px 12px",
                  cursor: "pointer",
                }}
              >+ value example</button>
              <button
                onClick={() =>
                  setExamples((prev) => [...prev, { input: "", output: "", kind: "raise" }])
                }
                style={{
                  background: "none",
                  border: `1px dashed ${C.red}33`,
                  borderRadius: 3,
                  color: C.red,
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "5px 12px",
                  cursor: "pointer",
                  opacity: 0.7,
                }}
              >+ raise example</button>
            </div>
          </div>

          {/* Synthesize button */}
          {phase === "authoring" && (
            <button
              onClick={synthesize}
              style={{
                width: "100%",
                padding: "12px",
                background: `linear-gradient(135deg, ${C.accent}22, ${C.accent}11)`,
                border: `1px solid ${C.accent}55`,
                borderRadius: 4,
                color: C.accent,
                fontFamily: MONO,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.02em",
                transition: "all 0.15s",
              }}
            >
              synthesize candidates →
            </button>
          )}
          {phase === "synthesizing" && (
            <div style={{
              width: "100%",
              padding: "12px",
              background: C.blueDim,
              border: `1px solid ${C.blue}33`,
              borderRadius: 4,
              textAlign: "center",
            }}>
              <SynthDots />
            </div>
          )}
        </div>

        {/* Right: Candidates panel (only in reviewing phase) */}
        {phase === "reviewing" && (
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
          }}>
            <SectionLabel sub={`${candidates.length} candidates generated from intent + ${examples.length} examples`}>
              Candidate Implementations
            </SectionLabel>
            {candidates.map((c, i) => (
              <CandidateCard
                key={i}
                candidate={c}
                index={i}
                onAccept={(scope) => handleAccept(i, scope)}
              />
            ))}

            {installLog && (
              <div style={{
                marginTop: 16,
                padding: "12px 14px",
                background: C.greenDim,
                border: `1px solid ${C.green}33`,
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 12,
                color: C.green,
              }}>
                ✓ Installed "{installLog.label}" → {installLog.scope} scope at {installLog.time}
                <span style={{ color: C.textDim, marginLeft: 8 }}>
                  (provisional · 4 examples · {targetClass}&gt;&gt;{selector})
                </span>
              </div>
            )}

            {/* Preview: what the method annotation would look like */}
            <div style={{
              marginTop: 20,
              padding: "14px",
              background: C.bgSurface,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
            }}>
              <SectionLabel>Generated Method Annotation Preview</SectionLabel>
              <pre style={{
                margin: 0,
                fontFamily: MONO,
                fontSize: 12,
                lineHeight: 1.6,
                color: C.textMuted,
                whiteSpace: "pre-wrap",
              }}>
{`${targetClass}>>${selector}
    <intent: '${intent.slice(0, 80)}${intent.length > 80 ? "…" : ""}'>
    <constraints: #(${constraints.join(" ")})>
    <collaborators: #(${collaborators.filter((c) => c.trusted).map((c) => c.name).join(" ")})>
    <examplesFrom: #${selector}Examples>
    <provenance: #synthesized ${new Date().toISOString().slice(0, 10)}>
    <status: #provisional>`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
