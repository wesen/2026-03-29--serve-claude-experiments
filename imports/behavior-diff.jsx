import { useState, useRef } from "react";

const MONO = "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'IBM Plex Sans', 'DM Sans', system-ui, sans-serif";

const C = {
  bg: "#12110f",
  bgSurface: "#1a1916",
  bgRaised: "#22211d",
  bgHover: "#2b2a25",
  border: "#353329",
  borderActive: "#4e4a3a",
  text: "#ddd6c4",
  textMuted: "#918a78",
  textDim: "#5e5847",
  accent: "#c49a4a",
  accentGlow: "rgba(196,154,74,0.10)",
  green: "#7ab87a",
  greenBg: "rgba(122,184,122,0.08)",
  greenLine: "rgba(122,184,122,0.18)",
  red: "#c47272",
  redBg: "rgba(196,114,114,0.08)",
  redLine: "rgba(196,114,114,0.18)",
  blue: "#6b9fcc",
  blueDim: "rgba(107,159,204,0.10)",
  purple: "#a88bc7",
  purpleDim: "rgba(168,139,199,0.10)",
  amber: "#d4a856",
  amberDim: "rgba(212,168,86,0.10)",
  cyan: "#6bc4b4",
  cyanDim: "rgba(107,196,180,0.10)",
};

// Version history for Order>>shippingCost
const VERSIONS = [
  {
    id: "v1",
    version: 1,
    timestamp: "Mar 12, 10:42 am",
    origin: "synthesized",
    originDetail: "Intent Console → 3 candidates → #1 selected",
    author: "system",
    trigger: "MessageNotUnderstood in Order>>totalWithShipping",
    status: "superseded",
    confidence: 0.91,
    examplesCovered: 3,
    examplesTotal: 3,
    collaborators: ["ShippingZone"],
    code: `shippingCost
    "Zone-based shipping from rate table."
    | rate |
    self subtotal >= 100 ifTrue: [ ^ 0 ].
    rate := ShippingZone
        rateFor: self zone
        weight: self weight.
    ^ rate roundTo: 0.01`,
  },
  {
    id: "v2",
    version: 2,
    timestamp: "Mar 12, 11:15 am",
    origin: "human-edited",
    originDetail: "Developer modified guard clause, added carrier lookup",
    author: "jane",
    trigger: "Manual edit after code review",
    status: "superseded",
    confidence: null,
    examplesCovered: 4,
    examplesTotal: 5,
    collaborators: ["ShippingZone", "Carrier"],
    code: `shippingCost
    "Zone-based shipping with carrier override."
    | rate carrier |
    self weight <= 0 ifTrue: [ InvalidWeight signal ].
    self subtotal >= 100 ifTrue: [ ^ 0 ].
    carrier := self carrier ifNil: [ #standard ].
    rate := ShippingZone
        rateFor: self zone
        weight: self weight
        carrier: carrier.
    ^ rate roundTo: 0.01`,
  },
  {
    id: "v3",
    version: 3,
    timestamp: "Mar 13, 2:30 pm",
    origin: "re-synthesized",
    originDetail: "Domain rule change: international zones added. System re-proposed from updated examples.",
    author: "system",
    trigger: "Example drift detected — 2 new zone examples failed v2",
    status: "superseded",
    confidence: 0.87,
    examplesCovered: 7,
    examplesTotal: 7,
    collaborators: ["ShippingZone", "Carrier"],
    code: `shippingCost
    "Zone-based shipping, domestic + international."
    | rate carrier zone |
    self weight <= 0 ifTrue: [ InvalidWeight signal ].
    self subtotal >= 100 ifTrue: [ ^ 0 ].
    carrier := self carrier ifNil: [ #standard ].
    zone := ShippingZone for: self zone.
    zone isInternational
        ifTrue: [
            rate := zone internationalRate: self weight carrier: carrier ]
        ifFalse: [
            rate := zone domesticRate: self weight carrier: carrier ].
    ^ rate roundTo: 0.01`,
  },
  {
    id: "v4",
    version: 4,
    timestamp: "Mar 14, 9:05 am",
    origin: "human-edited",
    originDetail: "Developer added express surcharge logic, kept international structure",
    author: "jane",
    trigger: "New requirement: express shipping premium",
    status: "current",
    confidence: null,
    examplesCovered: 9,
    examplesTotal: 10,
    collaborators: ["ShippingZone", "Carrier"],
    driftWarnings: ["Example #10 (express + international + heavy) fails — returns 42.50, expected 39.99"],
    code: `shippingCost
    "Zone-based shipping, domestic + international + express."
    | rate carrier zone |
    self weight <= 0 ifTrue: [ InvalidWeight signal ].
    self subtotal >= 100 ifTrue: [ ^ 0 ].
    carrier := self carrier ifNil: [ #standard ].
    zone := ShippingZone for: self zone.
    zone isInternational
        ifTrue: [
            rate := zone internationalRate: self weight carrier: carrier ]
        ifFalse: [
            rate := zone domesticRate: self weight carrier: carrier ].
    carrier = #express ifTrue: [
        rate := rate * 1.4 ].
    ^ rate roundTo: 0.01`,
  },
];

