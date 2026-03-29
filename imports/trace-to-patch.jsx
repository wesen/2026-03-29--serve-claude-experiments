import { useState, useEffect, useRef } from "react";

const MONO = "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'IBM Plex Sans', 'DM Sans', system-ui, sans-serif";

const C = {
  bg: "#131118",
  bgSurface: "#1a1722",
  bgRaised: "#211e2b",
  bgHover: "#2a2636",
  border: "#302b3d",
  borderActive: "#4e3f6e",
  text: "#ddd6ee",
  textMuted: "#8f86a3",
  textDim: "#5e5672",
  accent: "#b07aff",
  accentDim: "#7b4fc4",
  accentGlow: "rgba(176,122,255,0.10)",
  green: "#6ecf8e",
  greenDim: "rgba(110,207,142,0.12)",
  red: "#e06c75",
  redDim: "rgba(224,108,117,0.12)",
  redBright: "#ff8a93",
  blue: "#61afef",
  blueDim: "rgba(97,175,239,0.12)",
  amber: "#d4a856",
  amberDim: "rgba(212,168,86,0.12)",
  cyan: "#56b6c2",
  cyanDim: "rgba(86,182,194,0.12)",
};

// Simulated stack frames
const STACK_FRAMES = [
  {
    id: 0,
    selector: "Order>>totalWithShipping",
    class: "Order",
    method: "totalWithShipping",
    line: 5,
    isFailing: true,
    code: `totalWithShipping
    "Compute total including shipping."
    | shipping |
    shipping := self shippingCost.
    ^ self subtotal + shipping + self tax`,
    locals: [
      { name: "self", value: "an Order (subtotal: 89.99, items: 3)", type: "Order" },
      { name: "shipping", value: "nil", type: "UndefinedObject" },
    ],
  },
  {
    id: 1,
    selector: "Order>>shippingCost",
    class: "Order",
    method: "shippingCost",
    isFailing: false,
    isOrigin: true,
    code: `shippingCost
    "Missing method — no implementation found."
    self doesNotUnderstand:
        (Message selector: #shippingCost)`,
    locals: [
      { name: "self", value: "an Order (subtotal: 89.99, items: 3, zone: #east, weight: 2.3)", type: "Order" },
    ],
  },
  {
    id: 2,
    selector: "Cart>>checkout",
    class: "Cart",
    method: "checkout",
    isFailing: false,
    code: `checkout
    | order receipt |
    order := self buildOrder.
    receipt := order totalWithShipping.
    self confirm: receipt for: self customer`,
    locals: [
      { name: "self", value: "a Cart (3 items, customer: #jane)", type: "Cart" },
      { name: "order", value: "an Order (subtotal: 89.99)", type: "Order" },
      { name: "receipt", value: "nil", type: "UndefinedObject" },
    ],
  },
  {
    id: 3,
    selector: "CheckoutController>>handleSubmit:",
    class: "CheckoutController",
    method: "handleSubmit:",
    isFailing: false,
    code: `handleSubmit: event
    | cart |
    cart := self currentCart.
    cart checkout`,
    locals: [
      { name: "self", value: "a CheckoutController", type: "CheckoutController" },
      { name: "event", value: "a SubmitEvent", type: "SubmitEvent" },
      { name: "cart", value: "a Cart (3 items)", type: "Cart" },
    ],
  },
];

