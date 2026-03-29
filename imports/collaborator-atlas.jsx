import { useState, useEffect, useRef, useCallback } from "react";

const MONO = "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'IBM Plex Sans', 'DM Sans', system-ui, sans-serif";

const C = {
  bg: "#0f1214",
  bgSurface: "#171b1f",
  bgRaised: "#1e2328",
  bgHover: "#262c32",
  border: "#2a3138",
  borderActive: "#3e4a55",
  text: "#d4dde6",
  textMuted: "#7e8d9c",
  textDim: "#4e5b68",
  accent: "#4fc1e9",
  accentDim: "#2a7a9e",
  accentGlow: "rgba(79,193,233,0.10)",
  green: "#7ecf8e",
  greenDim: "rgba(126,207,142,0.10)",
  red: "#e07272",
  redDim: "rgba(224,114,114,0.10)",
  amber: "#d4a856",
  amberDim: "rgba(212,168,86,0.10)",
  purple: "#b07aff",
  purpleDim: "rgba(176,122,255,0.10)",
  teal: "#56c2b6",
  tealDim: "rgba(86,194,182,0.10)",
  pink: "#e07aaf",
  pinkDim: "rgba(224,122,175,0.10)",
};

// Node types with distinct colors
const NODE_COLORS = {
  domain: C.accent,
  service: C.purple,
  policy: C.amber,
  value: C.teal,
  adapter: C.pink,
};

// Demo object graph
const NODES = [
  { id: "Order", kind: "domain", x: 400, y: 260, description: "Core order aggregate", methodCount: 14, generatedCount: 3, status: "stable" },
  { id: "Customer", kind: "domain", x: 160, y: 180, description: "Customer entity with preferences", methodCount: 9, generatedCount: 1, status: "stable" },
  { id: "Cart", kind: "domain", x: 160, y: 340, description: "Shopping cart before checkout", methodCount: 11, generatedCount: 2, status: "stable" },
  { id: "TaxPolicy", kind: "policy", x: 600, y: 140, description: "Regional tax computation rules", methodCount: 6, generatedCount: 4, status: "provisional" },
  { id: "ShippingZone", kind: "policy", x: 640, y: 300, description: "Zone-based shipping rate table", methodCount: 5, generatedCount: 3, status: "provisional" },
  { id: "Carrier", kind: "service", x: 640, y: 440, description: "External carrier rate API adapter", methodCount: 4, generatedCount: 0, status: "stable" },
  { id: "Invoice", kind: "domain", x: 400, y: 80, description: "Finalized billing document", methodCount: 12, generatedCount: 2, status: "stable" },
  { id: "PaymentGateway", kind: "adapter", x: 200, y: 60, description: "Stripe/Braintree adapter", methodCount: 7, generatedCount: 0, status: "stable" },
  { id: "DiscountEngine", kind: "service", x: 160, y: 480, description: "Coupon and promo evaluation", methodCount: 8, generatedCount: 5, status: "drift" },
  { id: "AuditLog", kind: "service", x: 440, y: 470, description: "Immutable event record", methodCount: 3, generatedCount: 0, status: "stable" },
];

// Edges: from -> to, with message info
const EDGES = [
  { from: "Cart", to: "Order", messages: ["buildOrder", "applyDiscounts"], kind: "creates", strength: 3 },
  { from: "Cart", to: "Customer", messages: ["customer", "preferredAddress"], kind: "reads", strength: 2 },
  { from: "Cart", to: "DiscountEngine", messages: ["evaluate:", "applicableCoupons"], kind: "delegates", strength: 2 },
  { from: "Order", to: "TaxPolicy", messages: ["taxFor:in:", "exemptCategories"], kind: "delegates", strength: 3 },
  { from: "Order", to: "ShippingZone", messages: ["rateFor:weight:", "multiplierFor:"], kind: "delegates", strength: 2 },
  { from: "Order", to: "Carrier", messages: ["baseCostFor:method:"], kind: "delegates", strength: 1 },
  { from: "Order", to: "Invoice", messages: ["generateInvoice", "lineItems"], kind: "creates", strength: 2 },
  { from: "Order", to: "AuditLog", messages: ["record:event:"], kind: "notifies", strength: 1 },
  { from: "Invoice", to: "PaymentGateway", messages: ["charge:token:", "refund:"], kind: "delegates", strength: 2 },
  { from: "Invoice", to: "Customer", messages: ["billingAddress", "email"], kind: "reads", strength: 1 },
  { from: "Invoice", to: "TaxPolicy", messages: ["taxSummaryFor:"], kind: "delegates", strength: 1 },
  { from: "DiscountEngine", to: "Order", messages: ["subtotal", "itemCategories"], kind: "reads", strength: 2 },
  { from: "ShippingZone", to: "Carrier", messages: ["availableCarriers:"], kind: "delegates", strength: 1 },
];