// Compute simple diff between two code strings
function computeDiff(oldCode, newCode) {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  const result = [];
  let oi = 0, ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    const ol = oi < oldLines.length ? oldLines[oi] : null;
    const nl = ni < newLines.length ? newLines[ni] : null;

    if (ol === nl) {
      result.push({ kind: "same", text: ol });
      oi++; ni++;
    } else if (nl !== null && (ol === null || !oldLines.slice(oi).includes(nl))) {
      result.push({ kind: "add", text: nl });
      ni++;
    } else if (ol !== null && (nl === null || !newLines.slice(ni).includes(ol))) {
      result.push({ kind: "remove", text: ol });
      oi++;
    } else {
      // line exists later in old — it was added before it
      result.push({ kind: "add", text: nl });
      ni++;
    }
  }
  return result;
}

function Tag({ children, color = C.accent, small, style = {} }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: small ? "1px 5px" : "2px 8px",
      borderRadius: 2,
      fontSize: small ? 9 : 10,
      fontFamily: MONO,
      color,
      background: `${color}18`,
      border: `1px solid ${color}28`,
      whiteSpace: "nowrap",
      ...style,
    }}>{children}</span>
  );
}

// Origin badge
function OriginBadge({ origin }) {
  const config = {
    synthesized: { color: C.purple, label: "synthesized", icon: "◇" },
    "human-edited": { color: C.green, label: "human-edited", icon: "✎" },
    "re-synthesized": { color: C.amber, label: "re-synthesized", icon: "⟳" },
  };
  const c = config[origin] || config.synthesized;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 8px",
      borderRadius: 2,
      fontSize: 11,
      fontFamily: MONO,
      color: c.color,
      background: `${c.color}15`,
      border: `1px solid ${c.color}25`,
    }}>
      <span style={{ fontSize: 12 }}>{c.icon}</span>
      {c.label}
    </span>
  );
}

