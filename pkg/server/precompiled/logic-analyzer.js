import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
const CHICAGO = `"Chicago_12", "ChicagoFLF", Geneva, "Helvetica Neue", Helvetica, sans-serif`;
const GENEVA = `Geneva, "Helvetica Neue", Helvetica, sans-serif`;
function MacButton({ children, onClick, active, small, style }) {
  const [pressed, setPressed] = useState(false);
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onMouseDown: () => setPressed(true),
      onMouseUp: () => setPressed(false),
      onMouseLeave: () => setPressed(false),
      onClick,
      style: {
        fontFamily: GENEVA,
        fontSize: small ? 9 : 11,
        background: pressed || active ? "#000" : "#fff",
        color: pressed || active ? "#fff" : "#000",
        border: "2px solid #000",
        borderRadius: 6,
        padding: small ? "2px 6px" : "4px 12px",
        cursor: "pointer",
        boxShadow: pressed ? "none" : "1px 1px 0px #000",
        fontWeight: "bold",
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
        ...style
      }
    },
    children
  );
}
function MacCheckbox({ label, checked, onChange }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: () => onChange(!checked),
      style: { display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }
    },
    /* @__PURE__ */ React.createElement("div", { style: {
      width: 12,
      height: 12,
      border: "2px solid #000",
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: CHICAGO,
      fontSize: 10,
      fontWeight: "bold",
      lineHeight: 1
    } }, checked ? "\u2715" : ""),
    /* @__PURE__ */ React.createElement("span", { style: { fontFamily: GENEVA, fontSize: 10, fontWeight: "bold" } }, label)
  );
}
function MacSlider({ label, value, min, max, step, onChange, unit, width }) {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: GENEVA, fontSize: 9, width: width || 55, textAlign: "right", fontWeight: "bold" } }, label), /* @__PURE__ */ React.createElement("div", { style: {
    position: "relative",
    flex: 1,
    height: 16,
    border: "2px solid #000",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    minWidth: 60
  } }, /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "#000" } }), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "range",
      min,
      max,
      step,
      value,
      onChange: (e) => onChange(parseFloat(e.target.value)),
      style: { width: "100%", height: "100%", opacity: 0, cursor: "pointer", position: "relative", zIndex: 2 }
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    left: `calc(${(value - min) / (max - min) * 100}% - 6px)`,
    width: 12,
    height: 12,
    background: "#fff",
    border: "2px solid #000",
    pointerEvents: "none"
  } }, /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 2, left: 2, right: 2, bottom: 2, borderTop: "1px solid #000", borderBottom: "1px solid #000" } }))), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: GENEVA, fontSize: 9, width: 40, fontWeight: "bold" } }, value, unit || ""));
}
const CHANNEL_COLORS = ["#00ff41", "#41b0ff", "#ff6141", "#ffe041", "#c841ff", "#41ffd0", "#ff41b0", "#a0ff41"];
const CHANNEL_NAMES = ["CLK", "D0", "D1", "D2", "CS", "WR", "RD", "IRQ"];
const PROTOCOLS = ["None", "SPI", "I\xB2C", "UART"];
function generateSignal(type, freq, t, phase = 0, duty = 0.5) {
  const p = ((t * freq + phase) % 1 + 1) % 1;
  switch (type) {
    case "clock":
      return p < duty ? 1 : 0;
    case "data_fast":
      return Math.sin((t * freq * 0.7 + phase) * Math.PI * 2) > 0.1 ? 1 : 0;
    case "data_slow":
      return Math.sin((t * freq * 0.3 + phase) * Math.PI * 2) > -0.2 ? 1 : 0;
    case "pulse":
      return p > 0.1 && p < 0.15 || p > 0.5 && p < 0.55 ? 1 : 0;
    case "cs":
      return p < 0.7 ? 0 : 1;
    case "wr":
      return p > 0.2 && p < 0.35 || p > 0.6 && p < 0.75 ? 0 : 1;
    case "rd":
      return p > 0.05 && p < 0.2 || p > 0.45 && p < 0.6 ? 0 : 1;
    case "irq":
      return p > 0.85 && p < 0.95 ? 0 : 1;
    default:
      return 0;
  }
}
const SIGNAL_TYPES = ["clock", "data_fast", "data_slow", "data_fast", "cs", "wr", "rd", "irq"];
function LogicAnalyzer() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);
  const [running, setRunning] = useState(true);
  const [channels, setChannels] = useState(
    () => CHANNEL_NAMES.map((name, i) => ({ name, enabled: i < 6, color: CHANNEL_COLORS[i] }))
  );
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [protocol, setProtocol] = useState("None");
  const [cursorPos, setCursorPos] = useState(null);
  const [triggerCh, setTriggerCh] = useState(0);
  const [triggerEdge, setTriggerEdge] = useState("rising");
  const [busView, setBusView] = useState(false);
  const enabledChannels = channels.filter((c) => c.enabled);
  const toggleChannel = (idx) => {
    setChannels((prev) => prev.map((c, i) => i === idx ? { ...c, enabled: !c.enabled } : c));
  };
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, W, H);
    const active = enabledChannels;
    const chCount = active.length;
    if (chCount === 0) {
      ctx.fillStyle = "#444";
      ctx.font = "bold 14px Geneva, monospace";
      ctx.textAlign = "center";
      ctx.fillText("No channels enabled", W / 2, H / 2);
      ctx.textAlign = "left";
      animRef.current = requestAnimationFrame(draw);
      return;
    }
    const laneH = Math.min(56, (H - 30) / chCount);
    const topPad = 2;
    const signalH = laneH * 0.55;
    if (showGrid) {
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 0.5;
      const gridX = W / (12 * zoom);
      for (let x = 0; x < W; x += gridX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let i = 0; i <= chCount; i++) {
        const y = topPad + i * laneH;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }
    active.forEach((ch, ci) => {
      const globalIdx = channels.indexOf(ch);
      const baseY = topPad + ci * laneH;
      const highY = baseY + 6;
      const lowY = baseY + 6 + signalH;
      ctx.strokeStyle = "#222240";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baseY + laneH);
      ctx.lineTo(W, baseY + laneH);
      ctx.stroke();
      ctx.fillStyle = ch.color;
      ctx.font = "bold 9px Geneva, monospace";
      ctx.globalAlpha = 0.6;
      ctx.fillText(ch.name, 4, lowY + 14);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = ch.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      let prevVal = null;
      for (let x = 0; x < W; x++) {
        const t = x / W * 3 * zoom + timeRef.current;
        const val = generateSignal(SIGNAL_TYPES[globalIdx], speed, t, globalIdx * 0.17);
        const y = val ? highY : lowY;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          if (prevVal !== null && prevVal !== val) {
            ctx.lineTo(x, y);
            if (showEdges) {
              ctx.fillStyle = ch.color;
              ctx.globalAlpha = 0.3;
              ctx.fillRect(x - 1, highY - 1, 2, signalH + 2);
              ctx.globalAlpha = 1;
            }
          }
          ctx.lineTo(x, y);
        }
        prevVal = val;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
    if (cursorPos !== null) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cursorPos, 0);
      ctx.lineTo(cursorPos, H);
      ctx.stroke();
      ctx.setLineDash([]);
      const cursorTime = (cursorPos / W * 3 * zoom + timeRef.current).toFixed(3);
      ctx.fillStyle = "#000";
      ctx.fillRect(cursorPos + 2, 2, 58, 14);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px Geneva, monospace";
      ctx.fillText(`t=${cursorTime}ms`, cursorPos + 5, 12);
      active.forEach((ch, ci) => {
        const globalIdx = channels.indexOf(ch);
        const t = cursorPos / W * 3 * zoom + timeRef.current;
        const val = generateSignal(SIGNAL_TYPES[globalIdx], speed, t, globalIdx * 0.17);
        const baseY = topPad + ci * laneH;
        ctx.fillStyle = ch.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(cursorPos + 2, baseY + 4, 18, 12);
        ctx.fillStyle = "#000";
        ctx.font = "bold 9px Geneva, monospace";
        ctx.fillText(val ? "H" : "L", cursorPos + 6, baseY + 13);
        ctx.globalAlpha = 1;
      });
    }
    if (busView && active.length >= 2) {
      const busY = H - 22;
      ctx.fillStyle = "#111128";
      ctx.fillRect(0, busY, W, 22);
      ctx.strokeStyle = "#333366";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, busY);
      ctx.lineTo(W, busY);
      ctx.stroke();
      ctx.font = "bold 9px Geneva, monospace";
      const step = 40;
      for (let x = 0; x < W; x += step) {
        const t = x / W * 3 * zoom + timeRef.current;
        let busVal = 0;
        active.forEach((ch, ci) => {
          const globalIdx = channels.indexOf(ch);
          const val = generateSignal(SIGNAL_TYPES[globalIdx], speed, t, globalIdx * 0.17);
          busVal |= val << ci;
        });
        const hex = busVal.toString(16).toUpperCase().padStart(2, "0");
        ctx.fillStyle = "#ffe041";
        ctx.globalAlpha = 0.7;
        ctx.fillText(`0x${hex}`, x + 4, busY + 14);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = "#555";
    ctx.font = "bold 9px Geneva, monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${(timeRef.current * 1e3).toFixed(0)}\u03BCs`, W - 6, 12);
    ctx.textAlign = "left";
    if (running) {
      timeRef.current += 8e-3 * speed;
    }
    animRef.current = requestAnimationFrame(draw);
  }, [channels, enabledChannels, running, speed, zoom, showGrid, showEdges, cursorPos, busView]);
  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);
  const handleCanvasMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    setCursorPos(Math.round((e.clientX - rect.left) * scaleX));
  };
  return /* @__PURE__ */ React.createElement("div", { style: {
    width: "100%",
    minHeight: "100vh",
    background: "#c0c0c0",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='2' height='2' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='%23b0b0b0'/%3E%3C/svg%3E")`,
    backgroundSize: "2px 2px",
    fontFamily: CHICAGO,
    display: "flex",
    flexDirection: "column"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: 20,
    background: "#fff",
    borderBottom: "2px solid #000",
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    gap: 16
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: CHICAGO, fontSize: 12, fontWeight: "bold" } }, "\u{1F34E}"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: CHICAGO, fontSize: 12, fontWeight: "bold" } }, "File"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: CHICAGO, fontSize: 12, fontWeight: "bold" } }, "Edit"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: CHICAGO, fontSize: 12, fontWeight: "bold" } }, "Capture"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: CHICAGO, fontSize: 12, fontWeight: "bold" } }, "Decode"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: CHICAGO, fontSize: 12, fontWeight: "bold" } }, "Help"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: GENEVA, fontSize: 10 } }, "\u2318 MacLogic v1.4")), /* @__PURE__ */ React.createElement("div", { style: {
    margin: "8px auto",
    maxWidth: 820,
    width: "calc(100% - 16px)",
    border: "2px solid #000",
    boxShadow: "2px 2px 0px #000, inset -1px -1px 0px #808080, inset 1px 1px 0px #fff",
    background: "#c0c0c0",
    display: "flex",
    flexDirection: "column"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: 20,
    background: "#fff",
    borderBottom: "2px solid #000",
    display: "flex",
    alignItems: "center",
    position: "relative"
  } }, /* @__PURE__ */ React.createElement("div", { style: { width: 13, height: 11, border: "2px solid #000", margin: "0 4px", background: "#fff" } }), /* @__PURE__ */ React.createElement("div", { style: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    height: "100%"
  } }, [...Array(5)].map((_, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { position: "absolute", top: 2 + i * 4, left: 0, right: 0, height: 1, background: "#000" } })), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: CHICAGO,
    fontSize: 12,
    fontWeight: "bold",
    background: "#fff",
    padding: "0 8px",
    position: "relative",
    zIndex: 1
  } }, "\u{1F52C} Logic Analyzer \u2014 MacLogic")), /* @__PURE__ */ React.createElement("div", { style: { width: 13, height: 11, border: "2px solid #000", margin: "0 4px", background: "#fff" } })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, padding: 6, display: "flex", flexDirection: "column", gap: 4 } }, /* @__PURE__ */ React.createElement("div", { style: {
    border: "3px solid #000",
    borderRadius: 2,
    boxShadow: "inset 0 0 15px rgba(0,0,0,0.5), inset 2px 2px 0 #404040, inset -2px -2px 0 #e0e0e0",
    background: "#0a0a12",
    position: "relative"
  } }, /* @__PURE__ */ React.createElement(
    "canvas",
    {
      ref: canvasRef,
      width: 560,
      height: 340,
      style: { width: "100%", height: "auto", display: "block", cursor: "crosshair" },
      onMouseMove: handleCanvasMouseMove,
      onMouseLeave: () => setCursorPos(null)
    }
  ), /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: 4,
    left: 4,
    right: "65%",
    bottom: "70%",
    background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
    pointerEvents: "none"
  } })), /* @__PURE__ */ React.createElement("div", { style: {
    padding: "2px 6px",
    border: "1px solid #808080",
    borderTop: "1px solid #fff",
    background: "#dfdfdf",
    display: "flex",
    gap: 12,
    justifyContent: "space-between"
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: GENEVA, fontSize: 9 } }, running ? "\u25B6 CAPTURING" : "\u23F8 STOPPED", " | ", enabledChannels.length, " CH Active | Depth: 64K samples"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: GENEVA, fontSize: 9 } }, "Trigger: ", CHANNEL_NAMES[triggerCh], " ", triggerEdge === "rising" ? "\u2191" : "\u2193", " | Protocol: ", protocol))), /* @__PURE__ */ React.createElement("div", { style: {
    width: 220,
    borderLeft: "2px solid #000",
    padding: 6,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    background: "#d8d8d8",
    overflowY: "auto"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    border: "2px solid #000",
    padding: 4,
    boxShadow: "inset -1px -1px 0 #fff, inset 1px 1px 0 #808080"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontFamily: CHICAGO,
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    borderBottom: "1px solid #000",
    paddingBottom: 2
  } }, "\u25C8 Channels"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2 } }, channels.map((ch, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 4 } }, /* @__PURE__ */ React.createElement(MacCheckbox, { label: "", checked: ch.enabled, onChange: () => toggleChannel(i) }), /* @__PURE__ */ React.createElement("div", { style: {
    width: 8,
    height: 8,
    background: ch.color,
    border: "1px solid #000"
  } }), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: GENEVA,
    fontSize: 9,
    fontWeight: "bold",
    opacity: ch.enabled ? 1 : 0.4
  } }, ch.name))))), /* @__PURE__ */ React.createElement("div", { style: {
    border: "2px solid #000",
    padding: 4,
    boxShadow: "inset -1px -1px 0 #fff, inset 1px 1px 0 #808080"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontFamily: CHICAGO,
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    borderBottom: "1px solid #000",
    paddingBottom: 2
  } }, "\u25C8 Timing"), /* @__PURE__ */ React.createElement(MacSlider, { label: "Speed", value: speed, min: 0.1, max: 5, step: 0.1, onChange: setSpeed, unit: "x" }), /* @__PURE__ */ React.createElement("div", { style: { height: 3 } }), /* @__PURE__ */ React.createElement(MacSlider, { label: "Zoom", value: zoom, min: 0.2, max: 4, step: 0.1, onChange: setZoom, unit: "x" })), /* @__PURE__ */ React.createElement("div", { style: {
    border: "2px solid #000",
    padding: 4,
    boxShadow: "inset -1px -1px 0 #fff, inset 1px 1px 0 #808080"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontFamily: CHICAGO,
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    borderBottom: "1px solid #000",
    paddingBottom: 2
  } }, "\u25C8 Trigger"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 3, marginBottom: 4, flexWrap: "wrap" } }, CHANNEL_NAMES.slice(0, 6).map((name, i) => /* @__PURE__ */ React.createElement(MacButton, { key: i, small: true, active: triggerCh === i, onClick: () => setTriggerCh(i) }, name))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement(MacButton, { small: true, active: triggerEdge === "rising", onClick: () => setTriggerEdge("rising") }, "\u2191 Rising"), /* @__PURE__ */ React.createElement(MacButton, { small: true, active: triggerEdge === "falling", onClick: () => setTriggerEdge("falling") }, "\u2193 Falling"))), /* @__PURE__ */ React.createElement("div", { style: {
    border: "2px solid #000",
    padding: 4,
    boxShadow: "inset -1px -1px 0 #fff, inset 1px 1px 0 #808080"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontFamily: CHICAGO,
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    borderBottom: "1px solid #000",
    paddingBottom: 2
  } }, "\u25C8 Protocol Decode"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 3, flexWrap: "wrap" } }, PROTOCOLS.map((p) => /* @__PURE__ */ React.createElement(MacButton, { key: p, small: true, active: protocol === p, onClick: () => setProtocol(p) }, p)))), /* @__PURE__ */ React.createElement("div", { style: {
    border: "2px solid #000",
    padding: 4,
    boxShadow: "inset -1px -1px 0 #fff, inset 1px 1px 0 #808080"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    fontFamily: CHICAGO,
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
    borderBottom: "1px solid #000",
    paddingBottom: 2
  } }, "\u25C8 Display"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 3 } }, /* @__PURE__ */ React.createElement(MacCheckbox, { label: "Grid", checked: showGrid, onChange: setShowGrid }), /* @__PURE__ */ React.createElement(MacCheckbox, { label: "Edge Markers", checked: showEdges, onChange: setShowEdges }), /* @__PURE__ */ React.createElement(MacCheckbox, { label: "Bus Hex View", checked: busView, onChange: setBusView }))))), /* @__PURE__ */ React.createElement("div", { style: {
    borderTop: "2px solid #000",
    padding: "5px 8px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#d0d0d0",
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement(MacButton, { onClick: () => setRunning(!running) }, running ? "\u23F8 Stop" : "\u25B6 Capture"), /* @__PURE__ */ React.createElement(MacButton, { onClick: () => {
    timeRef.current = 0;
  } }, "\u23EE Reset"), /* @__PURE__ */ React.createElement(MacButton, { onClick: () => {
    setChannels(CHANNEL_NAMES.map((name, i) => ({ name, enabled: i < 6, color: CHANNEL_COLORS[i] })));
    setSpeed(1);
    setZoom(1);
    setProtocol("None");
  } }, "\u{1F504} Defaults"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement("div", { style: {
    fontFamily: GENEVA,
    fontSize: 9,
    padding: "2px 6px",
    border: "1px solid #808080",
    background: "#fff",
    boxShadow: "inset 1px 1px 0 #e0e0e0"
  } }, "\u{1F52C} MacLogic\u2122 \u2014 \xA9 1991 Anthropic Systems, Inc."))));
}
const __artifactDefault = LogicAnalyzer;
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(__artifactDefault));
