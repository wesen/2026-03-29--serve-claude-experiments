import React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
const CHICAGO = `"Chicago", "Geneva", "Charcoal", monospace`;
const TITLE_BAR_LINES = `repeating-linear-gradient(0deg, #000 0px, #000 1px, #fff 1px, #fff 3px)`;
const PATTERNS = [
  // Diagonal hash
  (ctx, color) => {
    const p = document.createElement("canvas");
    p.width = 6;
    p.height = 6;
    const pc = p.getContext("2d");
    pc.fillStyle = "#fff";
    pc.fillRect(0, 0, 6, 6);
    pc.strokeStyle = color;
    pc.lineWidth = 1;
    pc.beginPath();
    pc.moveTo(0, 6);
    pc.lineTo(6, 0);
    pc.stroke();
    return ctx.createPattern(p, "repeat");
  },
  // Dots
  (ctx, color) => {
    const p = document.createElement("canvas");
    p.width = 4;
    p.height = 4;
    const pc = p.getContext("2d");
    pc.fillStyle = "#fff";
    pc.fillRect(0, 0, 4, 4);
    pc.fillStyle = color;
    pc.fillRect(0, 0, 2, 2);
    return ctx.createPattern(p, "repeat");
  },
  // Horizontal lines
  (ctx, color) => {
    const p = document.createElement("canvas");
    p.width = 4;
    p.height = 4;
    const pc = p.getContext("2d");
    pc.fillStyle = "#fff";
    pc.fillRect(0, 0, 4, 4);
    pc.fillStyle = color;
    pc.fillRect(0, 0, 4, 2);
    return ctx.createPattern(p, "repeat");
  },
  // Cross hatch
  (ctx, color) => {
    const p = document.createElement("canvas");
    p.width = 6;
    p.height = 6;
    const pc = p.getContext("2d");
    pc.fillStyle = "#fff";
    pc.fillRect(0, 0, 6, 6);
    pc.strokeStyle = color;
    pc.lineWidth = 1;
    pc.beginPath();
    pc.moveTo(0, 6);
    pc.lineTo(6, 0);
    pc.moveTo(0, 0);
    pc.lineTo(6, 6);
    pc.stroke();
    return ctx.createPattern(p, "repeat");
  },
  // Vertical lines
  (ctx, color) => {
    const p = document.createElement("canvas");
    p.width = 4;
    p.height = 4;
    const pc = p.getContext("2d");
    pc.fillStyle = "#fff";
    pc.fillRect(0, 0, 4, 4);
    pc.fillStyle = color;
    pc.fillRect(0, 0, 2, 4);
    return ctx.createPattern(p, "repeat");
  },
  // Dense dots
  (ctx, color) => {
    const p = document.createElement("canvas");
    p.width = 3;
    p.height = 3;
    const pc = p.getContext("2d");
    pc.fillStyle = "#fff";
    pc.fillRect(0, 0, 3, 3);
    pc.fillStyle = color;
    pc.fillRect(0, 0, 1, 1);
    pc.fillRect(1, 2, 1, 1);
    return ctx.createPattern(p, "repeat");
  }
];
const MARKER_SHAPES = ["square", "diamond", "circle", "triangle", "cross"];
const SAMPLE_DATASETS = {
  "Quarterly Revenue": {
    labels: ["Q1 '90", "Q2 '90", "Q3 '90", "Q4 '90", "Q1 '91", "Q2 '91"],
    series: [
      { name: "Hardware", values: [42, 55, 48, 72, 63, 81] },
      { name: "Software", values: [28, 34, 41, 38, 52, 59] },
      { name: "Services", values: [15, 18, 22, 25, 28, 35] }
    ]
  },
  "System Performance": {
    labels: ["10ms", "20ms", "50ms", "100ms", "200ms", "500ms", "1s"],
    series: [
      { name: "Macintosh IIci", values: [95, 91, 82, 68, 45, 22, 10] },
      { name: "Macintosh LC", values: [88, 80, 65, 48, 30, 12, 5] },
      { name: "Macintosh Plus", values: [60, 50, 35, 20, 10, 4, 1] }
    ]
  },
  "Disk Usage": {
    labels: ["System", "Apps", "Documents", "Graphics", "Fonts", "Other"],
    series: [
      { name: "Usage", values: [12, 28, 18, 24, 8, 10] }
    ]
  },
  "Bug Tracker": {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    series: [
      { name: "Opened", values: [23, 31, 18, 42, 27, 15] },
      { name: "Closed", values: [12, 28, 22, 35, 30, 25] }
    ]
  }
};
function MacWindow({ title, active, children, width, height, style }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    width,
    background: "#fff",
    border: "2px solid #000",
    boxShadow: "3px 3px 0 #000",
    display: "flex",
    flexDirection: "column",
    fontFamily: CHICAGO,
    ...style
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: 22,
    background: active ? TITLE_BAR_LINES : "#fff",
    borderBottom: "2px solid #000",
    display: "flex",
    alignItems: "center",
    padding: "0 4px",
    gap: 4,
    flexShrink: 0
  } }, /* @__PURE__ */ React.createElement("div", { style: { width: 12, height: 12, border: "1px solid #000", background: "#fff", flexShrink: 0 } }), /* @__PURE__ */ React.createElement("div", { style: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: CHICAGO,
    background: active ? "rgba(255,255,255,0.8)" : "transparent",
    padding: "0 4px",
    whiteSpace: "nowrap"
  } }, title)), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, overflow: "hidden", height: height ? height - 22 : void 0 } }, children));
}
function drawMarker(ctx, shape, x, y, size) {
  ctx.beginPath();
  switch (shape) {
    case "square":
      ctx.rect(x - size, y - size, size * 2, size * 2);
      break;
    case "diamond":
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
      break;
    case "circle":
      ctx.arc(x, y, size, 0, Math.PI * 2);
      break;
    case "triangle":
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.lineTo(x - size, y + size);
      ctx.closePath();
      break;
    case "cross":
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.moveTo(x, y - size);
      ctx.lineTo(x, y + size);
      break;
  }
}
function drawLineChart(canvas, data, tooltip) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;
  const allVals = data.series.flatMap((s) => s.values);
  const maxVal = Math.ceil(Math.max(...allVals) / 10) * 10;
  const minVal = 0;
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + ch / 5 * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.stroke();
  ctx.fillStyle = "#000";
  ctx.font = `10px ${CHICAGO}`;
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const val = Math.round(maxVal - (maxVal - minVal) * (i / 5));
    const y = pad.top + ch / 5 * i;
    ctx.fillText(val, pad.left - 6, y + 4);
  }
  ctx.textAlign = "center";
  data.labels.forEach((label, i) => {
    const x = pad.left + cw / (data.labels.length - 1) * i;
    ctx.fillText(label, x, pad.top + ch + 16);
  });
  const dashPatterns = [[], [6, 3], [2, 2], [8, 3, 2, 3], [4, 4]];
  data.series.forEach((series, si) => {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.setLineDash(dashPatterns[si % dashPatterns.length]);
    ctx.beginPath();
    series.values.forEach((val, vi) => {
      const x = pad.left + cw / (data.labels.length - 1) * vi;
      const y = pad.top + ch - (val - minVal) / (maxVal - minVal) * ch;
      if (vi === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    series.values.forEach((val, vi) => {
      const x = pad.left + cw / (data.labels.length - 1) * vi;
      const y = pad.top + ch - (val - minVal) / (maxVal - minVal) * ch;
      drawMarker(ctx, MARKER_SHAPES[si % MARKER_SHAPES.length], x, y, 4);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  });
  if (tooltip) {
    const { x, y, label, items } = tooltip;
    const tw = 120, th = 14 + items.length * 14;
    const tx = Math.min(x + 10, W - tw - 4);
    const ty = Math.max(y - th - 10, 4);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.fillRect(tx, ty, tw, th);
    ctx.strokeRect(tx, ty, tw, th);
    ctx.fillStyle = "#000";
    ctx.font = `bold 10px ${CHICAGO}`;
    ctx.textAlign = "left";
    ctx.fillText(label, tx + 4, ty + 11);
    ctx.font = `10px ${CHICAGO}`;
    items.forEach((item, i) => {
      ctx.fillText(`${item.name}: ${item.value}`, tx + 4, ty + 25 + i * 14);
    });
  }
}
function drawBarChart(canvas, data, tooltip) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;
  const allVals = data.series.flatMap((s) => s.values);
  const maxVal = Math.ceil(Math.max(...allVals) / 10) * 10;
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + ch / 5 * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.stroke();
  ctx.fillStyle = "#000";
  ctx.font = `10px ${CHICAGO}`;
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const val = Math.round(maxVal * (1 - i / 5));
    ctx.fillText(val, pad.left - 6, pad.top + ch / 5 * i + 4);
  }
  const nGroups = data.labels.length;
  const nSeries = data.series.length;
  const groupW = cw / nGroups;
  const barPad = groupW * 0.15;
  const barW = (groupW - barPad * 2) / nSeries;
  data.labels.forEach((label, gi) => {
    const gx = pad.left + groupW * gi;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.font = `10px ${CHICAGO}`;
    ctx.fillText(label, gx + groupW / 2, pad.top + ch + 16);
    data.series.forEach((series, si) => {
      const bx = gx + barPad + barW * si;
      const bh = series.values[gi] / maxVal * ch;
      const by = pad.top + ch - bh;
      const pattern = PATTERNS[si % PATTERNS.length](ctx, "#000");
      ctx.fillStyle = pattern;
      ctx.fillRect(bx, by, barW - 1, bh);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW - 1, bh);
    });
  });
  if (tooltip) {
    const { x, y, label, items } = tooltip;
    const tw = 120, th = 14 + items.length * 14;
    const tx = Math.min(x + 10, W - tw - 4);
    const ty = Math.max(y - th - 10, 4);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.fillRect(tx, ty, tw, th);
    ctx.strokeRect(tx, ty, tw, th);
    ctx.fillStyle = "#000";
    ctx.font = `bold 10px ${CHICAGO}`;
    ctx.textAlign = "left";
    ctx.fillText(label, tx + 4, ty + 11);
    ctx.font = `10px ${CHICAGO}`;
    items.forEach((item, i) => {
      ctx.fillText(`${item.name}: ${item.value}`, tx + 4, ty + 25 + i * 14);
    });
  }
}
function drawPieChart(canvas, data) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2 - 60, cy = H / 2;
  const r = Math.min(cx - 30, cy - 30);
  const values = data.series[0].values;
  const total = values.reduce((a, b) => a + b, 0);
  let angle = -Math.PI / 2;
  values.forEach((val, i) => {
    const slice = val / total * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    const pattern = PATTERNS[i % PATTERNS.length](ctx, "#000");
    ctx.fillStyle = pattern;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
    angle += slice;
  });
  const lx = W / 2 + 40, ly = 30;
  ctx.font = `bold 10px ${CHICAGO}`;
  ctx.fillStyle = "#000";
  ctx.textAlign = "left";
  ctx.fillText("Legend", lx, ly);
  values.forEach((val, i) => {
    const iy = ly + 18 + i * 22;
    const pattern = PATTERNS[i % PATTERNS.length](ctx, "#000");
    ctx.fillStyle = pattern;
    ctx.fillRect(lx, iy - 8, 14, 14);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, iy - 8, 14, 14);
    ctx.fillStyle = "#000";
    ctx.font = `10px ${CHICAGO}`;
    ctx.fillText(`${data.labels[i]} (${Math.round(val / total * 100)}%)`, lx + 20, iy + 3);
  });
}
function drawScatterChart(canvas, data) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;
  const allVals = data.series.flatMap((s) => s.values);
  const maxVal = Math.ceil(Math.max(...allVals) / 10) * 10;
  const maxX = data.labels.length - 1;
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + ch / 5 * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
    const x = pad.left + cw / 5 * i;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + ch);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.stroke();
  ctx.fillStyle = "#000";
  ctx.font = `10px ${CHICAGO}`;
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    ctx.fillText(Math.round(maxVal * (1 - i / 5)), pad.left - 6, pad.top + ch / 5 * i + 4);
  }
  ctx.textAlign = "center";
  data.labels.forEach((l, i) => {
    const x = pad.left + cw / maxX * i;
    ctx.fillText(l, x, pad.top + ch + 16);
  });
  data.series.forEach((series, si) => {
    series.values.forEach((val, vi) => {
      const x = pad.left + cw / maxX * vi;
      const y = pad.top + ch - val / maxVal * ch;
      drawMarker(ctx, MARKER_SHAPES[si % MARKER_SHAPES.length], x, y, 5);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  });
}
function ChartCanvas({ chartType, data, width, height }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const draw = useCallback((tip) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    switch (chartType) {
      case "line":
        drawLineChart(canvas, data, tip);
        break;
      case "bar":
        drawBarChart(canvas, data, tip);
        break;
      case "pie":
        drawPieChart(canvas, data);
        break;
      case "scatter":
        drawScatterChart(canvas, data);
        break;
    }
  }, [chartType, data]);
  useEffect(() => {
    draw(tooltip);
  }, [draw, tooltip]);
  const handleMouseMove = (e) => {
    if (chartType === "pie") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const cw = width - pad.left - pad.right;
    const nLabels = data.labels.length;
    const step = chartType === "bar" ? cw / nLabels : cw / (nLabels - 1);
    const relX = mx - pad.left;
    if (relX < 0 || relX > cw || my < pad.top || my > height - pad.bottom) {
      setTooltip(null);
      return;
    }
    const idx = chartType === "bar" ? Math.min(Math.floor(relX / step), nLabels - 1) : Math.min(Math.round(relX / step), nLabels - 1);
    setTooltip({
      x: mx,
      y: my,
      label: data.labels[idx],
      items: data.series.map((s) => ({ name: s.name, value: s.values[idx] }))
    });
  };
  return /* @__PURE__ */ React.createElement(
    "canvas",
    {
      ref: canvasRef,
      width,
      height,
      onMouseMove: handleMouseMove,
      onMouseLeave: () => setTooltip(null),
      style: { display: "block", cursor: tooltip ? "crosshair" : "default" }
    }
  );
}
function RadioGroup({ options, value, onChange }) {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" } }, options.map((opt) => /* @__PURE__ */ React.createElement("label", { key: opt.value, style: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    fontFamily: CHICAGO,
    fontSize: 11,
    cursor: "pointer"
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 14,
    height: 14,
    border: "2px solid #000",
    borderRadius: "50%",
    background: "#fff"
  } }, value === opt.value && /* @__PURE__ */ React.createElement("span", { style: {
    width: 8,
    height: 8,
    background: "#000",
    borderRadius: "50%",
    display: "block"
  } })), opt.label)));
}
function SelectBox({ options, value, onChange }) {
  return /* @__PURE__ */ React.createElement("div", { style: { position: "relative", display: "inline-block" } }, /* @__PURE__ */ React.createElement(
    "select",
    {
      value,
      onChange: (e) => onChange(e.target.value),
      style: {
        fontFamily: CHICAGO,
        fontSize: 11,
        padding: "2px 20px 2px 6px",
        border: "2px solid #000",
        background: "#fff",
        borderRadius: 0,
        appearance: "none",
        cursor: "pointer",
        boxShadow: "1px 1px 0 #000"
      }
    },
    options.map((o) => /* @__PURE__ */ React.createElement("option", { key: o, value: o }, o))
  ), /* @__PURE__ */ React.createElement("span", { style: {
    position: "absolute",
    right: 6,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 8,
    pointerEvents: "none"
  } }, "\u25BC"));
}
function LegendBar({ series, chartType }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 14,
    padding: "6px 12px",
    borderTop: "1px solid #000",
    background: "#f0f0f0",
    flexWrap: "wrap",
    alignItems: "center"
  } }, series.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 4 } }, chartType === "line" ? /* @__PURE__ */ React.createElement("svg", { width: "22", height: "10" }, /* @__PURE__ */ React.createElement(
    "line",
    {
      x1: "0",
      y1: "5",
      x2: "22",
      y2: "5",
      stroke: "#000",
      strokeWidth: "2",
      strokeDasharray: [[""], ["6,3"], ["2,2"], ["8,3,2,3"]][i % 4].join("")
    }
  ), MARKER_SHAPES[i % MARKER_SHAPES.length] === "circle" ? /* @__PURE__ */ React.createElement("circle", { cx: "11", cy: "5", r: "3", fill: "#fff", stroke: "#000", strokeWidth: "1.5" }) : /* @__PURE__ */ React.createElement("rect", { x: "8", y: "2", width: "6", height: "6", fill: "#fff", stroke: "#000", strokeWidth: "1.5" })) : /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-block",
    width: 14,
    height: 10,
    border: "1px solid #000",
    background: `repeating-linear-gradient(${45 + i * 30}deg, #000 0px, #000 1px, #fff 1px, #fff 3px)`
  } }), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: CHICAGO, fontSize: 10 } }, s.name))));
}
const DESKTOP_PATTERN = `repeating-conic-gradient(#7b7b8e 0% 25%, #9999af 0% 50%) 0 0 / 4px 4px`;
function ChartWidget() {
  const [chartType, setChartType] = useState("line");
  const [datasetKey, setDatasetKey] = useState("Quarterly Revenue");
  const data = SAMPLE_DATASETS[datasetKey];
  const CHART_W = 540;
  const CHART_H = 320;
  return /* @__PURE__ */ React.createElement("div", { style: {
    width: "100%",
    height: "100vh",
    background: DESKTOP_PATTERN,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: CHICAGO,
    padding: 20
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 0 } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: 22,
    background: "#fff",
    borderBottom: "2px solid #000",
    border: "2px solid #000",
    borderTopLeftRadius: 0,
    display: "flex",
    alignItems: "center",
    padding: "0 12px",
    fontSize: 11,
    fontFamily: CHICAGO,
    gap: 16,
    width: CHART_W + 184
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", fontSize: 13 } }, "\u{1F34E}"), /* @__PURE__ */ React.createElement("span", null, "File"), /* @__PURE__ */ React.createElement("span", null, "Edit"), /* @__PURE__ */ React.createElement("span", null, "Chart"), /* @__PURE__ */ React.createElement("span", null, "Format"), /* @__PURE__ */ React.createElement("span", null, "Window")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0 } }, /* @__PURE__ */ React.createElement(MacWindow, { title: `\u{1F4CA} ${datasetKey} \u2014 ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`, active: true, width: CHART_W + 4 }, /* @__PURE__ */ React.createElement(
    ChartCanvas,
    {
      chartType,
      data,
      width: CHART_W,
      height: CHART_H
    }
  ), data.series.length > 0 && /* @__PURE__ */ React.createElement(LegendBar, { series: data.series, chartType })), /* @__PURE__ */ React.createElement(MacWindow, { title: "\u2699\uFE0F Options", active: false, width: 180, style: { marginLeft: -2 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: 10, display: "flex", flexDirection: "column", gap: 14 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: CHICAGO,
    borderBottom: "1px solid #000",
    paddingBottom: 2,
    marginBottom: 6
  } }, "Chart Type"), /* @__PURE__ */ React.createElement(
    RadioGroup,
    {
      options: [
        { value: "line", label: "\u{1F4C8} Line" },
        { value: "bar", label: "\u{1F4CA} Bar" },
        { value: "pie", label: "\u{1F967} Pie" },
        { value: "scatter", label: "\u2B50 Scatter" }
      ],
      value: chartType,
      onChange: setChartType
    }
  )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: CHICAGO,
    borderBottom: "1px solid #000",
    paddingBottom: 2,
    marginBottom: 6
  } }, "Dataset"), /* @__PURE__ */ React.createElement(
    SelectBox,
    {
      options: Object.keys(SAMPLE_DATASETS),
      value: datasetKey,
      onChange: setDatasetKey
    }
  )), /* @__PURE__ */ React.createElement("div", { style: {
    background: "#f0f0f0",
    border: "1px solid #999",
    padding: 6,
    fontSize: 9,
    lineHeight: 1.4,
    boxShadow: "inset 1px 1px 0 #ccc"
  } }, /* @__PURE__ */ React.createElement("b", null, "\u2139\uFE0F Info"), /* @__PURE__ */ React.createElement("br", null), "Series: ", data.series.length, /* @__PURE__ */ React.createElement("br", null), "Points: ", data.labels.length, /* @__PURE__ */ React.createElement("br", null), "Max: ", Math.max(...data.series.flatMap((s) => s.values))), /* @__PURE__ */ React.createElement("div", { style: {
    border: "2px solid #000",
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `repeating-linear-gradient(45deg, #fff 0px, #fff 3px, #eee 3px, #eee 6px)`,
    fontSize: 10
  } }, "\u{1F5A8}\uFE0F Print Chart\u2026"))))));
}
const __artifactDefault = ChartWidget;
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(__artifactDefault));