const EDGE_KIND_COLORS = {
  creates: C.green,
  reads: C.textDim,
  delegates: C.accent,
  notifies: C.amber,
};

function Tag({ children, color = C.accent, small, style = {} }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: small ? "1px 5px" : "2px 7px",
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

// Protocol card shown in detail panel
function ProtocolMessage({ msg, isGenerated }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 0",
      fontSize: 12,
      fontFamily: MONO,
      borderBottom: `1px solid ${C.border}33`,
    }}>
      <span style={{ color: C.accent }}>#</span>
      <span style={{ color: C.text, flex: 1 }}>{msg}</span>
      {isGenerated && <Tag color={C.purple} small>synth</Tag>}
    </div>
  );
}

// SVG graph rendering
function GraphCanvas({ nodes, edges, selectedNode, hoveredNode, onSelectNode, onHoverNode, dragState, onDragStart }) {
  const svgRef = useRef(null);

  // Compute edge paths
  const edgePaths = edges.map((e) => {
    const from = nodes.find((n) => n.id === e.from);
    const to = nodes.find((n) => n.id === e.to);
    if (!from || !to) return null;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;

    const r = 32;
    const x1 = from.x + nx * r;
    const y1 = from.y + ny * r;
    const x2 = to.x - nx * r;
    const y2 = to.y - ny * r;

    // Slight curve
    const cx = (x1 + x2) / 2 + ny * 20;
    const cy = (y1 + y2) / 2 - nx * 20;

    const isHighlighted = selectedNode === e.from || selectedNode === e.to ||
      hoveredNode === e.from || hoveredNode === e.to;
    const isFaded = (selectedNode || hoveredNode) && !isHighlighted;

    return { ...e, x1, y1, x2, y2, cx, cy, isHighlighted, isFaded };
  }).filter(Boolean);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 820 560"
      style={{ cursor: dragState ? "grabbing" : "default" }}
    >
      <defs>
        {Object.entries(EDGE_KIND_COLORS).map(([kind, color]) => (
          <marker
            key={kind}
            id={`arrow-${kind}`}
            viewBox="0 0 10 8"
            refX="9"
            refY="4"
            markerWidth="8"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 4 L 0 8 z" fill={color} opacity="0.6" />
          </marker>
        ))}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Edges */}
      {edgePaths.map((e, i) => (
        <g key={i}>
          <path
            d={`M ${e.x1} ${e.y1} Q ${e.cx} ${e.cy} ${e.x2} ${e.y2}`}
            fill="none"
            stroke={EDGE_KIND_COLORS[e.kind] || C.textDim}
            strokeWidth={e.isHighlighted ? 2 : 1}
            strokeDasharray={e.kind === "notifies" ? "4 3" : "none"}
            opacity={e.isFaded ? 0.12 : e.isHighlighted ? 0.8 : 0.3}
            markerEnd={`url(#arrow-${e.kind})`}
            style={{ transition: "opacity 0.2s" }}
          />
          {e.isHighlighted && (
            <text
              x={e.cx}
              y={e.cy - 6}
              textAnchor="middle"
              fontSize="9"
              fontFamily={MONO}
              fill={EDGE_KIND_COLORS[e.kind]}
              opacity="0.7"
            >
              {e.messages.length > 1 ? `${e.messages[0]} +${e.messages.length - 1}` : e.messages[0]}
            </text>
          )}
        </g>
      ))}

      {/* Nodes */}
      {nodes.map((node) => {
        const color = NODE_COLORS[node.kind] || C.accent;
        const isSelected = selectedNode === node.id;
        const isHovered = hoveredNode === node.id;
        const isConnected = selectedNode && edges.some(
          (e) => (e.from === selectedNode && e.to === node.id) || (e.to === selectedNode && e.from === node.id)
        );
        const isFaded = (selectedNode || hoveredNode) && !isSelected && !isHovered && !isConnected &&
          !(hoveredNode && edges.some(
            (e) => (e.from === hoveredNode && e.to === node.id) || (e.to === hoveredNode && e.from === node.id)
          ));

        const statusColor = node.status === "provisional" ? C.amber :
          node.status === "drift" ? C.red : C.green;
        const r = isSelected ? 34 : 30;

        return (
          <g
            key={node.id}
            onClick={() => onSelectNode(isSelected ? null : node.id)}
            onMouseEnter={() => onHoverNode(node.id)}
            onMouseLeave={() => onHoverNode(null)}
            onMouseDown={(e) => onDragStart(node.id, e)}
            style={{ cursor: "pointer", transition: "opacity 0.2s" }}
            opacity={isFaded ? 0.2 : 1}
          >
            {/* Glow ring for selected */}
            {isSelected && (
              <circle cx={node.x} cy={node.y} r={r + 6} fill="none" stroke={color} strokeWidth="1" opacity="0.3" filter="url(#glow)" />
            )}

            {/* Status ring */}
            <circle
              cx={node.x}
              cy={node.y}
              r={r + 2}
              fill="none"
              stroke={statusColor}
              strokeWidth="1.5"
              strokeDasharray={node.status === "provisional" ? "3 2" : node.status === "drift" ? "2 2" : "none"}
              opacity="0.5"
            />

            {/* Main circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={r}
              fill={C.bgSurface}
              stroke={isSelected || isHovered ? color : C.border}
              strokeWidth={isSelected ? 2 : 1}
            />

            {/* Generated ratio arc */}
            {node.generatedCount > 0 && (
              <circle
                cx={node.x}
                cy={node.y}
                r={r - 3}
                fill="none"
                stroke={C.purple}
                strokeWidth="3"
                strokeDasharray={`${(node.generatedCount / node.methodCount) * (2 * Math.PI * (r - 3))} ${2 * Math.PI * (r - 3)}`}
                strokeDashoffset={(2 * Math.PI * (r - 3)) * 0.25}
                opacity="0.4"
                strokeLinecap="round"
              />
            )}

            {/* Label */}
            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fontFamily={MONO}
              fontWeight={isSelected ? "600" : "normal"}
              fill={isSelected || isHovered ? color : C.text}
            >
              {node.id}
            </text>

            {/* Kind badge below */}
            <text
              x={node.x}
              y={node.y + r + 14}
              textAnchor="middle"
              fontSize="8"
              fontFamily={MONO}
              fill={C.textDim}
            >
              {node.kind}
            </text>

            {/* Generated count pip */}
            {node.generatedCount > 0 && (
              <g>
                <circle cx={node.x + r - 4} cy={node.y - r + 4} r="8" fill={C.bgRaised} stroke={C.purple} strokeWidth="1" />
                <text x={node.x + r - 4} y={node.y - r + 5} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontFamily={MONO} fill={C.purple}>
                  {node.generatedCount}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Detail panel
function DetailPanel({ node, edges, allNodes }) {
  if (!node) return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: C.textDim,
      fontFamily: MONO,
      fontSize: 12,
      padding: 20,
      textAlign: "center",
      lineHeight: 1.8,
    }}>
      select a node to inspect<br />
      its collaborators and protocol
    </div>
  );

  const nodeData = allNodes.find((n) => n.id === node);
  const color = NODE_COLORS[nodeData?.kind] || C.accent;
  const outgoing = edges.filter((e) => e.from === node);
  const incoming = edges.filter((e) => e.to === node);
  const statusColor = nodeData?.status === "provisional" ? C.amber :
    nodeData?.status === "drift" ? C.red : C.green;

  // Flatten all messages for protocol view
  const allMessages = [
    ...outgoing.flatMap((e) => e.messages.map((m) => ({ msg: m, dir: "sends", to: e.to, kind: e.kind }))),
    ...incoming.flatMap((e) => e.messages.map((m) => ({ msg: m, dir: "receives", from: e.from, kind: e.kind }))),
  ];

  return (
    <div style={{ overflowY: "auto", padding: "14px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontFamily: MONO,
            fontSize: 16,
            color,
            fontWeight: 600,
          }}>{nodeData.id}</span>
          <Tag color={color} small>{nodeData.kind}</Tag>
          <Tag color={statusColor} small>{nodeData.status}</Tag>
        </div>
        <div style={{ fontSize: 12, fontFamily: SANS, color: C.textMuted, lineHeight: 1.4 }}>
          {nodeData.description}
        </div>
        <div style={{
          marginTop: 8,
          display: "flex",
          gap: 12,
          fontSize: 11,
          fontFamily: MONO,
          color: C.textDim,
        }}>
          <span>{nodeData.methodCount} methods</span>
          <span style={{ color: C.purple }}>{nodeData.generatedCount} synthesized</span>
          <span>{Math.round((1 - nodeData.generatedCount / nodeData.methodCount) * 100)}% handwritten</span>
        </div>
      </div>

      {/* Protocol: outgoing */}
      {outgoing.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10,
            fontFamily: MONO,
            color: C.textDim,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}>Sends to →</div>
          {outgoing.map((e, i) => (
            <div key={i} style={{
              marginBottom: 10,
              padding: "8px 10px",
              background: C.bgRaised,
              borderRadius: 4,
              borderLeft: `2px solid ${EDGE_KIND_COLORS[e.kind]}`,
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.text }}>{e.to}</span>
                <Tag color={EDGE_KIND_COLORS[e.kind]} small>{e.kind}</Tag>
              </div>
              {e.messages.map((m, j) => (
                <ProtocolMessage key={j} msg={m} isGenerated={j === 0 && nodeData.generatedCount > 0} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Protocol: incoming */}
      {incoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10,
            fontFamily: MONO,
            color: C.textDim,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}>← Receives from</div>
          {incoming.map((e, i) => (
            <div key={i} style={{
              marginBottom: 10,
              padding: "8px 10px",
              background: C.bgRaised,
              borderRadius: 4,
              borderLeft: `2px solid ${EDGE_KIND_COLORS[e.kind]}55`,
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.textMuted }}>{e.from}</span>
                <Tag color={EDGE_KIND_COLORS[e.kind]} small>{e.kind}</Tag>
              </div>
              {e.messages.map((m, j) => (
                <ProtocolMessage key={j} msg={m} isGenerated={false} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Constraints for synthesis */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10,
          fontFamily: MONO,
          color: C.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
        }}>Synthesis Constraints</div>
        <div style={{
          padding: "10px 12px",
          background: C.bgRaised,
          borderRadius: 4,
          fontSize: 12,
          fontFamily: SANS,
          color: C.textMuted,
          lineHeight: 1.6,
        }}>
          When generating behavior for <span style={{ color, fontFamily: MONO }}>{nodeData.id}</span>,
          the synthesizer must respect {outgoing.length} outgoing collaborations
          and {incoming.length} incoming expectations.
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {outgoing.map((e) => (
              <Tag key={e.to} color={C.green} small>trusts: {e.to}</Tag>
            ))}
            {nodeData.status === "drift" && <Tag color={C.red} small>⚠ drift detected</Tag>}
            {nodeData.status === "provisional" && <Tag color={C.amber} small>● provisional methods</Tag>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={{
          background: C.bgHover,
          border: `1px solid ${C.border}`,
          borderRadius: 3,
          color: C.textMuted,
          fontFamily: MONO,
          fontSize: 11,
          padding: "5px 10px",
          cursor: "pointer",
        }}>browse protocol</button>
        <button style={{
          background: C.bgHover,
          border: `1px solid ${C.border}`,
          borderRadius: 3,
          color: C.textMuted,
          fontFamily: MONO,
          fontSize: 11,
          padding: "5px 10px",
          cursor: "pointer",
        }}>inspect object</button>
        <button style={{
          background: `${C.accent}15`,
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
  );
}

export default function CollaboratorAtlas() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [nodes, setNodes] = useState(NODES);
  const [dragNode, setDragNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const svgContainerRef = useRef(null);

  // Dragging
  const handleDragStart = useCallback((nodeId, e) => {
    e.stopPropagation();
    const svgEl = svgContainerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());
    const node = nodes.find((n) => n.id === nodeId);
    setDragNode(nodeId);
    setDragOffset({ x: svgP.x - node.x, y: svgP.y - node.y });
  }, [nodes]);

  useEffect(() => {
    if (!dragNode) return;
    const svgEl = svgContainerRef.current?.querySelector("svg");
    if (!svgEl) return;

    const handleMove = (e) => {
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragNode
            ? { ...n, x: svgP.x - dragOffset.x, y: svgP.y - dragOffset.y }
            : n
        )
      );
    };
    const handleUp = () => setDragNode(null);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragNode, dragOffset]);

  // Legend items
  const legendItems = [
    { label: "domain", color: C.accent },
    { label: "policy", color: C.amber },
    { label: "service", color: C.purple },
    { label: "value", color: C.teal },
    { label: "adapter", color: C.pink },
  ];
  const edgeLegend = [
    { label: "creates", color: C.green, dash: false },
    { label: "delegates", color: C.accent, dash: false },
    { label: "reads", color: C.textDim, dash: false },
    { label: "notifies", color: C.amber, dash: true },
  ];
  const statusLegend = [
    { label: "stable", color: C.green },
    { label: "provisional", color: C.amber },
    { label: "drift", color: C.red },
  ];

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
            Collaborator Atlas
          </span>
          <span style={{ fontSize: 11, color: C.textDim, fontFamily: MONO }}>
            screen 3 · object collaboration graph
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 10,
            fontFamily: MONO,
            color: C.textDim,
          }}>
            {nodes.length} objects · {EDGES.length} edges
          </span>
          {selectedNode && (
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                background: "none",
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                color: C.textMuted,
                fontFamily: MONO,
                fontSize: 11,
                padding: "3px 10px",
                cursor: "pointer",
              }}
            >clear selection</button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Graph canvas */}
        <div
          ref={svgContainerRef}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <GraphCanvas
            nodes={nodes}
            edges={EDGES}
            selectedNode={selectedNode}
            hoveredNode={hoveredNode}
            onSelectNode={setSelectedNode}
            onHoverNode={setHoveredNode}
            dragState={dragNode}
            onDragStart={handleDragStart}
          />

          {/* Legend overlay */}
          <div style={{
            position: "absolute",
            bottom: 14,
            left: 14,
            background: `${C.bgSurface}ee`,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "10px 14px",
            display: "flex",
            gap: 20,
            backdropFilter: "blur(8px)",
          }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: MONO, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Nodes</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {legendItems.map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, opacity: 0.7 }} />
                    <span style={{ fontSize: 10, fontFamily: MONO, color: C.textMuted }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: MONO, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Edges</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {edgeLegend.map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                      width: 14, height: 0,
                      borderTop: `2px ${l.dash ? "dashed" : "solid"} ${l.color}`,
                      opacity: 0.6,
                    }} />
                    <span style={{ fontSize: 10, fontFamily: MONO, color: C.textMuted }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: MONO, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Status</div>
              <div style={{ display: "flex", gap: 8 }}>
                {statusLegend.map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px solid ${l.color}`, opacity: 0.7 }} />
                    <span style={{ fontSize: 10, fontFamily: MONO, color: C.textMuted }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Synthesized ratio hint */}
          <div style={{
            position: "absolute",
            top: 14,
            left: 14,
            background: `${C.bgSurface}ee`,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "6px 10px",
            fontSize: 10,
            fontFamily: MONO,
            color: C.textDim,
            display: "flex",
            alignItems: "center",
            gap: 8,
            backdropFilter: "blur(8px)",
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6" fill="none" stroke={C.border} strokeWidth="2" />
              <circle cx="8" cy="8" r="6" fill="none" stroke={C.purple} strokeWidth="2"
                strokeDasharray={`${0.35 * 2 * Math.PI * 6} ${2 * Math.PI * 6}`}
                strokeDashoffset={2 * Math.PI * 6 * 0.25}
                opacity="0.6" />
            </svg>
            <span>purple arc = synthesized method ratio</span>
            <span style={{ color: C.purple }}>●</span>
            <span>pip = generated count</span>
          </div>
        </div>

        {/* Detail panel */}
        <div style={{
          width: 320,
          flexShrink: 0,
          borderLeft: `1px solid ${C.border}`,
          background: C.bgSurface,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10,
            fontFamily: MONO,
            color: C.textDim,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}>
            {selectedNode ? `${selectedNode} — Detail` : "Object Detail"}
          </div>
          <DetailPanel node={selectedNode} edges={EDGES} allNodes={nodes} />
        </div>
      </div>
    </div>
  );
}