// Timeline node
function TimelineNode({ version, isSelected, isCompareA, isCompareB, onClick, onSetA, onSetB }) {
  const statusColor = version.status === "current" ? C.green :
    version.status === "superseded" ? C.textDim : C.amber;
  const originColor = version.origin === "synthesized" ? C.purple :
    version.origin === "human-edited" ? C.green : C.amber;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        cursor: "pointer",
        position: "relative",
      }}
    >
      {/* Timeline rail */}
      <div style={{
        width: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
        position: "relative",
      }}>
        <div style={{
          width: 1,
          flex: 1,
          background: version.version === 1 ? "transparent" : C.border,
        }} />
        <div style={{
          width: isSelected ? 14 : 10,
          height: isSelected ? 14 : 10,
          borderRadius: "50%",
          background: isSelected ? originColor : C.bgRaised,
          border: `2px solid ${isSelected ? originColor : C.border}`,
          flexShrink: 0,
          transition: "all 0.15s",
          boxShadow: isSelected ? `0 0 8px ${originColor}44` : "none",
        }} />
        <div style={{
          width: 1,
          flex: 1,
          background: version.status === "current" ? "transparent" : C.border,
        }} />
      </div>

      {/* Card */}
      <div style={{
        flex: 1,
        padding: "8px 12px",
        margin: "3px 0",
        background: isSelected ? `${originColor}08` : "transparent",
        border: `1px solid ${isSelected ? originColor + "33" : "transparent"}`,
        borderRadius: 4,
        transition: "all 0.15s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontFamily: MONO,
              fontSize: 12,
              color: isSelected ? C.text : C.textMuted,
              fontWeight: isSelected ? 600 : 400,
            }}>v{version.version}</span>
            <OriginBadge origin={version.origin} />
            {version.status === "current" && <Tag color={C.green} small>current</Tag>}
            {version.driftWarnings && <Tag color={C.red} small>⚠ drift</Tag>}
          </div>
          <span style={{ fontSize: 10, fontFamily: MONO, color: C.textDim }}>{version.timestamp}</span>
        </div>

        <div style={{ fontSize: 11, fontFamily: SANS, color: C.textDim, marginTop: 4, lineHeight: 1.4 }}>
          {version.trigger}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 10, fontFamily: MONO, color: C.textDim }}>
            by {version.author}
          </span>
          {version.confidence !== null && (
            <Tag color={version.confidence > 0.8 ? C.green : C.amber} small>
              {Math.round(version.confidence * 100)}% conf
            </Tag>
          )}
          <Tag color={C.blue} small>
            {version.examplesCovered}/{version.examplesTotal} examples
          </Tag>
          {/* Compare selectors */}
          <div style={{ flex: 1 }} />
          <button
            onClick={(e) => { e.stopPropagation(); onSetA(); }}
            style={{
              background: isCompareA ? `${C.cyan}22` : "transparent",
              border: `1px solid ${isCompareA ? C.cyan + "55" : C.border}`,
              borderRadius: 2,
              color: isCompareA ? C.cyan : C.textDim,
              fontFamily: MONO,
              fontSize: 9,
              padding: "1px 6px",
              cursor: "pointer",
            }}
          >A</button>
          <button
            onClick={(e) => { e.stopPropagation(); onSetB(); }}
            style={{
              background: isCompareB ? `${C.accent}22` : "transparent",
              border: `1px solid ${isCompareB ? C.accent + "55" : C.border}`,
              borderRadius: 2,
              color: isCompareB ? C.accent : C.textDim,
              fontFamily: MONO,
              fontSize: 9,
              padding: "1px 6px",
              cursor: "pointer",
            }}
          >B</button>
        </div>
      </div>
    </div>
  );
}