const CANDIDATE_PATCHES = [
  {
    id: 0,
    label: "Zone-based rate table lookup",
    confidence: 0.91,
    strategy: "upstream fix",
    description: "Add Order>>shippingCost using ShippingZone rate table. Handles free shipping for orders over $100.",
    examplesPassed: 3,
    examplesTotal: 3,
    affectedClasses: ["Order"],
    blastRadius: "low",
    code: `shippingCost
    "Zone-based shipping from rate table."
    | rate |
    self subtotal >= 100 ifTrue: [ ^ 0 ].
    rate := ShippingZone
        rateFor: self zone
        weight: self weight.
    ^ rate roundTo: 0.01`,
    regressionTests: [
      { input: "Order new subtotal: 150; zone: #east", expect: "0", status: "pass" },
      { input: "Order new subtotal: 50; zone: #east; weight: 2.0", expect: "9.50", status: "pass" },
      { input: "Order new subtotal: 50; zone: #west; weight: 1.0", expect: "7.25", status: "pass" },
    ],
  },
  {
    id: 1,
    label: "Flat + per-kg with zone surcharge",
    confidence: 0.72,
    strategy: "upstream fix",
    description: "Simple arithmetic: flat fee + weight-based cost + zone premium. No collaborator dependency.",
    examplesPassed: 2,
    examplesTotal: 3,
    affectedClasses: ["Order"],
    blastRadius: "low",
    code: `shippingCost
    "Flat rate plus per-kg cost."
    | base |
    self subtotal >= 100 ifTrue: [ ^ 0 ].
    base := 5.00 + (self weight * 3.00).
    self zone = #west
        ifTrue: [ base := base + 4.75 ].
    ^ base roundTo: 0.01`,
    regressionTests: [
      { input: "Order new subtotal: 150; zone: #east", expect: "0", status: "pass" },
      { input: "Order new subtotal: 50; zone: #east; weight: 2.0", expect: "11.00", status: "fail" },
      { input: "Order new subtotal: 50; zone: #west; weight: 1.0", expect: "12.75", status: "pass" },
    ],
  },
  {
    id: 2,
    label: "Guard + default zero (downstream)",
    confidence: 0.45,
    strategy: "downstream patch",
    description: "Patch totalWithShipping to handle nil shipping gracefully instead of fixing the missing method.",
    examplesPassed: 1,
    examplesTotal: 3,
    affectedClasses: ["Order"],
    blastRadius: "medium",
    code: `totalWithShipping
    "Patched: handle nil shipping."
    | shipping |
    shipping := [ self shippingCost ]
        on: MessageNotUnderstood
        do: [ :ex | 0 ].
    ^ self subtotal + shipping + self tax`,
    regressionTests: [
      { input: "Order new subtotal: 50; tax: 4.50", expect: "54.50", status: "pass" },
      { input: "Order new subtotal: 50; zone: #east; weight: 2.0", expect: "includes shipping", status: "fail" },
      { input: "Full checkout flow", expect: "no error", status: "fail" },
    ],
  },
];

