import React from "react";
import { useState, useEffect, Fragment } from "react";
const ACCOUNTS = [
  { id: "a1", institution_name: "First National Bank", type: "bank", scope: "business", masked: "****4521", balance: 28450 },
  { id: "a2", institution_name: "Chase Ink Business", type: "credit_card", scope: "business", masked: "****8832", balance: -3240.5 },
  { id: "a3", institution_name: "Stripe Connect", type: "payment_processor", scope: "business", masked: null, balance: 1820 },
  { id: "a4", institution_name: "Wells Fargo Personal", type: "bank", scope: "personal", masked: "****1103", balance: 12300 }
];
const TRANSACTIONS = [
  { id: "t1", occurred_at: "2025-03-20", direction: "inflow", amount: 8500, description: "Client payment \u2014 Consulting Mar", account: "Stripe", category: "Revenue", status: "cleared" },
  { id: "t2", occurred_at: "2025-03-18", direction: "outflow", amount: 299, description: "Amazon Web Services \u2014 us-east-1", account: "Chase ****8832", category: "Cloud", status: "cleared" },
  { id: "t3", occurred_at: "2025-03-15", direction: "outflow", amount: 49, description: "Linear \u2014 monthly subscription", account: "Chase ****8832", category: "Software", status: "cleared" },
  { id: "t4", occurred_at: "2025-03-12", direction: "outflow", amount: 64.99, description: '"Designing Data-Intensive Apps" OReilly', account: "Chase ****8832", category: "Books", status: "needs_review" },
  { id: "t5", occurred_at: "2025-03-10", direction: "inflow", amount: 12e3, description: "Retainer \u2014 ACME Corp April", account: "Stripe", category: "Revenue", status: "cleared" },
  { id: "t6", occurred_at: "2025-03-08", direction: "outflow", amount: 1299, description: "B&H Photo \u2014 monitor + peripherals", account: "Chase ****8832", category: "Hardware", status: "needs_review" },
  { id: "t7", occurred_at: "2025-03-05", direction: "outflow", amount: 19, description: "1Password Teams", account: "Chase ****8832", category: "Software", status: "cleared" },
  { id: "t8", occurred_at: "2025-03-01", direction: "outflow", amount: 200, description: "Estimated tax payment Q1 2025", account: "First National", category: "Tax", status: "cleared" },
  { id: "t9", occurred_at: "2025-02-28", direction: "inflow", amount: 22300, description: "Client payment \u2014 Feb consulting", account: "Stripe", category: "Revenue", status: "cleared" },
  { id: "t10", occurred_at: "2025-02-15", direction: "outflow", amount: 299, description: "AWS \u2014 Feb", account: "Chase ****8832", category: "Cloud", status: "cleared" }
];
const PURCHASES = [
  {
    id: "p1",
    vendor: "Amazon Web Services",
    date: "2025-03-18",
    invoice: "INV-8821-0325",
    amount: 299,
    scope: "business",
    status: "reviewed",
    purpose: "Cloud infrastructure for client projects",
    lines: [
      { type: "cloud", description: "EC2 compute \u2014 us-east-1", amount: 187.42 },
      { type: "cloud", description: "S3 storage", amount: 42.18 },
      { type: "cloud", description: "CloudFront CDN", amount: 69.4 }
    ]
  },
  {
    id: "p2",
    vendor: "O'Reilly Media",
    date: "2025-03-12",
    invoice: null,
    amount: 64.99,
    scope: "business",
    status: "draft",
    purpose: "Technical reference \u2014 distributed systems consulting",
    lines: [
      { type: "book", description: "Designing Data-Intensive Applications", amount: 64.99 }
    ]
  },
  {
    id: "p3",
    vendor: "B&H Photo Video",
    date: "2025-03-08",
    invoice: "ORD-BH-991234",
    amount: 1299,
    scope: "business",
    status: "draft",
    purpose: "Ergonomic workstation setup for client deliverables",
    lines: [
      { type: "hardware", description: 'LG 27" 4K Monitor', amount: 799, is_asset: true },
      { type: "hardware", description: "Monitor arm", amount: 149 },
      { type: "hardware", description: "USB-C hub (Anker)", amount: 89 },
      { type: "office", description: "Keychron Q1 keyboard", amount: 262, is_asset: true }
    ]
  },
  {
    id: "p4",
    vendor: "Linear",
    date: "2025-03-15",
    invoice: "LIN-2025-03",
    amount: 49,
    scope: "business",
    status: "reviewed",
    purpose: "Project management \u2014 client work tracking",
    lines: [
      { type: "subscription", description: "Linear Business \u2014 monthly", amount: 49 }
    ]
  }
];
const ASSETS = [
  { id: "as1", description: 'LG 27" 4K Monitor', assetClass: "monitor", date: "2025-03-08", cost: 799, basis: 799, busUse: 100, status: "in_service", method: "Section 179" },
  { id: "as2", description: 'MacBook Pro 14" M3', assetClass: "computer", date: "2024-11-15", cost: 1999, basis: 1799.1, busUse: 90, status: "in_service", method: "Section 179" },
  { id: "as3", description: '"Clean Code" \u2014 Martin', assetClass: "book_collection", date: "2024-09-01", cost: 44.99, basis: 44.99, busUse: 0, status: "converted_to_personal", method: "Expensed" },
  { id: "as4", description: "Keychron Q1 Keyboard", assetClass: "equipment", date: "2025-03-08", cost: 262, basis: 262, busUse: 100, status: "in_service", method: "Expensed" }
];
const GL_ACCOUNTS = [
  { code: "1000", name: "Cash \u2014 Business Checking", category: "asset", balance: 28450 },
  { code: "1010", name: "Cash \u2014 Payment Processor", category: "asset", balance: 1820 },
  { code: "1200", name: "Accounts Receivable", category: "asset", balance: 0 },
  { code: "1500", name: "Computer Equipment", category: "asset", balance: 2861.1 },
  { code: "1510", name: "Acc. Depreciation \u2014 Equip", category: "contra", balance: 0 },
  { code: "2000", name: "Credit Card Payable", category: "liability", balance: 3240.5 },
  { code: "2100", name: "Sales Tax Payable", category: "liability", balance: 0 },
  { code: "2900", name: "Deferred Revenue", category: "liability", balance: 0 },
  { code: "3000", name: "Owner Equity", category: "equity", balance: 26889 },
  { code: "3100", name: "Owner Draws", category: "equity", balance: 0 },
  { code: "4000", name: "Consulting Revenue", category: "income", balance: 42800 },
  { code: "6100", name: "Cloud & Hosting", category: "expense", balance: 897 },
  { code: "6200", name: "Software & Subscriptions", category: "expense", balance: 340 },
  { code: "6300", name: "Books & Education", category: "expense", balance: 204.97 },
  { code: "6400", name: "Hardware & Equipment", category: "expense", balance: 0 },
  { code: "6500", name: "Professional Services", category: "expense", balance: 500 },
  { code: "6600", name: "Office & Supplies", category: "expense", balance: 89 },
  { code: "7000", name: "SE Tax", category: "expense", balance: 800 }
];
const fmt = (n) => {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "\u2212" : "") + "$" + abs;
};
const fmtDate = (s) => (/* @__PURE__ */ new Date(s + "T12:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
const BADGE_META = {
  cleared: { label: "Cleared", cls: "badge-green" },
  reviewed: { label: "Reviewed", cls: "badge-blue" },
  draft: { label: "Draft", cls: "badge-amber" },
  needs_review: { label: "Review", cls: "badge-red" },
  in_service: { label: "Active", cls: "badge-blue" },
  converted_to_personal: { label: "Personal", cls: "badge-red" },
  posted: { label: "Posted", cls: "badge-green" },
  business: { label: "Business", cls: "badge-blue" },
  personal: { label: "Personal", cls: "badge-amber" }
};
const Badge = ({ status }) => {
  const m = BADGE_META[status] || { label: status, cls: "badge-blue" };
  return /* @__PURE__ */ React.createElement("span", { className: `badge ${m.cls}` }, m.label);
};
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --font:        'DM Mono', 'Courier New', monospace;
  --bg-desktop:  #909090;
  --bg-win:      #ffffff;
  --bg-menubar:  #ffffff;
  --bg-sidebar:  #f4f4f4;
  --bg-row-alt:  #f9f9f9;
  --bg-row-hover:#eeeeee;
  --bg-selected: #000000;
  --border:      #000000;
  --grid:        #d8d8d8;
  --text:        #111111;
  --text-dim:    #666666;
  --text-inv:    #ffffff;

  --c-pos:       #1a4a1a;
  --c-neg:       #4a1a1a;
  --c-neu:       #1a2a4a;
  --c-wrn:       #443010;

  --bg-green:    #e6f0e6;
  --bg-red:      #f0e6e6;
  --bg-blue:     #e6eaf0;
  --bg-amber:    #f0ece0;

  --bd-green:    #2a6a2a;
  --bd-red:      #6a2a2a;
  --bd-blue:     #2a3a6a;
  --bd-amber:    #6a4a10;
}

html, body {
  font-family: var(--font);
  font-size: 11px;
  background: var(--bg-desktop);
  min-height: 100vh;
  -webkit-font-smoothing: none;
}

/* \u2500\u2500 Desktop \u2500\u2500 */
.desktop {
  min-height: 100vh;
  background:
    repeating-linear-gradient(0deg, transparent, transparent 7px, rgba(0,0,0,.06) 7px, rgba(0,0,0,.06) 8px),
    repeating-linear-gradient(90deg, transparent, transparent 7px, rgba(0,0,0,.06) 7px, rgba(0,0,0,.06) 8px);
  background-color: var(--bg-desktop);
  display: flex;
  flex-direction: column;
  padding: 0;
}

/* \u2500\u2500 Menu Bar \u2500\u2500 */
.menubar {
  height: 20px;
  background: var(--bg-menubar);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  user-select: none;
  z-index: 99;
}
.mb-item {
  padding: 1px 9px 2px;
  font-size: 11px;
  font-weight: 400;
  cursor: default;
  white-space: nowrap;
  line-height: 18px;
}
.mb-item:hover { background: var(--bg-selected); color: var(--text-inv); }
.mb-bold { font-weight: 600; }
.mb-spacer { flex: 1; }
.mb-clock { padding: 0 10px; font-size: 10px; color: var(--text-dim); }

/* \u2500\u2500 App Window \u2500\u2500 */
.win {
  margin: 14px auto;
  width: calc(100vw - 28px);
  max-width: 1240px;
  height: calc(100vh - 50px);
  background: var(--bg-win);
  border: 2px solid var(--border);
  box-shadow: 4px 4px 0 rgba(0,0,0,.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* \u2500\u2500 Title Bar \u2500\u2500 */
.titlebar {
  height: 18px;
  background: repeating-linear-gradient(0deg,
    #ffffff 0px, #ffffff 1px,
    #111111 1px, #111111 2px
  );
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 0 3px;
  flex-shrink: 0;
  position: relative;
}
.tb-box {
  width: 11px; height: 11px;
  background: #fff;
  border: 1px solid var(--border);
  flex-shrink: 0;
  cursor: pointer;
}
.tb-box:hover { background: #000; }
.tb-title {
  position: absolute;
  left: 50%; transform: translateX(-50%);
  background: #fff;
  padding: 0 10px;
  font-size: 11px; font-weight: 500;
  white-space: nowrap;
}

/* \u2500\u2500 Body \u2500\u2500 */
.win-body { display: flex; flex: 1; min-height: 0; }

/* \u2500\u2500 Sidebar \u2500\u2500 */
.sidebar {
  width: 158px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
}
.sb-logo {
  padding: 6px 8px;
  font-size: 11px; font-weight: 600;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 6px;
  flex-shrink: 0;
}
.sb-group {
  padding: 5px 8px 2px;
  font-size: 9px; font-weight: 500;
  text-transform: uppercase; letter-spacing: .09em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--grid);
  margin-top: 2px;
  flex-shrink: 0;
}
.sb-item {
  padding: 4px 8px 4px 14px;
  font-size: 11px;
  display: flex; align-items: center; gap: 7px;
  cursor: default; user-select: none;
  border-bottom: 1px solid transparent;
  flex-shrink: 0;
}
.sb-item:hover { background: var(--bg-row-hover); }
.sb-item.active { background: var(--bg-selected); color: var(--text-inv); }
.sb-icon { font-size: 10px; width: 12px; text-align: center; flex-shrink: 0; }
.sb-spacer { flex: 1; }
.sb-footer {
  padding: 7px 8px;
  border-top: 1px solid var(--border);
  font-size: 10px;
  flex-shrink: 0;
}
.sb-footer-sub { color: var(--text-dim); margin-top: 2px; }

/* \u2500\u2500 Main content \u2500\u2500 */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

/* \u2500\u2500 Section header \u2500\u2500 */
.sec-hdr {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0; background: var(--bg-win);
}
.sec-title { font-size: 11px; font-weight: 500; }
.sec-sub { font-size: 9px; color: var(--text-dim); margin-top: 2px; }

/* \u2500\u2500 Buttons \u2500\u2500 */
.btn {
  padding: 2px 11px;
  font-family: var(--font); font-size: 11px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer; font-weight: 400;
  white-space: nowrap;
}
.btn:hover { background: #f0f0f0; }
.btn:active { background: var(--bg-selected); color: var(--text-inv); }
.btn.active { background: var(--bg-selected); color: var(--text-inv); }
.btn-sm { padding: 1px 8px; font-size: 10px; }

/* \u2500\u2500 Table / list view \u2500\u2500 */
.tbl-wrap { overflow: auto; flex: 1; }
table.lv { width: 100%; border-collapse: collapse; font-size: 11px; }
table.lv th {
  padding: 3px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--grid);
  background: var(--bg-sidebar);
  font-size: 9px; font-weight: 500;
  text-transform: uppercase; letter-spacing: .05em;
  color: var(--text-dim);
  white-space: nowrap;
  user-select: none;
}
table.lv th:last-child { border-right: none; }
table.lv td {
  padding: 3px 8px;
  border-bottom: 1px solid var(--grid);
  border-right: 1px solid var(--grid);
}
table.lv td:last-child { border-right: none; }
table.lv tr:nth-child(even) td { background: var(--bg-row-alt); }
table.lv tr:hover td { background: var(--bg-row-hover); }
table.lv tr.sel td { background: var(--bg-selected) !important; color: var(--text-inv) !important; }

.right { text-align: right; }
.center { text-align: center; }
.nowrap { white-space: nowrap; }
.dim { color: var(--text-dim); }
.pos { color: var(--c-pos); }
.neg { color: var(--c-neg); }

/* \u2500\u2500 Badges \u2500\u2500 */
.badge {
  display: inline-block;
  padding: 0 5px;
  font-size: 9px; font-weight: 500;
  border: 1px solid currentColor;
  text-transform: uppercase; letter-spacing: .05em;
  white-space: nowrap;
}
.badge-green { color: var(--bd-green); background: var(--bg-green); }
.badge-red   { color: var(--bd-red);   background: var(--bg-red);   }
.badge-blue  { color: var(--bd-blue);  background: var(--bg-blue);  }
.badge-amber { color: var(--bd-amber); background: var(--bg-amber); }

/* \u2500\u2500 Metrics strip \u2500\u2500 */
.metrics {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  border-bottom: 1px solid var(--border);
  background: var(--border);
  gap: 1px;
  flex-shrink: 0;
}
.metric {
  padding: 9px 12px;
  background: var(--bg-win);
}
.metric-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin-bottom: 4px; }
.metric-val { font-size: 20px; font-weight: 300; letter-spacing: -.02em; line-height: 1; }
.metric-sub { font-size: 9px; color: var(--text-dim); margin-top: 3px; }

/* \u2500\u2500 Dashboard 2x2 grid \u2500\u2500 */
.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 0;
  background: var(--border);
  flex: 1;
  min-height: 0;
}
.dash-panel {
  background: var(--bg-win);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dp-title {
  padding: 4px 10px;
  font-size: 9px; font-weight: 500;
  text-transform: uppercase; letter-spacing: .07em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--grid);
  background: var(--bg-sidebar);
  flex-shrink: 0;
}
.dp-scroll { overflow-y: auto; flex: 1; }

/* \u2500\u2500 Progress bar \u2500\u2500 */
.pbar { height: 5px; background: var(--grid); border: 1px solid #bbb; margin-top: 3px; }
.pfill { height: 100%; background: var(--bg-selected); }

/* \u2500\u2500 Account cards \u2500\u2500 */
.acc-card {
  margin: 6px 8px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center;
}
.acc-biz { border-left: 3px solid #000; }
.acc-per { border-left: 3px solid #999; }

/* \u2500\u2500 Purchase line expansion \u2500\u2500 */
.pl-wrap { padding: 4px 8px 6px 32px; background: #f8f8f8; }
.pl-row {
  display: flex; justify-content: space-between;
  padding: 2px 0;
  font-size: 10px; color: var(--text-dim);
  border-bottom: 1px dotted var(--grid);
}
.pl-row:last-child { border-bottom: 1px solid var(--grid); font-weight: 500; color: var(--text); }

/* \u2500\u2500 Asset detail panel \u2500\u2500 */
.asset-detail {
  width: 210px;
  border-left: 1px solid var(--border);
  padding: 10px;
  font-size: 11px;
  display: flex; flex-direction: column; gap: 7px;
  overflow-y: auto;
  flex-shrink: 0;
}
.ad-kv {
  display: flex; justify-content: space-between;
  border-bottom: 1px dotted var(--grid);
  padding-bottom: 3px; font-size: 10px;
}
.ad-kv span:first-child { color: var(--text-dim); }

/* \u2500\u2500 GL category accent \u2500\u2500 */
.gl-asset     td:first-child { border-left: 2px solid #2a5e8a; }
.gl-liability td:first-child { border-left: 2px solid #8a2a2a; }
.gl-equity    td:first-child { border-left: 2px solid #5a2a8a; }
.gl-income    td:first-child { border-left: 2px solid #2a8a2a; }
.gl-expense   td:first-child { border-left: 2px solid #7a6020; }
.gl-contra    td:first-child { border-left: 2px solid #888; }
.gl-group-hdr td {
  padding: 3px 8px;
  font-size: 9px; font-weight: 500;
  text-transform: uppercase; letter-spacing: .1em;
  color: var(--text-dim);
  background: var(--bg-sidebar) !important;
}

/* \u2500\u2500 Tax center \u2500\u2500 */
.tax-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--border);
  padding: 1px;
  flex: 1;
}
.tax-panel {
  background: var(--bg-win);
  padding: 12px 14px;
  overflow-y: auto;
}
.tax-title {
  font-size: 9px; font-weight: 500;
  text-transform: uppercase; letter-spacing: .09em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--grid);
  padding-bottom: 5px; margin-bottom: 8px;
}
.tax-row {
  display: flex; justify-content: space-between;
  padding: 3px 0;
  border-bottom: 1px solid var(--grid);
  font-size: 11px;
}
.tax-row:last-child { border-bottom: none; }
.tax-row .lbl { color: var(--text-dim); }
.tax-total {
  display: flex; justify-content: space-between;
  padding: 5px 0 0;
  margin-top: 5px;
  font-weight: 500;
  border-top: 2px solid var(--border);
}
.ded-dot { font-size: 9px; margin-right: 5px; }

/* \u2500\u2500 Scrollbars \u2500\u2500 */
::-webkit-scrollbar { width: 14px; height: 14px; }
::-webkit-scrollbar-track { background: #fff; border-left: 1px solid #aaa; }
::-webkit-scrollbar-thumb { background: #d0d0d0; border: 1px solid #888; }
::-webkit-scrollbar-button:single-button {
  display: block; background: #e8e8e8;
  border: 1px solid #888; height: 14px; width: 14px;
}
`;
function Dashboard() {
  const bizCash = ACCOUNTS.filter((a) => a.scope === "business").reduce((s, a) => s + a.balance, 0);
  const ytdIn = TRANSACTIONS.filter((t) => t.direction === "inflow").reduce((s, t) => s + t.amount, 0);
  const ytdOut = TRANSACTIONS.filter((t) => t.direction === "outflow").reduce((s, t) => s + t.amount, 0);
  const net = ytdIn - ytdOut;
  const seTax = net * 0.9235 * 0.153;
  const pending = TRANSACTIONS.filter((t) => t.status === "needs_review").length + PURCHASES.filter((p) => p.status === "draft").length;
  const expCats = [
    { name: "Cloud", amt: 897 },
    { name: "Software", amt: 340 },
    { name: "Books", amt: 204.97 },
    { name: "Tax pmts", amt: 200 },
    { name: "Other", amt: 89 }
  ];
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "metrics" }, [
    { lbl: "Business Cash", val: fmt(bizCash), sub: "3 accounts", cls: "" },
    { lbl: "YTD Revenue", val: fmt(ytdIn), sub: "Jan\u2013Mar 2025", cls: "pos" },
    { lbl: "YTD Expenses", val: fmt(ytdOut), sub: ytdOut.toFixed(0) + " txns", cls: "neg" },
    { lbl: "Net Income", val: fmt(net), sub: "before SE tax", cls: net >= 0 ? "pos" : "neg" },
    { lbl: "Est. SE Tax", val: fmt(seTax), sub: "15.3% \xD7 92.35%", cls: "neg" },
    { lbl: "Needs Review", val: String(pending), sub: "items pending", cls: pending > 0 ? "neg" : "pos" }
  ].map((m) => /* @__PURE__ */ React.createElement("div", { key: m.lbl, className: "metric" }, /* @__PURE__ */ React.createElement("div", { className: "metric-lbl" }, m.lbl), /* @__PURE__ */ React.createElement("div", { className: `metric-val ${m.cls}` }, m.val), /* @__PURE__ */ React.createElement("div", { className: "metric-sub" }, m.sub)))), /* @__PURE__ */ React.createElement("div", { className: "dash-grid" }, /* @__PURE__ */ React.createElement("div", { className: "dash-panel" }, /* @__PURE__ */ React.createElement("div", { className: "dp-title" }, "Recent Transactions"), /* @__PURE__ */ React.createElement("div", { className: "dp-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "lv", style: { width: "100%" } }, /* @__PURE__ */ React.createElement("tbody", null, TRANSACTIONS.slice(0, 7).map((t) => /* @__PURE__ */ React.createElement("tr", { key: t.id }, /* @__PURE__ */ React.createElement("td", { className: "dim nowrap", style: { fontSize: 10, width: 72 } }, fmtDate(t.occurred_at)), /* @__PURE__ */ React.createElement("td", { style: { overflow: "hidden", maxWidth: 200, whiteSpace: "nowrap", textOverflow: "ellipsis" } }, t.description), /* @__PURE__ */ React.createElement("td", { className: `right nowrap ${t.direction === "inflow" ? "pos" : "neg"}` }, t.direction === "inflow" ? "+" : "\u2212", fmt(t.amount)), /* @__PURE__ */ React.createElement("td", { className: "center", style: { width: 64 } }, /* @__PURE__ */ React.createElement(Badge, { status: t.status })))))))), /* @__PURE__ */ React.createElement("div", { className: "dash-panel" }, /* @__PURE__ */ React.createElement("div", { className: "dp-title" }, "YTD Expense Breakdown"), /* @__PURE__ */ React.createElement("div", { className: "dp-scroll", style: { padding: "8px 12px" } }, expCats.map((c) => {
    const pct = Math.round(c.amt / ytdOut * 100);
    return /* @__PURE__ */ React.createElement("div", { key: c.name, style: { marginBottom: 9 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 2, fontSize: 10 } }, /* @__PURE__ */ React.createElement("span", null, c.name), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--font)" } }, fmt(c.amt), " (", pct, "%)")), /* @__PURE__ */ React.createElement("div", { className: "pbar" }, /* @__PURE__ */ React.createElement("div", { className: "pfill", style: { width: pct + "%" } })));
  }))), /* @__PURE__ */ React.createElement("div", { className: "dash-panel" }, /* @__PURE__ */ React.createElement("div", { className: "dp-title" }, "Pending Action (", pending, ")"), /* @__PURE__ */ React.createElement("div", { className: "dp-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "lv" }, /* @__PURE__ */ React.createElement("tbody", null, TRANSACTIONS.filter((t) => t.status === "needs_review").map((t) => /* @__PURE__ */ React.createElement("tr", { key: t.id }, /* @__PURE__ */ React.createElement("td", { style: { width: 60 } }, /* @__PURE__ */ React.createElement(Badge, { status: "needs_review" })), /* @__PURE__ */ React.createElement("td", null, t.description), /* @__PURE__ */ React.createElement("td", { className: "right neg nowrap" }, fmt(t.amount)))), PURCHASES.filter((p) => p.status === "draft").map((p) => /* @__PURE__ */ React.createElement("tr", { key: p.id }, /* @__PURE__ */ React.createElement("td", { style: { width: 60 } }, /* @__PURE__ */ React.createElement(Badge, { status: "draft" })), /* @__PURE__ */ React.createElement("td", null, p.vendor), /* @__PURE__ */ React.createElement("td", { className: "right neg nowrap" }, fmt(p.amount)))), pending === 0 && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: 3, className: "center dim", style: { padding: 16 } }, "All clear \u2713")))))), /* @__PURE__ */ React.createElement("div", { className: "dash-panel" }, /* @__PURE__ */ React.createElement("div", { className: "dp-title" }, "Asset Register"), /* @__PURE__ */ React.createElement("div", { className: "dp-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "lv" }, /* @__PURE__ */ React.createElement("tbody", null, ASSETS.map((a) => /* @__PURE__ */ React.createElement("tr", { key: a.id }, /* @__PURE__ */ React.createElement("td", { style: { overflow: "hidden", maxWidth: 180, whiteSpace: "nowrap", textOverflow: "ellipsis" } }, a.description), /* @__PURE__ */ React.createElement("td", { className: "center", style: { width: 76 } }, /* @__PURE__ */ React.createElement(Badge, { status: a.status })), /* @__PURE__ */ React.createElement("td", { className: "right dim", style: { width: 40 } }, a.busUse, "%"), /* @__PURE__ */ React.createElement("td", { className: "right", style: { width: 80, fontFamily: "var(--font)" } }, fmt(a.basis))))))))));
}
function TransactionsView() {
  const [sel, setSel] = useState(null);
  const [filter, setFilt] = useState("all");
  const rows = TRANSACTIONS.filter((t) => {
    if (filter === "inflow") return t.direction === "inflow";
    if (filter === "outflow") return t.direction === "outflow";
    if (filter === "review") return t.status === "needs_review";
    return true;
  });
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "sec-hdr" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sec-title" }, "Money Transactions"), /* @__PURE__ */ React.createElement("div", { className: "sec-sub" }, rows.length, " records \xB7 raw payment events")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, [
    { k: "all", l: "All" },
    { k: "inflow", l: "\u2193 Inflow" },
    { k: "outflow", l: "\u2191 Outflow" },
    { k: "review", l: "\u2691 Review" }
  ].map((f) => /* @__PURE__ */ React.createElement("button", { key: f.k, className: `btn btn-sm ${filter === f.k ? "active" : ""}`, onClick: () => setFilt(f.k) }, f.l)), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm" }, "+ New"))), /* @__PURE__ */ React.createElement("div", { className: "tbl-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "lv" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: { width: 80 } }, "Date"), /* @__PURE__ */ React.createElement("th", null, "Description"), /* @__PURE__ */ React.createElement("th", null, "Account"), /* @__PURE__ */ React.createElement("th", null, "Category"), /* @__PURE__ */ React.createElement("th", { className: "right", style: { width: 100 } }, "Amount"), /* @__PURE__ */ React.createElement("th", { className: "center", style: { width: 72 } }, "Status"))), /* @__PURE__ */ React.createElement("tbody", null, rows.map((t) => /* @__PURE__ */ React.createElement("tr", { key: t.id, className: sel === t.id ? "sel" : "", onClick: () => setSel(t.id === sel ? null : t.id) }, /* @__PURE__ */ React.createElement("td", { className: "nowrap dim", style: { fontSize: 10 } }, fmtDate(t.occurred_at)), /* @__PURE__ */ React.createElement("td", null, t.description), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { fontSize: 10 } }, t.account), /* @__PURE__ */ React.createElement("td", { style: { fontSize: 10 } }, t.category), /* @__PURE__ */ React.createElement("td", { className: `right nowrap ${t.direction === "inflow" ? "pos" : "neg"}` }, t.direction === "inflow" ? "+" : "\u2212", fmt(t.amount)), /* @__PURE__ */ React.createElement("td", { className: "center" }, /* @__PURE__ */ React.createElement(Badge, { status: t.status }))))))));
}
function PurchasesView() {
  const [expanded, setExp] = useState(null);
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "sec-hdr" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sec-title" }, "Purchases & Expenses"), /* @__PURE__ */ React.createElement("div", { className: "sec-sub" }, PURCHASES.length, " records \xB7 click row to expand line items")), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm" }, "+ New Purchase")), /* @__PURE__ */ React.createElement("div", { className: "tbl-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "lv" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: { width: 16 } }), /* @__PURE__ */ React.createElement("th", { style: { width: 80 } }, "Date"), /* @__PURE__ */ React.createElement("th", null, "Vendor"), /* @__PURE__ */ React.createElement("th", null, "Invoice #"), /* @__PURE__ */ React.createElement("th", null, "Business Purpose"), /* @__PURE__ */ React.createElement("th", { className: "center", style: { width: 70 } }, "Source"), /* @__PURE__ */ React.createElement("th", { className: "right", style: { width: 90 } }, "Amount"), /* @__PURE__ */ React.createElement("th", { className: "center", style: { width: 70 } }, "Status"))), /* @__PURE__ */ React.createElement("tbody", null, PURCHASES.map((p) => /* @__PURE__ */ React.createElement(Fragment, { key: p.id }, /* @__PURE__ */ React.createElement("tr", { style: { cursor: "pointer" }, onClick: () => setExp(expanded === p.id ? null : p.id) }, /* @__PURE__ */ React.createElement("td", { className: "center dim", style: { fontSize: 9 } }, expanded === p.id ? "\u25BC" : "\u25B6"), /* @__PURE__ */ React.createElement("td", { className: "nowrap dim", style: { fontSize: 10 } }, fmtDate(p.date)), /* @__PURE__ */ React.createElement("td", { style: { fontWeight: 500 } }, p.vendor), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { fontSize: 10 } }, p.invoice || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { fontSize: 10, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.purpose), /* @__PURE__ */ React.createElement("td", { className: "center" }, /* @__PURE__ */ React.createElement(Badge, { status: p.scope })), /* @__PURE__ */ React.createElement("td", { className: "right neg" }, fmt(p.amount)), /* @__PURE__ */ React.createElement("td", { className: "center" }, /* @__PURE__ */ React.createElement(Badge, { status: p.status }))), expanded === p.id && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: 8, style: { padding: 0, background: "var(--bg-sidebar)" } }, /* @__PURE__ */ React.createElement("div", { className: "pl-wrap" }, p.lines.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "pl-row" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--text-dim)", marginRight: 8 } }, l.type), l.description, l.is_asset && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: 8, fontSize: 9, color: "var(--c-neu)", border: "1px solid currentColor", padding: "0 3px" } }, "ASSET")), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--font)" } }, fmt(l.amount)))), /* @__PURE__ */ React.createElement("div", { className: "pl-row" }, /* @__PURE__ */ React.createElement("span", null, "Total"), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--font)" } }, fmt(p.amount))))))))))));
}
function AssetsView() {
  const [sel, setSel] = useState(null);
  const asset = sel ? ASSETS.find((a) => a.id === sel) : null;
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flex: 1, minHeight: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "sec-hdr" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sec-title" }, "Asset Register"), /* @__PURE__ */ React.createElement("div", { className: "sec-sub" }, "Capital items \xB7 use tracking \xB7 depreciation \xB7 basis")), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm" }, "+ New Asset")), /* @__PURE__ */ React.createElement("div", { className: "tbl-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "lv" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Description"), /* @__PURE__ */ React.createElement("th", null, "Class"), /* @__PURE__ */ React.createElement("th", { style: { width: 80 } }, "In Service"), /* @__PURE__ */ React.createElement("th", { className: "right", style: { width: 100 } }, "Orig. Cost"), /* @__PURE__ */ React.createElement("th", { className: "right", style: { width: 100 } }, "Biz Basis"), /* @__PURE__ */ React.createElement("th", { className: "center", style: { width: 60 } }, "Biz %"), /* @__PURE__ */ React.createElement("th", { style: { width: 90 } }, "Method"), /* @__PURE__ */ React.createElement("th", { className: "center", style: { width: 80 } }, "Status"))), /* @__PURE__ */ React.createElement("tbody", null, ASSETS.map((a) => /* @__PURE__ */ React.createElement("tr", { key: a.id, className: sel === a.id ? "sel" : "", onClick: () => setSel(a.id === sel ? null : a.id) }, /* @__PURE__ */ React.createElement("td", null, a.description), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { fontSize: 10 } }, a.assetClass), /* @__PURE__ */ React.createElement("td", { className: "dim nowrap", style: { fontSize: 10 } }, fmtDate(a.date)), /* @__PURE__ */ React.createElement("td", { className: "right" }, fmt(a.cost)), /* @__PURE__ */ React.createElement("td", { className: "right" }, fmt(a.basis)), /* @__PURE__ */ React.createElement("td", { className: "center" }, a.busUse, "%"), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { fontSize: 10 } }, a.method), /* @__PURE__ */ React.createElement("td", { className: "center" }, /* @__PURE__ */ React.createElement(Badge, { status: a.status })))))))), asset && /* @__PURE__ */ React.createElement("div", { className: "asset-detail" }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500, borderBottom: "1px solid var(--grid)", paddingBottom: 6, marginBottom: 2 } }, asset.description), [
    ["Class", asset.assetClass],
    ["Status", /* @__PURE__ */ React.createElement(Badge, { status: asset.status })],
    ["Orig. Cost", fmt(asset.cost)],
    ["Biz Basis", fmt(asset.basis)],
    ["Biz Use", asset.busUse + "%"],
    ["Method", asset.method],
    ["In Service", fmtDate(asset.date)]
  ].map(([k, v]) => /* @__PURE__ */ React.createElement("div", { key: k, className: "ad-kv" }, /* @__PURE__ */ React.createElement("span", null, k), /* @__PURE__ */ React.createElement("span", null, v))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 4 } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm", style: { width: "100%" } }, "Log Event"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm", style: { width: "100%" } }, "Convert \u2192 Personal"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm", style: { width: "100%" } }, "Mark Disposed")), asset.status === "converted_to_personal" && /* @__PURE__ */ React.createElement("div", { style: { padding: 8, background: "var(--bg-red)", border: "1px solid var(--bd-red)", fontSize: 10, color: "var(--c-neg)", marginTop: 4 } }, "\u2691 Converted to personal use. No further deductions. Original cost basis and business purpose preserved.")));
}
function AccountsView() {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "sec-hdr" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sec-title" }, "Financial Accounts"), /* @__PURE__ */ React.createElement("div", { className: "sec-sub" }, "Banks \xB7 Credit cards \xB7 Payment processors \xB7 Loans")), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm" }, "+ New Account")), /* @__PURE__ */ React.createElement("div", { style: { overflow: "auto", flex: 1, padding: "4px 0" } }, [
    { label: "Business", scope: "business", cls: "acc-biz" },
    { label: "Personal (tracked)", scope: "personal", cls: "acc-per" }
  ].map((g) => /* @__PURE__ */ React.createElement("div", { key: g.scope }, /* @__PURE__ */ React.createElement("div", { style: { padding: "6px 10px 3px", fontSize: 9, textTransform: "uppercase", letterSpacing: ".09em", color: "var(--text-dim)" } }, g.label), ACCOUNTS.filter((a) => a.scope === g.scope).map((a) => /* @__PURE__ */ React.createElement("div", { key: a.id, className: `acc-card ${g.cls}` }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500, color: g.scope === "personal" ? "var(--text-dim)" : "var(--text)" } }, a.institution_name), /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 10, marginTop: 2 } }, a.type.replace(/_/g, " ").toUpperCase(), a.masked && ` \xB7 ${a.masked}`)), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("div", { className: `${a.balance >= 0 ? "pos" : "neg"}`, style: { fontSize: 15, fontFamily: "var(--font)" } }, fmt(a.balance)), /* @__PURE__ */ React.createElement("div", { className: "dim", style: { fontSize: 9, marginTop: 2 } }, "USD \xB7 Current"))))))));
}
function ChartOfAccountsView() {
  const CATS = ["asset", "liability", "equity", "income", "expense", "contra"];
  const totals = {
    income: GL_ACCOUNTS.filter((a) => a.category === "income").reduce((s, a) => s + a.balance, 0),
    expense: GL_ACCOUNTS.filter((a) => a.category === "expense").reduce((s, a) => s + a.balance, 0)
  };
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "sec-hdr" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sec-title" }, "Chart of Accounts"), /* @__PURE__ */ React.createElement("div", { className: "sec-sub" }, "General ledger \xB7 ", GL_ACCOUNTS.length, " accounts \xB7 Schedule C basis")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { padding: "2px 8px", fontSize: 10, color: "var(--c-pos)" } }, "Income: ", fmt(totals.income)), /* @__PURE__ */ React.createElement("span", { style: { padding: "2px 8px", fontSize: 10, color: "var(--c-neg)" } }, "Expenses: ", fmt(totals.expense)), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm" }, "+ New"))), /* @__PURE__ */ React.createElement("div", { className: "tbl-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "lv" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: { width: 56 } }, "Code"), /* @__PURE__ */ React.createElement("th", null, "Name"), /* @__PURE__ */ React.createElement("th", { style: { width: 80 } }, "Category"), /* @__PURE__ */ React.createElement("th", { style: { width: 120 } }, "Tax Treatment"), /* @__PURE__ */ React.createElement("th", { className: "right", style: { width: 110 } }, "YTD Balance"))), /* @__PURE__ */ React.createElement("tbody", null, CATS.map((cat) => {
    const rows = GL_ACCOUNTS.filter((a) => a.category === cat);
    if (!rows.length) return null;
    return /* @__PURE__ */ React.createElement(Fragment, { key: cat }, /* @__PURE__ */ React.createElement("tr", { className: "gl-group-hdr" }, /* @__PURE__ */ React.createElement("td", { colSpan: 5 }, cat.charAt(0).toUpperCase() + cat.slice(1))), rows.map((a) => /* @__PURE__ */ React.createElement("tr", { key: a.code, className: `gl-${cat}` }, /* @__PURE__ */ React.createElement("td", { className: "dim", style: { fontSize: 10 } }, a.code), /* @__PURE__ */ React.createElement("td", null, a.name), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { fontSize: 10 } }, a.category), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { fontSize: 10 } }, "\u2014"), /* @__PURE__ */ React.createElement("td", { className: `right ${cat === "income" ? "pos" : cat === "expense" ? "neg" : cat === "liability" ? "neg" : ""}`, style: { fontFamily: "var(--font)" } }, fmt(a.balance)))));
  })))));
}
function TaxCenterView() {
  const ytdRev = 42800;
  const ytdExp = 1931;
  const net = ytdRev - ytdExp;
  const seSelf = net * 0.9235;
  const seTax = seSelf * 0.153;
  const halfSE = seTax * 0.5;
  const adjNet = net - halfSE;
  const qEst = seTax / 4;
  const deductions = [
    { name: "Cloud / Software", eligible: true, documented: true, amount: 1237 },
    { name: "Books / Education", eligible: true, documented: true, amount: 204.97 },
    { name: "Hardware (Sec. 179)", eligible: true, documented: true, amount: 1061 },
    { name: "Health Insurance", eligible: true, documented: true, amount: 850 },
    { name: "Home Office", eligible: true, documented: false, amount: 0 },
    { name: "SEP-IRA Contrib.", eligible: true, documented: false, amount: 0 },
    { name: "Vehicle / Mileage", eligible: false, documented: false, amount: 0 },
    { name: "\xBD SE Tax Deduction", eligible: true, documented: true, amount: halfSE }
  ];
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "sec-hdr" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sec-title" }, "Tax Center"), /* @__PURE__ */ React.createElement("div", { className: "sec-sub" }, "Schedule C \xB7 SE Tax \xB7 Quarterly estimates \xB7 FY 2025")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm" }, "Export Schedule C"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm" }, "Tax Docs"))), /* @__PURE__ */ React.createElement("div", { style: { overflow: "auto", flex: 1, padding: 1 } }, /* @__PURE__ */ React.createElement("div", { className: "tax-grid" }, /* @__PURE__ */ React.createElement("div", { className: "tax-panel" }, /* @__PURE__ */ React.createElement("div", { className: "tax-title" }, "Schedule C \u2014 Profit or Loss from Business"), [
    ["Gross receipts (line 1)", ytdRev, false],
    ["Returns & allowances (line 2)", 0, false],
    ["Gross profit (line 5)", ytdRev, false]
  ].map(([l, v]) => /* @__PURE__ */ React.createElement("div", { key: l, className: "tax-row" }, /* @__PURE__ */ React.createElement("span", { className: "lbl" }, l), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--font)" } }, fmt(v)))), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 9, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--text-dim)", margin: "8px 0 4px" } }, "Deductible Expenses"), [
    ["Cloud & hosting", 897],
    ["Software & subscriptions", 340],
    ["Books & education", 204.97],
    ["Office supplies", 89],
    ["Health insurance", 850],
    ["\xBD SE tax deduction", halfSE]
  ].map(([l, v]) => /* @__PURE__ */ React.createElement("div", { key: l, className: "tax-row" }, /* @__PURE__ */ React.createElement("span", { className: "lbl" }, l), /* @__PURE__ */ React.createElement("span", { className: "neg", style: { fontFamily: "var(--font)" } }, "(", fmt(v), ")"))), /* @__PURE__ */ React.createElement("div", { className: "tax-total" }, /* @__PURE__ */ React.createElement("span", null, "Net Profit (line 31)"), /* @__PURE__ */ React.createElement("span", { className: "pos", style: { fontFamily: "var(--font)" } }, fmt(adjNet)))), /* @__PURE__ */ React.createElement("div", { className: "tax-panel" }, /* @__PURE__ */ React.createElement("div", { className: "tax-title" }, "Self-Employment Tax (Schedule SE)"), [
    ["Net profit from Sch. C", fmt(net)],
    ["\xD7 92.35% = net SE earnings", fmt(seSelf)],
    ["\xD7 15.3% SE tax rate", fmt(seTax)],
    ["  12.4% Social Security", fmt(seSelf * 0.124)],
    ["  2.9% Medicare", fmt(seSelf * 0.029)],
    ["Deductible \xBD of SE tax", fmt(halfSE)]
  ].map(([l, v]) => /* @__PURE__ */ React.createElement("div", { key: l, className: "tax-row" }, /* @__PURE__ */ React.createElement("span", { className: "lbl" }, l), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--font)" } }, v))), /* @__PURE__ */ React.createElement("div", { className: "tax-total" }, /* @__PURE__ */ React.createElement("span", null, "SE Tax Owed"), /* @__PURE__ */ React.createElement("span", { className: "neg", style: { fontFamily: "var(--font)" } }, fmt(seTax))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "tax-title" }, "Quarterly Payments (Form 1040-ES)"), [
    { q: "Q1", due: "Apr 15 2025", paid: 200, est: qEst, past: true },
    { q: "Q2", due: "Jun 16 2025", paid: 0, est: qEst, past: false },
    { q: "Q3", due: "Sep 15 2025", paid: 0, est: qEst, past: false },
    { q: "Q4", due: "Jan 15 2026", paid: 0, est: qEst, past: false }
  ].map((q) => /* @__PURE__ */ React.createElement("div", { key: q.q, className: "tax-row", style: { flexDirection: "column", gap: 2, alignItems: "stretch" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("span", { className: "lbl" }, q.q, " \u2014 ", /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9 } }, "due ", q.due)), /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--font)" } }, fmt(q.est))), q.paid > 0 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--c-pos)" } }, /* @__PURE__ */ React.createElement("span", null, "Paid: ", fmt(q.paid)), /* @__PURE__ */ React.createElement("span", null, "Remaining: ", fmt(Math.max(0, q.est - q.paid)))))))), /* @__PURE__ */ React.createElement("div", { className: "tax-panel", style: { gridColumn: "1 / -1" } }, /* @__PURE__ */ React.createElement("div", { className: "tax-title" }, "Deduction Tracker \u2014 Business Expenses"), /* @__PURE__ */ React.createElement("table", { className: "lv" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: { width: 16 } }), /* @__PURE__ */ React.createElement("th", null, "Deduction Type"), /* @__PURE__ */ React.createElement("th", null, "Eligible?"), /* @__PURE__ */ React.createElement("th", null, "Documented?"), /* @__PURE__ */ React.createElement("th", { className: "right", style: { width: 110 } }, "YTD Amount"), /* @__PURE__ */ React.createElement("th", null, "Note"))), /* @__PURE__ */ React.createElement("tbody", null, deductions.map((d) => /* @__PURE__ */ React.createElement("tr", { key: d.name }, /* @__PURE__ */ React.createElement("td", { className: "center" }, /* @__PURE__ */ React.createElement("span", { className: "ded-dot", style: { color: d.documented ? "var(--bd-green)" : d.eligible ? "var(--bd-amber)" : "#aaa" } }, d.documented ? "\u25CF" : d.eligible ? "\u25CB" : "\xD7")), /* @__PURE__ */ React.createElement("td", { style: { color: !d.eligible ? "var(--text-dim)" : "var(--text)" } }, d.name), /* @__PURE__ */ React.createElement("td", { className: "center" }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9 } }, d.eligible ? "Yes" : "No")), /* @__PURE__ */ React.createElement("td", { className: "center" }, /* @__PURE__ */ React.createElement(Badge, { status: d.documented ? "cleared" : d.eligible ? "draft" : "draft" })), /* @__PURE__ */ React.createElement("td", { className: `right ${d.amount > 0 ? "pos" : "dim"}`, style: { fontFamily: "var(--font)" } }, d.amount > 0 ? fmt(d.amount) : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "dim", style: { fontSize: 10 } }, !d.documented && d.eligible ? "\u2691 Gather documentation" : "", !d.eligible ? "Not applicable" : ""))))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: 9, color: "var(--text-dim)" } }, "\u25CF Documented & ready \xB7 \u25CB Eligible but documentation pending \xB7 \xD7 Not applicable")))));
}
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "\u25C8", group: "Overview" },
  { id: "accounts", label: "Accounts", icon: "\u25A3", group: "Money" },
  { id: "transactions", label: "Transactions", icon: "\u2195", group: "Money" },
  { id: "purchases", label: "Purchases", icon: "\u229E", group: "Money" },
  { id: "assets", label: "Assets", icon: "\u25C7", group: "Assets" },
  { id: "coa", label: "Chart of Accounts", icon: "\u2261", group: "Ledger" },
  { id: "tax", label: "Tax Center", icon: "\u229B", group: "Tax" }
];
function App() {
  const [section, setSection] = useState("dashboard");
  const [clock, setClock] = useState(/* @__PURE__ */ new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(/* @__PURE__ */ new Date()), 3e4);
    return () => clearInterval(id);
  }, []);
  const groups = [...new Set(NAV.map((n) => n.group))];
  const render = () => {
    switch (section) {
      case "dashboard":
        return /* @__PURE__ */ React.createElement(Dashboard, null);
      case "transactions":
        return /* @__PURE__ */ React.createElement(TransactionsView, null);
      case "purchases":
        return /* @__PURE__ */ React.createElement(PurchasesView, null);
      case "assets":
        return /* @__PURE__ */ React.createElement(AssetsView, null);
      case "accounts":
        return /* @__PURE__ */ React.createElement(AccountsView, null);
      case "coa":
        return /* @__PURE__ */ React.createElement(ChartOfAccountsView, null);
      case "tax":
        return /* @__PURE__ */ React.createElement(TaxCenterView, null);
      default:
        return /* @__PURE__ */ React.createElement(Dashboard, null);
    }
  };
  const timeStr = clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("style", null, CSS), /* @__PURE__ */ React.createElement("div", { className: "desktop" }, /* @__PURE__ */ React.createElement("div", { className: "menubar" }, /* @__PURE__ */ React.createElement("div", { className: "mb-item", style: { fontSize: 14, paddingTop: 0, paddingBottom: 0, lineHeight: "20px" } }, "\u2726"), /* @__PURE__ */ React.createElement("div", { className: "mb-item mb-bold" }, "Ledger"), /* @__PURE__ */ React.createElement("div", { className: "mb-item" }, "File"), /* @__PURE__ */ React.createElement("div", { className: "mb-item" }, "Edit"), /* @__PURE__ */ React.createElement("div", { className: "mb-item" }, "View"), /* @__PURE__ */ React.createElement("div", { className: "mb-item" }, "Reports"), /* @__PURE__ */ React.createElement("div", { className: "mb-item" }, "Window"), /* @__PURE__ */ React.createElement("div", { className: "mb-spacer" }), /* @__PURE__ */ React.createElement("div", { className: "mb-clock" }, dateStr, "  ", timeStr)), /* @__PURE__ */ React.createElement("div", { className: "win" }, /* @__PURE__ */ React.createElement("div", { className: "titlebar" }, /* @__PURE__ */ React.createElement("div", { className: "tb-box", title: "Close" }), /* @__PURE__ */ React.createElement("div", { className: "tb-title" }, "Ledger  \xB7  Single-Member LLC  \xB7  Schedule C  \xB7  FY 2025"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement("div", { className: "tb-box", title: "Zoom" })), /* @__PURE__ */ React.createElement("div", { className: "win-body" }, /* @__PURE__ */ React.createElement("div", { className: "sidebar" }, /* @__PURE__ */ React.createElement("div", { className: "sb-logo" }, /* @__PURE__ */ React.createElement("span", null, "\u2726"), /* @__PURE__ */ React.createElement("span", null, "Ledger")), groups.map((g) => /* @__PURE__ */ React.createElement("div", { key: g }, /* @__PURE__ */ React.createElement("div", { className: "sb-group" }, g), NAV.filter((n) => n.group === g).map((n) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: n.id,
      className: `sb-item ${section === n.id ? "active" : ""}`,
      onClick: () => setSection(n.id)
    },
    /* @__PURE__ */ React.createElement("span", { className: "sb-icon" }, n.icon),
    /* @__PURE__ */ React.createElement("span", null, n.label)
  )))), /* @__PURE__ */ React.createElement("div", { className: "sb-spacer" }), /* @__PURE__ */ React.createElement("div", { className: "sb-footer" }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, "Single-Member LLC"), /* @__PURE__ */ React.createElement("div", { className: "sb-footer-sub" }, "Disregarded Entity"), /* @__PURE__ */ React.createElement("div", { className: "sb-footer-sub", style: { fontSize: 9, marginTop: 3 } }, "FY 2025  \xB7  Schedule C"))), /* @__PURE__ */ React.createElement("div", { className: "main" }, render())))));
}
const __artifactDefault = App;
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(__artifactDefault));