// Diff viewer
function DiffView({ versionA, versionB }) {
  const diff = computeDiff(versionA.code, versionB.code);
  let lineNumOld = 0;
  let lineNumNew = 0;

  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      overflow: "hidden",
    }}>
      {/* Diff header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 14px",
        borderBottom: `1px solid ${C.border}`,
        background: C.bgRaised,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Tag color={C.cyan} small>A: v{versionA.version}</Tag>
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.textDim }}>→</span>
          <Tag color={C.accent} small>B: v{versionB.version}</Tag>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontFamily: MONO, color: C.green }}>
            +{diff.filter((d) => d.kind === "add").length}
          </span>
          <span style={{ fontSize: 10, fontFamily: MONO, color: C.red }}>
            −{diff.filter((d) => d.kind === "remove").length}
          </span>
        </div>
      </div>

      {/* Diff lines */}
      <pre style={{
        margin: 0,
        padding: "8px 0",
        fontFamily: MONO,
        fontSize: 12,
        lineHeight: 1.7,
        overflowX: "auto",
      }}>
        {diff.map((line, i) => {
          if (line.kind === "same") { lineNumOld++; lineNumNew++; }
          else if (line.kind === "add") { lineNumNew++; }
          else { lineNumOld++; }

          const bgColor = line.kind === "add" ? C.greenBg :
            line.kind === "remove" ? C.redBg : "transparent";
          const lineColor = line.kind === "add" ? C.greenLine :
            line.kind === "remove" ? C.redLine : "transparent";
          const textColor = line.kind === "add" ? C.green :
            line.kind === "remove" ? C.red : C.text;
          const prefix = line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " ";
          const ln = line.kind === "remove" ? lineNumOld : lineNumNew;

          return (
            <div key={i} style={{
              display: "flex",
              padding: "0 14px 0 0",
              background: bgColor,
              borderLeft: `3px solid ${lineColor}`,
            }}>
              <span style={{
                width: 32,
                textAlign: "right",
                color: C.textDim,
                fontSize: 10,
                paddingRight: 8,
                userSelect: "none",
                flexShrink: 0,
                paddingTop: 1,
              }}>{ln}</span>
              <span style={{
                width: 16,
                color: textColor,
                textAlign: "center",
                flexShrink: 0,
                fontWeight: line.kind !== "same" ? 600 : 400,
              }}>{prefix}</span>
              <span style={{ color: textColor, opacity: line.kind === "remove" ? 0.7 : 1 }}>
                {line.text}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

// Provenance detail for selected version
function ProvenanceDetail({ version }) {
  const originColor = version.origin === "synthesized" ? C.purple :
    version.origin === "human-edited" ? C.green : C.amber;

  return (
    <div style={{
      padding: "14px 16px",
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
        marginBottom: 10,
      }}>Provenance — v{version.version}</div>

      {/* Origin chain */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <OriginBadge origin={version.origin} />
          <span style={{ fontSize: 11, fontFamily: SANS, color: C.textMuted }}>{version.originDetail}</span>
        </div>
      </div>

      {/* Metadata grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: "6px 12px",
        fontSize: 12,
        fontFamily: MONO,
      }}>
        <span style={{ color: C.textDim }}>author</span>
        <span style={{ color: C.text }}>{version.author}</span>

        <span style={{ color: C.textDim }}>trigger</span>
        <span style={{ color: C.text }}>{version.trigger}</span>

        <span style={{ color: C.textDim }}>confidence</span>
        <span style={{ color: version.confidence !== null ? (version.confidence > 0.8 ? C.green : C.amber) : C.textDim }}>
          {version.confidence !== null ? `${Math.round(version.confidence * 100)}%` : "n/a (human)"}
        </span>

        <span style={{ color: C.textDim }}>examples</span>
        <span style={{ color: version.examplesCovered === version.examplesTotal ? C.green : C.amber }}>
          {version.examplesCovered}/{version.examplesTotal} passing
        </span>

        <span style={{ color: C.textDim }}>collaborators</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {version.collaborators.map((c) => (
            <Tag key={c} color={C.blue} small>{c}</Tag>
          ))}
        </div>

        <span style={{ color: C.textDim }}>status</span>
        <span style={{
          color: version.status === "current" ? C.green : C.textDim,
        }}>{version.status}</span>
      </div>

      {/* Drift warnings */}
      {version.driftWarnings && version.driftWarnings.length > 0 && (
        <div style={{
          marginTop: 12,
          padding: "8px 10px",
          background: C.redBg,
          border: `1px solid ${C.red}22`,
          borderRadius: 3,
        }}>
          <div style={{
            fontSize: 10,
            fontFamily: MONO,
            color: C.red,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 4,
          }}>⚠ Drift Warnings</div>
          {version.driftWarnings.map((w, i) => (
            <div key={i} style={{
              fontSize: 11,
              fontFamily: SANS,
              color: C.red,
              lineHeight: 1.4,
              opacity: 0.85,
            }}>{w}</div>
          ))}
        </div>
      )}

      {/* Trust chain summary */}
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        background: C.bgRaised,
        borderRadius: 3,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{
          fontSize: 10,
          fontFamily: MONO,
          color: C.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}>Trust Chain</div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontFamily: MONO,
          flexWrap: "wrap",
          lineHeight: 2,
        }}>
          {VERSIONS.filter((v) => v.version <= version.version).map((v, i, arr) => (
            <span key={v.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                padding: "1px 6px",
                borderRadius: 2,
                fontSize: 10,
                color: v.origin === "synthesized" ? C.purple : v.origin === "human-edited" ? C.green : C.amber,
                background: v.origin === "synthesized" ? C.purpleDim : v.origin === "human-edited" ? C.greenBg : C.amberDim,
              }}>
                v{v.version} {v.origin === "synthesized" ? "◇" : v.origin === "human-edited" ? "✎" : "⟳"}
              </span>
              {i < arr.length - 1 && <span style={{ color: C.textDim }}>→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BehaviorDiffProvenance() {
  const [selectedVersion, setSelectedVersion] = useState("v4");
  const [compareA, setCompareA] = useState("v2");
  const [compareB, setCompareB] = useState("v4");
  const [showPanel, setShowPanel] = useState("diff"); // diff | code

  const selVer = VERSIONS.find((v) => v.id === selectedVersion);
  const verA = VERSIONS.find((v) => v.id === compareA);
  const verB = VERSIONS.find((v) => v.id === compareB);

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
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 18px",
        borderBottom: `1px solid ${C.border}`,
        background: C.bgSurface,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.accent, fontWeight: 600 }}>
            Behavior Diff
          </span>
          <span style={{ fontSize: 11, color: C.textDim, fontFamily: MONO }}>
            screen 6 · provenance browser
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.text }}>
            Order&gt;&gt;shippingCost
          </span>
          <Tag color={C.accent} small>{VERSIONS.length} versions</Tag>
        </div>
      </div>

      {/* Method selector bar */}
      <div style={{
        padding: "8px 18px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: C.bgSurface,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontFamily: MONO, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Lineage
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {VERSIONS.map((v) => {
            const oColor = v.origin === "synthesized" ? C.purple :
              v.origin === "human-edited" ? C.green : C.amber;
            return (
              <div
                key={v.id}
                onClick={() => setSelectedVersion(v.id)}
                title={`v${v.version} — ${v.origin}`}
                style={{
                  width: 28,
                  height: 18,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: selectedVersion === v.id ? `${oColor}25` : C.bgRaised,
                  border: `1px solid ${selectedVersion === v.id ? oColor + "55" : C.border}`,
                  cursor: "pointer",
                  fontSize: 9,
                  fontFamily: MONO,
                  color: selectedVersion === v.id ? oColor : C.textDim,
                  transition: "all 0.1s",
                }}
              >
                {v.version}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setShowPanel("diff")}
            style={{
              background: showPanel === "diff" ? C.accentGlow : "transparent",
              border: `1px solid ${showPanel === "diff" ? C.accent + "44" : C.border}`,
              borderRadius: 3,
              color: showPanel === "diff" ? C.accent : C.textDim,
              fontFamily: MONO,
              fontSize: 10,
              padding: "3px 10px",
              cursor: "pointer",
            }}
          >diff view</button>
          <button
            onClick={() => setShowPanel("code")}
            style={{
              background: showPanel === "code" ? C.accentGlow : "transparent",
              border: `1px solid ${showPanel === "code" ? C.accent + "44" : C.border}`,
              borderRadius: 3,
              color: showPanel === "code" ? C.accent : C.textDim,
              fontFamily: MONO,
              fontSize: 10,
              padding: "3px 10px",
              cursor: "pointer",
            }}
          >source view</button>
        </div>
      </div>

      {/* Main 3-panel layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left: Version timeline */}
        <div style={{
          width: 380,
          flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          overflowY: "auto",
          padding: "10px 10px 10px 4px",
        }}>
          {VERSIONS.map((v) => (
            <TimelineNode
              key={v.id}
              version={v}
              isSelected={selectedVersion === v.id}
              isCompareA={compareA === v.id}
              isCompareB={compareB === v.id}
              onClick={() => setSelectedVersion(v.id)}
              onSetA={() => setCompareA(v.id)}
              onSetB={() => setCompareB(v.id)}
            />
          ))}

          {/* Origin summary at bottom */}
          <div style={{
            margin: "12px 0 0 40px",
            padding: "10px 12px",
            background: C.bgRaised,
            borderRadius: 4,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{
              fontSize: 10,
              fontFamily: MONO,
              color: C.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}>Authorship Breakdown</div>
            <div style={{ display: "flex", gap: 4, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ flex: 1, background: C.purple, opacity: 0.5, title: "v1 synthesized" }} />
              <div style={{ flex: 1, background: C.green, opacity: 0.5, title: "v2 human-edited" }} />
              <div style={{ flex: 1, background: C.amber, opacity: 0.5, title: "v3 re-synthesized" }} />
              <div style={{ flex: 1, background: C.green, opacity: 0.5, title: "v4 human-edited" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: MONO }}>
              <span style={{ color: C.purple }}>50% machine-originated</span>
              <span style={{ color: C.green }}>50% human-edited</span>
            </div>
          </div>
        </div>

        {/* Center: Diff or Source */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 16px",
        }}>
          {showPanel === "diff" && verA && verB ? (
            <>
              <DiffView versionA={verA} versionB={verB} />
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
                <span style={{ color: C.text, fontWeight: 500 }}>Between v{verA.version} and v{verB.version}: </span>
                {verA.origin !== verB.origin
                  ? `Authorship changed from ${verA.origin} to ${verB.origin}. `
                  : ""}
                Example coverage went from {verA.examplesCovered}/{verA.examplesTotal} to {verB.examplesCovered}/{verB.examplesTotal}.
                {verB.driftWarnings ? ` Current version has ${verB.driftWarnings.length} drift warning(s).` : " No drift detected."}
                {verB.collaborators.length > verA.collaborators.length
                  ? ` New collaborator(s) added: ${verB.collaborators.filter((c) => !verA.collaborators.includes(c)).join(", ")}.`
                  : ""}
              </div>
            </>
          ) : (
            <div style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              overflow: "hidden",
            }}>
              <div style={{
                padding: "8px 14px",
                borderBottom: `1px solid ${C.border}`,
                background: C.bgRaised,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.text }}>
                  v{selVer.version} — {selVer.origin}
                </span>
                <span style={{ fontSize: 10, fontFamily: MONO, color: C.textDim }}>{selVer.timestamp}</span>
              </div>
              <pre style={{
                margin: 0,
                padding: "12px 14px",
                fontFamily: MONO,
                fontSize: 12,
                lineHeight: 1.7,
                color: C.text,
                whiteSpace: "pre-wrap",
              }}>{selVer.code}</pre>
            </div>
          )}

          {/* Actions */}
          <div style={{
            marginTop: 14,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}>
            <button style={{
              background: C.bgHover,
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              color: C.textMuted,
              fontFamily: MONO,
              fontSize: 11,
              padding: "5px 10px",
              cursor: "pointer",
            }}>revert to v{selVer.version}</button>
            <button style={{
              background: C.bgHover,
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              color: C.textMuted,
              fontFamily: MONO,
              fontSize: 11,
              padding: "5px 10px",
              cursor: "pointer",
            }}>re-synthesize from current examples</button>
            <button style={{
              background: `${C.accent}12`,
              border: `1px solid ${C.accent}33`,
              borderRadius: 3,
              color: C.accent,
              fontFamily: MONO,
              fontSize: 11,
              padding: "5px 10px",
              cursor: "pointer",
            }}>open in Intent Console →</button>
          </div>
        </div>

        {/* Right: Provenance detail */}
        <div style={{
          width: 300,
          flexShrink: 0,
          borderLeft: `1px solid ${C.border}`,
          overflowY: "auto",
          padding: "14px 0",
        }}>
          <div style={{ padding: "0 16px" }}>
            <ProvenanceDetail version={selVer} />
          </div>
        </div>
      </div>
    </div>
  );
}