function Tag({ children, color = C.accent, active = true, small, onClick, style = {} }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "1px 6px" : "2px 8px",
        borderRadius: 3,
        fontSize: small ? 10 : 11,
        fontFamily: MONO,
        color: active ? color : C.textDim,
        background: active ? `${color}18` : "transparent",
        border: `1px solid ${active ? color + "33" : "transparent"}`,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children, sub, right }) {
  return (
    <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <div>
        <div style={{
          fontSize: 10,
          fontFamily: MONO,
          color: C.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>{children}</div>
        {sub && <div style={{ fontSize: 11, fontFamily: SANS, color: C.textDim, marginTop: 1 }}>{sub}</div>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

// Stack frame row
function StackFrame({ frame, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        cursor: "pointer",
        background: selected ? C.accentGlow : "transparent",
        borderLeft: `2px solid ${frame.isOrigin ? C.red : selected ? C.accent : "transparent"}`,
        transition: "all 0.1s",
      }}
    >
      {frame.isOrigin && (
        <span style={{
          fontSize: 9,
          fontFamily: MONO,
          color: C.redBright,
          background: C.redDim,
          padding: "1px 5px",
          borderRadius: 2,
          flexShrink: 0,
        }}>MNU</span>
      )}
      {frame.isFailing && !frame.isOrigin && (
        <span style={{
          fontSize: 9,
          fontFamily: MONO,
          color: C.amber,
          background: C.amberDim,
          padding: "1px 5px",
          borderRadius: 2,
          flexShrink: 0,
        }}>err</span>
      )}
      <span style={{
        fontFamily: MONO,
        fontSize: 12,
        color: selected ? C.text : C.textMuted,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {frame.selector}
      </span>
    </div>
  );
}

// Local variable row
function LocalRow({ local }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "80px 1fr 70px",
      gap: 6,
      padding: "4px 0",
      fontSize: 12,
      fontFamily: MONO,
      borderBottom: `1px solid ${C.border}44`,
    }}>
      <span style={{ color: C.cyan }}>{local.name}</span>
      <span style={{
        color: local.value === "nil" ? C.red : C.text,
        opacity: local.value === "nil" ? 0.7 : 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>{local.value}</span>
      <span style={{ color: C.textDim, textAlign: "right" }}>{local.type}</span>
    </div>
  );
}

// Code pane with line highlighting
function CodePane({ code, highlightLine, isOrigin }) {
  const lines = code.split("\n");
  return (
    <div style={{
      background: C.bg,
      borderRadius: 4,
      border: `1px solid ${C.border}`,
      overflow: "hidden",
    }}>
      <pre style={{
        margin: 0,
        padding: "10px 0",
        fontFamily: MONO,
        fontSize: 12,
        lineHeight: 1.7,
      }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              padding: "0 14px 0 10px",
              display: "flex",
              background: isOrigin && i >= 2 ? C.redDim : "transparent",
            }}
          >
            <span style={{
              width: 28,
              flexShrink: 0,
              color: C.textDim,
              textAlign: "right",
              marginRight: 12,
              userSelect: "none",
            }}>{i + 1}</span>
            <span style={{ color: isOrigin && i >= 2 ? C.redBright : C.text }}>
              {line}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}

// Regression test row
function TestRow({ test }) {
  const pass = test.status === "pass";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 0",
      fontSize: 11,
      fontFamily: MONO,
      borderBottom: `1px solid ${C.border}33`,
    }}>
      <span style={{
        color: pass ? C.green : C.red,
        fontSize: 13,
        width: 16,
        textAlign: "center",
        flexShrink: 0,
      }}>{pass ? "✓" : "✗"}</span>
      <span style={{ color: C.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {test.input}
      </span>
      <span style={{ color: pass ? C.green : C.red, opacity: 0.8 }}>
        → {test.expect}
      </span>
    </div>
  );
}

// Candidate patch card
function PatchCard({ patch, expanded, onToggle, onApply }) {
  const stratColor = patch.strategy === "upstream fix" ? C.blue : C.amber;
  const confColor = patch.confidence > 0.8 ? C.green : patch.confidence > 0.5 ? C.amber : C.red;

  return (
    <div style={{
      background: C.bgSurface,
      border: `1px solid ${expanded ? C.accent + "55" : C.border}`,
      borderRadius: 4,
      marginBottom: 8,
      overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          cursor: "pointer",
          background: expanded ? C.accentGlow : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: MONO,
            fontSize: 11,
            color: C.textDim,
            flexShrink: 0,
          }}>#{patch.id + 1}</span>
          <span style={{
            fontFamily: MONO,
            fontSize: 12,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{patch.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0. }}>
          <Tag color={stratColor} small>{patch.strategy}</Tag>
          <Tag color={confColor} small>{Math.round(patch.confidence * 100)}%</Tag>
          <span style={{
            color: C.textDim,
            fontSize: 12,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}>▾</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <div style={{ padding: "10px 14px", fontSize: 12, fontFamily: SANS, color: C.textMuted, lineHeight: 1.5 }}>
            {patch.description}
          </div>

          {/* Code */}
          <pre style={{
            margin: 0,
            padding: "12px 14px",
            fontFamily: MONO,
            fontSize: 12,
            lineHeight: 1.6,
            color: C.text,
            background: C.bg,
            whiteSpace: "pre-wrap",
            borderTop: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
          }}>{patch.code}</pre>

          {/* Regression tests */}
          <div style={{ padding: "10px 14px" }}>
            <div style={{
              fontSize: 10,
              fontFamily: MONO,
              color: C.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}>
              Inferred Regression Tests — {patch.examplesPassed}/{patch.examplesTotal} pass
            </div>
            {patch.regressionTests.map((t, i) => (
              <TestRow key={i} test={t} />
            ))}
          </div>

          {/* Action bar */}
          <div style={{
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${C.border}`,
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              <Tag color={patch.blastRadius === "low" ? C.green : C.amber} small>
                blast radius: {patch.blastRadius}
              </Tag>
              {patch.affectedClasses.map((cls) => (
                <Tag key={cls} color={C.blue} small>→ {cls}</Tag>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => onApply("object")}
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
              >patch → object</button>
              <button
                onClick={() => onApply("class")}
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
              >patch → class</button>
              <button
                onClick={() => onApply("resume")}
                style={{
                  background: C.accentGlow,
                  border: `1px solid ${C.accent}55`,
                  borderRadius: 3,
                  color: C.accent,
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >patch + resume ▶</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Pulsing dot
function PulseDot({ color }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 800);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{
      display: "inline-block",
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: color,
      opacity: on ? 1 : 0.3,
      transition: "opacity 0.4s",
      boxShadow: on ? `0 0 6px ${color}66` : "none",
      flexShrink: 0,
    }} />
  );
}

export default function TraceToPatchDebugger() {
  const [selectedFrame, setSelectedFrame] = useState(1); // origin frame
  const [expandedPatch, setExpandedPatch] = useState(0);
  const [appliedPatch, setAppliedPatch] = useState(null);
  const [showInferred, setShowInferred] = useState(true);

  const frame = STACK_FRAMES[selectedFrame];

  const handleApply = (patchId, scope) => {
    setAppliedPatch({ patchId, scope, time: new Date().toLocaleTimeString() });
  };

  return (
    <div style={{
      fontFamily: SANS,
      background: C.bg,
      color: C.text,
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 18px",
        borderBottom: `1px solid ${C.border}`,
        background: C.bgSurface,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PulseDot color={C.red} />
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.redBright, fontWeight: 600 }}>
            MessageNotUnderstood
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.textMuted }}>
            Order&gt;&gt;shippingCost
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Tag color={C.accent}>screen 5</Tag>
          <span style={{
            fontSize: 10,
            fontFamily: MONO,
            color: C.textDim,
          }}>Trace-to-Patch Debugger</span>
        </div>
      </div>

      {/* Error summary ribbon */}
      <div style={{
        padding: "8px 18px",
        background: C.redDim,
        borderBottom: `1px solid ${C.red}22`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.redBright }}>
          Order does not understand #shippingCost
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.textDim }}>
          sent from Order&gt;&gt;totalWithShipping line 4
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.textMuted }}>
          receiver: an Order (subtotal: 89.99, zone: #east, weight: 2.3)
        </span>
      </div>

      {/* Main 3-column layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left column: Stack + Locals */}
        <div style={{
          width: 280,
          flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Stack */}
          <div style={{
            flex: "0 0 auto",
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{
              padding: "10px 12px 6px",
              fontSize: 10,
              fontFamily: MONO,
              color: C.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}>Call Stack</div>
            {STACK_FRAMES.map((f) => (
              <StackFrame
                key={f.id}
                frame={f}
                selected={selectedFrame === f.id}
                onClick={() => setSelectedFrame(f.id)}
              />
            ))}
          </div>

          {/* Locals */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
            <div style={{
              fontSize: 10,
              fontFamily: MONO,
              color: C.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}>Locals — {frame.selector}</div>
            {frame.locals.map((l, i) => (
              <LocalRow key={i} local={l} />
            ))}

            {/* Inferred intent */}
            {frame.isOrigin && showInferred && (
              <div style={{
                marginTop: 16,
                padding: "10px 12px",
                background: C.accentGlow,
                border: `1px solid ${C.accent}33`,
                borderRadius: 4,
              }}>
                <div style={{
                  fontSize: 10,
                  fontFamily: MONO,
                  color: C.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}>Inferred Intent</div>
                <div style={{
                  fontSize: 12,
                  fontFamily: SANS,
                  color: C.text,
                  lineHeight: 1.5,
                }}>
                  Compute shipping cost for this order based on zone, weight, and possibly carrier. Called by <span style={{ color: C.cyan, fontFamily: MONO }}>totalWithShipping</span> which expects a numeric return.
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Tag color={C.blue} small>reads: zone, weight</Tag>
                  <Tag color={C.green} small>returns: Number</Tag>
                  <Tag color={C.amber} small>caller expects: addable</Tag>
                </div>
              </div>
            )}

            {/* Similar protocol */}
            {frame.isOrigin && (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  fontSize: 10,
                  fontFamily: MONO,
                  color: C.textDim,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}>Similar Protocol Nearby</div>
                {[
                  { cls: "Invoice", sel: "shippingFee", confidence: "87%" },
                  { cls: "Subscription", sel: "deliveryCost", confidence: "64%" },
                  { cls: "Quote", sel: "estimatedShipping", confidence: "52%" },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    fontSize: 11,
                    fontFamily: MONO,
                    borderBottom: `1px solid ${C.border}33`,
                  }}>
                    <span style={{ color: C.textMuted }}>
                      {s.cls}&gt;&gt;{s.sel}
                    </span>
                    <span style={{ color: C.accent, opacity: 0.7 }}>{s.confidence}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center column: Source code */}
        <div style={{
          flex: "0 0 340px",
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "10px 14px 6px",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}>
            <span style={{
              fontSize: 10,
              fontFamily: MONO,
              color: C.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}>Source</span>
            <span style={{
              fontSize: 12,
              fontFamily: MONO,
              color: frame.isOrigin ? C.redBright : C.accent,
            }}>{frame.selector}</span>
          </div>
          <div style={{ padding: "0 14px 14px", flex: 1, overflowY: "auto" }}>
            <CodePane code={frame.code} isOrigin={frame.isOrigin} />

            {/* Upstream / downstream indicator */}
            {frame.isOrigin && (
              <div style={{
                marginTop: 12,
                padding: "10px 12px",
                background: C.bgSurface,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
              }}>
                <div style={{
                  fontSize: 10,
                  fontFamily: MONO,
                  color: C.textDim,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}>Repair Strategies</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: MONO }}>
                    <span style={{ color: C.blue }}>↑</span>
                    <span style={{ color: C.blue }}>upstream</span>
                    <span style={{ color: C.textDim }}>— add the missing method</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: MONO }}>
                    <span style={{ color: C.amber }}>↓</span>
                    <span style={{ color: C.amber }}>downstream</span>
                    <span style={{ color: C.textDim }}>— patch the caller to survive</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: MONO }}>
                    <span style={{ color: C.accent }}>⟳</span>
                    <span style={{ color: C.accent }}>lateral</span>
                    <span style={{ color: C.textDim }}>— delegate to a collaborator</span>
                  </div>
                </div>
              </div>
            )}

            {/* Execution context for non-origin frames */}
            {!frame.isOrigin && (
              <div style={{
                marginTop: 12,
                padding: "10px 12px",
                background: C.bgSurface,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                fontSize: 12,
                fontFamily: SANS,
                color: C.textMuted,
                lineHeight: 1.5,
              }}>
                {frame.isFailing
                  ? "This frame receives the error when shippingCost returns nil instead of a number. The + on line 5 fails."
                  : "This frame is upstream in the call chain. No error at this level yet."
                }
              </div>
            )}
          </div>
        </div>

        {/* Right column: Candidate patches */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "10px 14px 6px",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}>
            <span style={{
              fontSize: 10,
              fontFamily: MONO,
              color: C.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}>Candidate Patches</span>
            <span style={{
              fontSize: 11,
              fontFamily: MONO,
              color: C.textMuted,
            }}>{CANDIDATE_PATCHES.length} generated</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
            {CANDIDATE_PATCHES.map((p) => (
              <PatchCard
                key={p.id}
                patch={p}
                expanded={expandedPatch === p.id}
                onToggle={() => setExpandedPatch(expandedPatch === p.id ? -1 : p.id)}
                onApply={(scope) => handleApply(p.id, scope)}
              />
            ))}

            {/* Applied patch confirmation */}
            {appliedPatch && (
              <div style={{
                marginTop: 10,
                padding: "12px 14px",
                background: C.greenDim,
                border: `1px solid ${C.green}33`,
                borderRadius: 4,
                fontFamily: MONO,
                fontSize: 12,
                color: C.green,
                lineHeight: 1.6,
              }}>
                ✓ Patch #{appliedPatch.patchId + 1} applied → {appliedPatch.scope === "resume" ? "class + execution resumed" : `${appliedPatch.scope} scope`}
                <br />
                <span style={{ color: C.textDim }}>
                  {appliedPatch.scope === "resume"
                    ? "Method installed and execution continued from call site."
                    : "Method installed as provisional. Run examples to stabilize."}
                </span>
              </div>
            )}

            {/* Debugger action bar */}
            <div style={{
              marginTop: 14,
              padding: "10px 12px",
              background: C.bgSurface,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}>
              <button style={{
                background: C.bgHover,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                color: C.textMuted,
                fontFamily: MONO,
                fontSize: 11,
                padding: "5px 12px",
                cursor: "pointer",
              }}>step into</button>
              <button style={{
                background: C.bgHover,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                color: C.textMuted,
                fontFamily: MONO,
                fontSize: 11,
                padding: "5px 12px",
                cursor: "pointer",
              }}>step over</button>
              <button style={{
                background: C.bgHover,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                color: C.textMuted,
                fontFamily: MONO,
                fontSize: 11,
                padding: "5px 12px",
                cursor: "pointer",
              }}>proceed</button>
              <button style={{
                background: C.bgHover,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                color: C.red,
                fontFamily: MONO,
                fontSize: 11,
                padding: "5px 12px",
                cursor: "pointer",
              }}>abandon</button>
              <div style={{ flex: 1 }} />
              <button style={{
                background: C.accentGlow,
                border: `1px solid ${C.accent}44`,
                borderRadius: 3,
                color: C.accent,
                fontFamily: MONO,
                fontSize: 11,
                padding: "5px 12px",
                cursor: "pointer",
                fontWeight: 600,
              }}>open in Intent Console →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
