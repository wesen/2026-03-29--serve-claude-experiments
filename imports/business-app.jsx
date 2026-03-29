import { useState, useEffect, Fragment } from "react";

// ─── Mock Data ──────────────────────────────────────────────────────────────

const ACCOUNTS = [
  { id: "a1", institution_name: "First National Bank", type: "bank", scope: "business", masked: "****4521", balance: 28450.00 },
  { id: "a2", institution_name: "Chase Ink Business", type: "credit_card", scope: "business", masked: "****8832", balance: -3240.50 },
  { id: "a3", institution_name: "Stripe Connect", type: "payment_processor", scope: "business", masked: null, balance: 1820.00 },
  { id: "a4", institution_name: "Wells Fargo Personal", type: "bank", scope: "personal", masked: "****1103", balance: 12300.00 },
];

const TRANSACTIONS = [
  { id: "t1", occurred_at: "2025-03-20", direction: "inflow",  amount: 8500.00,  description: "Client payment — Consulting Mar",       account: "Stripe",             category: "Revenue",  status: "cleared" },
  { id: "t2", occurred_at: "2025-03-18", direction: "outflow", amount: 299.00,   description: "Amazon Web Services — us-east-1",       account: "Chase ****8832",     category: "Cloud",    status: "cleared" },
  { id: "t3", occurred_at: "2025-03-15", direction: "outflow", amount: 49.00,    description: "Linear — monthly subscription",          account: "Chase ****8832",     category: "Software", status: "cleared" },
  { id: "t4", occurred_at: "2025-03-12", direction: "outflow", amount: 64.99,    description: '"Designing Data-Intensive Apps" OReilly', account: "Chase ****8832",     category: "Books",    status: "needs_review" },
  { id: "t5", occurred_at: "2025-03-10", direction: "inflow",  amount: 12000.00, description: "Retainer — ACME Corp April",             account: "Stripe",             category: "Revenue",  status: "cleared" },
  { id: "t6", occurred_at: "2025-03-08", direction: "outflow", amount: 1299.00,  description: "B&H Photo — monitor + peripherals",      account: "Chase ****8832",     category: "Hardware", status: "needs_review" },
  { id: "t7", occurred_at: "2025-03-05", direction: "outflow", amount: 19.00,    description: "1Password Teams",                        account: "Chase ****8832",     category: "Software", status: "cleared" },
  { id: "t8", occurred_at: "2025-03-01", direction: "outflow", amount: 200.00,   description: "Estimated tax payment Q1 2025",          account: "First National",     category: "Tax",      status: "cleared" },
  { id: "t9", occurred_at: "2025-02-28", direction: "inflow",  amount: 22300.00, description: "Client payment — Feb consulting",        account: "Stripe",             category: "Revenue",  status: "cleared" },
  { id: "t10",occurred_at: "2025-02-15", direction: "outflow", amount: 299.00,   description: "AWS — Feb",                              account: "Chase ****8832",     category: "Cloud",    status: "cleared" },
];

const PURCHASES = [
  {
    id: "p1", vendor: "Amazon Web Services", date: "2025-03-18", invoice: "INV-8821-0325",
    amount: 299.00, scope: "business", status: "reviewed",
    purpose: "Cloud infrastructure for client projects",
    lines: [
      { type: "cloud",    description: "EC2 compute — us-east-1",   amount: 187.42 },
      { type: "cloud",    description: "S3 storage",                 amount: 42.18 },
      { type: "cloud",    description: "CloudFront CDN",             amount: 69.40 },
    ],
  },
  {
    id: "p2", vendor: "O'Reilly Media", date: "2025-03-12", invoice: null,
    amount: 64.99, scope: "business", status: "draft",
    purpose: "Technical reference — distributed systems consulting",
    lines: [
      { type: "book", description: "Designing Data-Intensive Applications", amount: 64.99 },
    ],
  },
  {
    id: "p3", vendor: "B&H Photo Video", date: "2025-03-08", invoice: "ORD-BH-991234",
    amount: 1299.00, scope: "business", status: "draft",
    purpose: "Ergonomic workstation setup for client deliverables",
    lines: [
      { type: "hardware", description: "LG 27\" 4K Monitor",  amount: 799.00,  is_asset: true },
      { type: "hardware", description: "Monitor arm",         amount: 149.00 },
      { type: "hardware", description: "USB-C hub (Anker)",   amount: 89.00 },
      { type: "office",   description: "Keychron Q1 keyboard",amount: 262.00, is_asset: true },
    ],
  },
  {
    id: "p4", vendor: "Linear", date: "2025-03-15", invoice: "LIN-2025-03",
    amount: 49.00, scope: "business", status: "reviewed",
    purpose: "Project management — client work tracking",
    lines: [
      { type: "subscription", description: "Linear Business — monthly", amount: 49.00 },
    ],
  },
];

const ASSETS = [
  { id: "as1", description: 'LG 27" 4K Monitor',    assetClass: "monitor",        date: "2025-03-08", cost: 799.00,   basis: 799.00,   busUse: 100, status: "in_service",           method: "Section 179" },
  { id: "as2", description: "MacBook Pro 14\" M3",  assetClass: "computer",       date: "2024-11-15", cost: 1999.00,  basis: 1799.10,  busUse: 90,  status: "in_service",           method: "Section 179" },
  { id: "as3", description: '"Clean Code" — Martin', assetClass: "book_collection",date: "2024-09-01", cost: 44.99,    basis: 44.99,    busUse: 0,   status: "converted_to_personal",method: "Expensed" },
  { id: "as4", description: "Keychron Q1 Keyboard", assetClass: "equipment",      date: "2025-03-08", cost: 262.00,   basis: 262.00,   busUse: 100, status: "in_service",           method: "Expensed" },
];

const GL_ACCOUNTS = [
  { code: "1000", name: "Cash — Business Checking",    category: "asset",     balance: 28450.00 },
  { code: "1010", name: "Cash — Payment Processor",    category: "asset",     balance: 1820.00  },
  { code: "1200", name: "Accounts Receivable",         category: "asset",     balance: 0        },
  { code: "1500", name: "Computer Equipment",          category: "asset",     balance: 2861.10  },
  { code: "1510", name: "Acc. Depreciation — Equip",  category: "contra",    balance: 0        },
  { code: "2000", name: "Credit Card Payable",         category: "liability", balance: 3240.50  },
  { code: "2100", name: "Sales Tax Payable",           category: "liability", balance: 0        },
  { code: "2900", name: "Deferred Revenue",            category: "liability", balance: 0        },
  { code: "3000", name: "Owner Equity",                category: "equity",    balance: 26889.00 },
  { code: "3100", name: "Owner Draws",                 category: "equity",    balance: 0        },
  { code: "4000", name: "Consulting Revenue",          category: "income",    balance: 42800.00 },
  { code: "6100", name: "Cloud & Hosting",             category: "expense",   balance: 897.00   },
  { code: "6200", name: "Software & Subscriptions",    category: "expense",   balance: 340.00   },
  { code: "6300", name: "Books & Education",           category: "expense",   balance: 204.97   },
  { code: "6400", name: "Hardware & Equipment",        category: "expense",   balance: 0        },
  { code: "6500", name: "Professional Services",       category: "expense",   balance: 500.00   },
  { code: "6600", name: "Office & Supplies",           category: "expense",   balance: 89.00    },
  { code: "7000", name: "SE Tax",                      category: "expense",   balance: 800.00   },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) => {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "−" : "") + "$" + abs;
};

const fmtDate = (s) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

const BADGE_META = {
  cleared:              { label: "Cleared",  cls: "badge-green"  },
  reviewed:             { label: "Reviewed", cls: "badge-blue"   },
  draft:                { label: "Draft",    cls: "badge-amber"  },
  needs_review:         { label: "Review",   cls: "badge-red"    },
  in_service:           { label: "Active",   cls: "badge-blue"   },
  converted_to_personal:{ label: "Personal", cls: "badge-red"    },
  posted:               { label: "Posted",   cls: "badge-green"  },
  business:             { label: "Business", cls: "badge-blue"   },
  personal:             { label: "Personal", cls: "badge-amber"  },
};

const Badge = ({ status }) => {
  const m = BADGE_META[status] || { label: status, cls: "badge-blue" };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
};

// ─── CSS ─────────────────────────────────────────────────────────────────────

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

/* ── Desktop ── */
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

/* ── Menu Bar ── */
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

/* ── App Window ── */
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

/* ── Title Bar ── */
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

/* ── Body ── */
.win-body { display: flex; flex: 1; min-height: 0; }

/* ── Sidebar ── */
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

/* ── Main content ── */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

/* ── Section header ── */
.sec-hdr {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0; background: var(--bg-win);
}
.sec-title { font-size: 11px; font-weight: 500; }
.sec-sub { font-size: 9px; color: var(--text-dim); margin-top: 2px; }

/* ── Buttons ── */
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

/* ── Table / list view ── */
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

/* ── Badges ── */
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

/* ── Metrics strip ── */
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

/* ── Dashboard 2x2 grid ── */
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

/* ── Progress bar ── */
.pbar { height: 5px; background: var(--grid); border: 1px solid #bbb; margin-top: 3px; }
.pfill { height: 100%; background: var(--bg-selected); }

/* ── Account cards ── */
.acc-card {
  margin: 6px 8px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center;
}
.acc-biz { border-left: 3px solid #000; }
.acc-per { border-left: 3px solid #999; }

/* ── Purchase line expansion ── */
.pl-wrap { padding: 4px 8px 6px 32px; background: #f8f8f8; }
.pl-row {
  display: flex; justify-content: space-between;
  padding: 2px 0;
  font-size: 10px; color: var(--text-dim);
  border-bottom: 1px dotted var(--grid);
}
.pl-row:last-child { border-bottom: 1px solid var(--grid); font-weight: 500; color: var(--text); }

/* ── Asset detail panel ── */
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

/* ── GL category accent ── */
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

/* ── Tax center ── */
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

/* ── Scrollbars ── */
::-webkit-scrollbar { width: 14px; height: 14px; }
::-webkit-scrollbar-track { background: #fff; border-left: 1px solid #aaa; }
::-webkit-scrollbar-thumb { background: #d0d0d0; border: 1px solid #888; }
::-webkit-scrollbar-button:single-button {
  display: block; background: #e8e8e8;
  border: 1px solid #888; height: 14px; width: 14px;
}
`;

// ─── Section Components ──────────────────────────────────────────────────────

function Dashboard() {
  const bizCash = ACCOUNTS.filter(a => a.scope === "business").reduce((s, a) => s + a.balance, 0);
  const ytdIn   = TRANSACTIONS.filter(t => t.direction === "inflow").reduce((s, t) => s + t.amount, 0);
  const ytdOut  = TRANSACTIONS.filter(t => t.direction === "outflow").reduce((s, t) => s + t.amount, 0);
  const net     = ytdIn - ytdOut;
  const seTax   = net * 0.9235 * 0.153;
  const pending = TRANSACTIONS.filter(t => t.status === "needs_review").length
                + PURCHASES.filter(p => p.status === "draft").length;

  const expCats = [
    { name: "Cloud",    amt: 897.00  },
    { name: "Software", amt: 340.00  },
    { name: "Books",    amt: 204.97  },
    { name: "Tax pmts", amt: 200.00  },
    { name: "Other",    amt: 89.00   },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Metrics strip */}
      <div className="metrics">
        {[
          { lbl: "Business Cash",  val: fmt(bizCash),        sub: "3 accounts",            cls: ""    },
          { lbl: "YTD Revenue",    val: fmt(ytdIn),           sub: "Jan–Mar 2025",          cls: "pos" },
          { lbl: "YTD Expenses",   val: fmt(ytdOut),          sub: ytdOut.toFixed(0)+" txns",cls: "neg" },
          { lbl: "Net Income",     val: fmt(net),             sub: "before SE tax",         cls: net >= 0 ? "pos" : "neg" },
          { lbl: "Est. SE Tax",    val: fmt(seTax),           sub: "15.3% × 92.35%",        cls: "neg" },
          { lbl: "Needs Review",   val: String(pending),      sub: "items pending",         cls: pending > 0 ? "neg" : "pos" },
        ].map(m => (
          <div key={m.lbl} className="metric">
            <div className="metric-lbl">{m.lbl}</div>
            <div className={`metric-val ${m.cls}`}>{m.val}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* 2×2 panels */}
      <div className="dash-grid">
        {/* Recent transactions */}
        <div className="dash-panel">
          <div className="dp-title">Recent Transactions</div>
          <div className="dp-scroll">
            <table className="lv" style={{ width: "100%" }}>
              <tbody>
                {TRANSACTIONS.slice(0, 7).map(t => (
                  <tr key={t.id}>
                    <td className="dim nowrap" style={{ fontSize: 10, width: 72 }}>{fmtDate(t.occurred_at)}</td>
                    <td style={{ overflow: "hidden", maxWidth: 200, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.description}</td>
                    <td className={`right nowrap ${t.direction === "inflow" ? "pos" : "neg"}`}>
                      {t.direction === "inflow" ? "+" : "−"}{fmt(t.amount)}
                    </td>
                    <td className="center" style={{ width: 64 }}><Badge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="dash-panel">
          <div className="dp-title">YTD Expense Breakdown</div>
          <div className="dp-scroll" style={{ padding: "8px 12px" }}>
            {expCats.map(c => {
              const pct = Math.round(c.amt / ytdOut * 100);
              return (
                <div key={c.name} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, fontSize: 10 }}>
                    <span>{c.name}</span>
                    <span style={{ fontFamily: "var(--font)" }}>{fmt(c.amt)} ({pct}%)</span>
                  </div>
                  <div className="pbar"><div className="pfill" style={{ width: pct + "%" }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending action */}
        <div className="dash-panel">
          <div className="dp-title">Pending Action ({pending})</div>
          <div className="dp-scroll">
            <table className="lv">
              <tbody>
                {TRANSACTIONS.filter(t => t.status === "needs_review").map(t => (
                  <tr key={t.id}>
                    <td style={{ width: 60 }}><Badge status="needs_review" /></td>
                    <td>{t.description}</td>
                    <td className="right neg nowrap">{fmt(t.amount)}</td>
                  </tr>
                ))}
                {PURCHASES.filter(p => p.status === "draft").map(p => (
                  <tr key={p.id}>
                    <td style={{ width: 60 }}><Badge status="draft" /></td>
                    <td>{p.vendor}</td>
                    <td className="right neg nowrap">{fmt(p.amount)}</td>
                  </tr>
                ))}
                {pending === 0 && (
                  <tr><td colSpan={3} className="center dim" style={{ padding: 16 }}>All clear ✓</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Asset register */}
        <div className="dash-panel">
          <div className="dp-title">Asset Register</div>
          <div className="dp-scroll">
            <table className="lv">
              <tbody>
                {ASSETS.map(a => (
                  <tr key={a.id}>
                    <td style={{ overflow: "hidden", maxWidth: 180, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a.description}</td>
                    <td className="center" style={{ width: 76 }}><Badge status={a.status} /></td>
                    <td className="right dim" style={{ width: 40 }}>{a.busUse}%</td>
                    <td className="right" style={{ width: 80, fontFamily: "var(--font)" }}>{fmt(a.basis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionsView() {
  const [sel, setSel]     = useState(null);
  const [filter, setFilt] = useState("all");

  const rows = TRANSACTIONS.filter(t => {
    if (filter === "inflow")  return t.direction === "inflow";
    if (filter === "outflow") return t.direction === "outflow";
    if (filter === "review")  return t.status === "needs_review";
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Money Transactions</div>
          <div className="sec-sub">{rows.length} records · raw payment events</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { k: "all",     l: "All"       },
            { k: "inflow",  l: "↓ Inflow"  },
            { k: "outflow", l: "↑ Outflow" },
            { k: "review",  l: "⚑ Review"  },
          ].map(f => (
            <button key={f.k} className={`btn btn-sm ${filter === f.k ? "active" : ""}`} onClick={() => setFilt(f.k)}>
              {f.l}
            </button>
          ))}
          <button className="btn btn-sm">+ New</button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="lv">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Date</th>
              <th>Description</th>
              <th>Account</th>
              <th>Category</th>
              <th className="right" style={{ width: 100 }}>Amount</th>
              <th className="center" style={{ width: 72 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} className={sel === t.id ? "sel" : ""} onClick={() => setSel(t.id === sel ? null : t.id)}>
                <td className="nowrap dim" style={{ fontSize: 10 }}>{fmtDate(t.occurred_at)}</td>
                <td>{t.description}</td>
                <td className="dim" style={{ fontSize: 10 }}>{t.account}</td>
                <td style={{ fontSize: 10 }}>{t.category}</td>
                <td className={`right nowrap ${t.direction === "inflow" ? "pos" : "neg"}`}>
                  {t.direction === "inflow" ? "+" : "−"}{fmt(t.amount)}
                </td>
                <td className="center"><Badge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchasesView() {
  const [expanded, setExp] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Purchases & Expenses</div>
          <div className="sec-sub">{PURCHASES.length} records · click row to expand line items</div>
        </div>
        <button className="btn btn-sm">+ New Purchase</button>
      </div>
      <div className="tbl-wrap">
        <table className="lv">
          <thead>
            <tr>
              <th style={{ width: 16 }}></th>
              <th style={{ width: 80 }}>Date</th>
              <th>Vendor</th>
              <th>Invoice #</th>
              <th>Business Purpose</th>
              <th className="center" style={{ width: 70 }}>Source</th>
              <th className="right" style={{ width: 90 }}>Amount</th>
              <th className="center" style={{ width: 70 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {PURCHASES.map(p => (
              <Fragment key={p.id}>
                <tr style={{ cursor: "pointer" }} onClick={() => setExp(expanded === p.id ? null : p.id)}>
                  <td className="center dim" style={{ fontSize: 9 }}>{expanded === p.id ? "▼" : "▶"}</td>
                  <td className="nowrap dim" style={{ fontSize: 10 }}>{fmtDate(p.date)}</td>
                  <td style={{ fontWeight: 500 }}>{p.vendor}</td>
                  <td className="dim" style={{ fontSize: 10 }}>{p.invoice || "—"}</td>
                  <td className="dim" style={{ fontSize: 10, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.purpose}</td>
                  <td className="center"><Badge status={p.scope} /></td>
                  <td className="right neg">{fmt(p.amount)}</td>
                  <td className="center"><Badge status={p.status} /></td>
                </tr>
                {expanded === p.id && (
                  <tr>
                    <td colSpan={8} style={{ padding: 0, background: "var(--bg-sidebar)" }}>
                      <div className="pl-wrap">
                        {p.lines.map((l, i) => (
                          <div key={i} className="pl-row">
                            <span>
                              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--text-dim)", marginRight: 8 }}>{l.type}</span>
                              {l.description}
                              {l.is_asset && (
                                <span style={{ marginLeft: 8, fontSize: 9, color: "var(--c-neu)", border: "1px solid currentColor", padding: "0 3px" }}>ASSET</span>
                              )}
                            </span>
                            <span style={{ fontFamily: "var(--font)" }}>{fmt(l.amount)}</span>
                          </div>
                        ))}
                        <div className="pl-row">
                          <span>Total</span>
                          <span style={{ fontFamily: "var(--font)" }}>{fmt(p.amount)}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssetsView() {
  const [sel, setSel] = useState(null);
  const asset = sel ? ASSETS.find(a => a.id === sel) : null;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="sec-hdr">
          <div>
            <div className="sec-title">Asset Register</div>
            <div className="sec-sub">Capital items · use tracking · depreciation · basis</div>
          </div>
          <button className="btn btn-sm">+ New Asset</button>
        </div>
        <div className="tbl-wrap">
          <table className="lv">
            <thead>
              <tr>
                <th>Description</th>
                <th>Class</th>
                <th style={{ width: 80 }}>In Service</th>
                <th className="right" style={{ width: 100 }}>Orig. Cost</th>
                <th className="right" style={{ width: 100 }}>Biz Basis</th>
                <th className="center" style={{ width: 60 }}>Biz %</th>
                <th style={{ width: 90 }}>Method</th>
                <th className="center" style={{ width: 80 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map(a => (
                <tr key={a.id} className={sel === a.id ? "sel" : ""} onClick={() => setSel(a.id === sel ? null : a.id)}>
                  <td>{a.description}</td>
                  <td className="dim" style={{ fontSize: 10 }}>{a.assetClass}</td>
                  <td className="dim nowrap" style={{ fontSize: 10 }}>{fmtDate(a.date)}</td>
                  <td className="right">{fmt(a.cost)}</td>
                  <td className="right">{fmt(a.basis)}</td>
                  <td className="center">{a.busUse}%</td>
                  <td className="dim" style={{ fontSize: 10 }}>{a.method}</td>
                  <td className="center"><Badge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {asset && (
        <div className="asset-detail">
          <div style={{ fontWeight: 500, borderBottom: "1px solid var(--grid)", paddingBottom: 6, marginBottom: 2 }}>
            {asset.description}
          </div>
          {[
            ["Class",      asset.assetClass],
            ["Status",     <Badge status={asset.status} />],
            ["Orig. Cost", fmt(asset.cost)],
            ["Biz Basis",  fmt(asset.basis)],
            ["Biz Use",    asset.busUse + "%"],
            ["Method",     asset.method],
            ["In Service", fmtDate(asset.date)],
          ].map(([k, v]) => (
            <div key={k} className="ad-kv">
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}

          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
            <button className="btn btn-sm" style={{ width: "100%" }}>Log Event</button>
            <button className="btn btn-sm" style={{ width: "100%" }}>Convert → Personal</button>
            <button className="btn btn-sm" style={{ width: "100%" }}>Mark Disposed</button>
          </div>

          {asset.status === "converted_to_personal" && (
            <div style={{ padding: 8, background: "var(--bg-red)", border: "1px solid var(--bd-red)", fontSize: 10, color: "var(--c-neg)", marginTop: 4 }}>
              ⚑ Converted to personal use. No further deductions. Original cost basis and business purpose preserved.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccountsView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Financial Accounts</div>
          <div className="sec-sub">Banks · Credit cards · Payment processors · Loans</div>
        </div>
        <button className="btn btn-sm">+ New Account</button>
      </div>
      <div style={{ overflow: "auto", flex: 1, padding: "4px 0" }}>
        {[
          { label: "Business", scope: "business", cls: "acc-biz" },
          { label: "Personal (tracked)", scope: "personal", cls: "acc-per" },
        ].map(g => (
          <div key={g.scope}>
            <div style={{ padding: "6px 10px 3px", fontSize: 9, textTransform: "uppercase", letterSpacing: ".09em", color: "var(--text-dim)" }}>
              {g.label}
            </div>
            {ACCOUNTS.filter(a => a.scope === g.scope).map(a => (
              <div key={a.id} className={`acc-card ${g.cls}`}>
                <div>
                  <div style={{ fontWeight: 500, color: g.scope === "personal" ? "var(--text-dim)" : "var(--text)" }}>
                    {a.institution_name}
                  </div>
                  <div className="dim" style={{ fontSize: 10, marginTop: 2 }}>
                    {a.type.replace(/_/g, " ").toUpperCase()}
                    {a.masked && ` · ${a.masked}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className={`${a.balance >= 0 ? "pos" : "neg"}`} style={{ fontSize: 15, fontFamily: "var(--font)" }}>
                    {fmt(a.balance)}
                  </div>
                  <div className="dim" style={{ fontSize: 9, marginTop: 2 }}>USD · Current</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartOfAccountsView() {
  const CATS = ["asset", "liability", "equity", "income", "expense", "contra"];
  const totals = {
    income:    GL_ACCOUNTS.filter(a => a.category === "income").reduce((s, a) => s + a.balance, 0),
    expense:   GL_ACCOUNTS.filter(a => a.category === "expense").reduce((s, a) => s + a.balance, 0),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Chart of Accounts</div>
          <div className="sec-sub">General ledger · {GL_ACCOUNTS.length} accounts · Schedule C basis</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <span style={{ padding: "2px 8px", fontSize: 10, color: "var(--c-pos)" }}>
            Income: {fmt(totals.income)}
          </span>
          <span style={{ padding: "2px 8px", fontSize: 10, color: "var(--c-neg)" }}>
            Expenses: {fmt(totals.expense)}
          </span>
          <button className="btn btn-sm">+ New</button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="lv">
          <thead>
            <tr>
              <th style={{ width: 56 }}>Code</th>
              <th>Name</th>
              <th style={{ width: 80 }}>Category</th>
              <th style={{ width: 120 }}>Tax Treatment</th>
              <th className="right" style={{ width: 110 }}>YTD Balance</th>
            </tr>
          </thead>
          <tbody>
            {CATS.map(cat => {
              const rows = GL_ACCOUNTS.filter(a => a.category === cat);
              if (!rows.length) return null;
              return (
                <Fragment key={cat}>
                  <tr className="gl-group-hdr">
                    <td colSpan={5}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </td>
                  </tr>
                  {rows.map(a => (
                    <tr key={a.code} className={`gl-${cat}`}>
                      <td className="dim" style={{ fontSize: 10 }}>{a.code}</td>
                      <td>{a.name}</td>
                      <td className="dim" style={{ fontSize: 10 }}>{a.category}</td>
                      <td className="dim" style={{ fontSize: 10 }}>—</td>
                      <td className={`right ${
                        cat === "income" ? "pos" :
                        cat === "expense" ? "neg" :
                        cat === "liability" ? "neg" : ""
                      }`} style={{ fontFamily: "var(--font)" }}>
                        {fmt(a.balance)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxCenterView() {
  const ytdRev  = 42800;
  const ytdExp  = 1931;
  const net     = ytdRev - ytdExp;
  const seSelf  = net * 0.9235;
  const seTax   = seSelf * 0.153;
  const halfSE  = seTax * 0.5;
  const adjNet  = net - halfSE;
  const qEst    = seTax / 4;

  const deductions = [
    { name: "Cloud / Software",    eligible: true,  documented: true,  amount: 1237.00 },
    { name: "Books / Education",   eligible: true,  documented: true,  amount: 204.97  },
    { name: "Hardware (Sec. 179)", eligible: true,  documented: true,  amount: 1061.00 },
    { name: "Health Insurance",    eligible: true,  documented: true,  amount: 850.00  },
    { name: "Home Office",         eligible: true,  documented: false, amount: 0       },
    { name: "SEP-IRA Contrib.",    eligible: true,  documented: false, amount: 0       },
    { name: "Vehicle / Mileage",   eligible: false, documented: false, amount: 0       },
    { name: "½ SE Tax Deduction",  eligible: true,  documented: true,  amount: halfSE  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Tax Center</div>
          <div className="sec-sub">Schedule C · SE Tax · Quarterly estimates · FY 2025</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn btn-sm">Export Schedule C</button>
          <button className="btn btn-sm">Tax Docs</button>
        </div>
      </div>
      <div style={{ overflow: "auto", flex: 1, padding: 1 }}>
        <div className="tax-grid">
          {/* Schedule C */}
          <div className="tax-panel">
            <div className="tax-title">Schedule C — Profit or Loss from Business</div>
            {[
              ["Gross receipts (line 1)",      ytdRev,   false],
              ["Returns & allowances (line 2)", 0,        false],
              ["Gross profit (line 5)",         ytdRev,   false],
            ].map(([l, v]) => (
              <div key={l} className="tax-row">
                <span className="lbl">{l}</span>
                <span style={{ fontFamily: "var(--font)" }}>{fmt(v)}</span>
              </div>
            ))}
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--text-dim)", margin: "8px 0 4px" }}>
              Deductible Expenses
            </div>
            {[
              ["Cloud & hosting",          897.00   ],
              ["Software & subscriptions", 340.00   ],
              ["Books & education",        204.97   ],
              ["Office supplies",          89.00    ],
              ["Health insurance",         850.00   ],
              ["½ SE tax deduction",       halfSE   ],
            ].map(([l, v]) => (
              <div key={l} className="tax-row">
                <span className="lbl">{l}</span>
                <span className="neg" style={{ fontFamily: "var(--font)" }}>({fmt(v)})</span>
              </div>
            ))}
            <div className="tax-total">
              <span>Net Profit (line 31)</span>
              <span className="pos" style={{ fontFamily: "var(--font)" }}>{fmt(adjNet)}</span>
            </div>
          </div>

          {/* SE Tax calculation */}
          <div className="tax-panel">
            <div className="tax-title">Self-Employment Tax (Schedule SE)</div>
            {[
              ["Net profit from Sch. C",       fmt(net)             ],
              ["× 92.35% = net SE earnings",   fmt(seSelf)          ],
              ["× 15.3% SE tax rate",          fmt(seTax)           ],
              ["  12.4% Social Security",      fmt(seSelf * 0.124)  ],
              ["  2.9% Medicare",              fmt(seSelf * 0.029)  ],
              ["Deductible ½ of SE tax",       fmt(halfSE)          ],
            ].map(([l, v]) => (
              <div key={l} className="tax-row">
                <span className="lbl">{l}</span>
                <span style={{ fontFamily: "var(--font)" }}>{v}</span>
              </div>
            ))}
            <div className="tax-total">
              <span>SE Tax Owed</span>
              <span className="neg" style={{ fontFamily: "var(--font)" }}>{fmt(seTax)}</span>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="tax-title">Quarterly Payments (Form 1040-ES)</div>
              {[
                { q: "Q1", due: "Apr 15 2025", paid: 200,  est: qEst, past: true  },
                { q: "Q2", due: "Jun 16 2025", paid: 0,    est: qEst, past: false },
                { q: "Q3", due: "Sep 15 2025", paid: 0,    est: qEst, past: false },
                { q: "Q4", due: "Jan 15 2026", paid: 0,    est: qEst, past: false },
              ].map(q => (
                <div key={q.q} className="tax-row" style={{ flexDirection: "column", gap: 2, alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="lbl">{q.q} — <span style={{ fontSize: 9 }}>due {q.due}</span></span>
                    <span style={{ fontFamily: "var(--font)" }}>{fmt(q.est)}</span>
                  </div>
                  {q.paid > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--c-pos)" }}>
                      <span>Paid: {fmt(q.paid)}</span>
                      <span>Remaining: {fmt(Math.max(0, q.est - q.paid))}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Deduction tracker */}
          <div className="tax-panel" style={{ gridColumn: "1 / -1" }}>
            <div className="tax-title">Deduction Tracker — Business Expenses</div>
            <table className="lv">
              <thead>
                <tr>
                  <th style={{ width: 16 }}></th>
                  <th>Deduction Type</th>
                  <th>Eligible?</th>
                  <th>Documented?</th>
                  <th className="right" style={{ width: 110 }}>YTD Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map(d => (
                  <tr key={d.name}>
                    <td className="center">
                      <span className="ded-dot" style={{ color: d.documented ? "var(--bd-green)" : d.eligible ? "var(--bd-amber)" : "#aaa" }}>
                        {d.documented ? "●" : d.eligible ? "○" : "×"}
                      </span>
                    </td>
                    <td style={{ color: !d.eligible ? "var(--text-dim)" : "var(--text)" }}>{d.name}</td>
                    <td className="center"><span style={{ fontSize: 9 }}>{d.eligible ? "Yes" : "No"}</span></td>
                    <td className="center"><Badge status={d.documented ? "cleared" : d.eligible ? "draft" : "draft"} /></td>
                    <td className={`right ${d.amount > 0 ? "pos" : "dim"}`} style={{ fontFamily: "var(--font)" }}>
                      {d.amount > 0 ? fmt(d.amount) : "—"}
                    </td>
                    <td className="dim" style={{ fontSize: 10 }}>
                      {!d.documented && d.eligible ? "⚑ Gather documentation" : ""}
                      {!d.eligible ? "Not applicable" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 9, color: "var(--text-dim)" }}>
              ● Documented &amp; ready · ○ Eligible but documentation pending · × Not applicable
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App Shell ───────────────────────────────────────────────────────────────

const NAV = [
  { id: "dashboard",    label: "Dashboard",        icon: "◈", group: "Overview" },
  { id: "accounts",     label: "Accounts",          icon: "▣", group: "Money"    },
  { id: "transactions", label: "Transactions",      icon: "↕", group: "Money"    },
  { id: "purchases",    label: "Purchases",         icon: "⊞", group: "Money"    },
  { id: "assets",       label: "Assets",            icon: "◇", group: "Assets"   },
  { id: "coa",          label: "Chart of Accounts", icon: "≡", group: "Ledger"   },
  { id: "tax",          label: "Tax Center",        icon: "⊛", group: "Tax"      },
];

export default function App() {
  const [section, setSection] = useState("dashboard");
  const [clock,   setClock  ] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const groups = [...new Set(NAV.map(n => n.group))];

  const render = () => {
    switch (section) {
      case "dashboard":    return <Dashboard />;
      case "transactions": return <TransactionsView />;
      case "purchases":    return <PurchasesView />;
      case "assets":       return <AssetsView />;
      case "accounts":     return <AccountsView />;
      case "coa":          return <ChartOfAccountsView />;
      case "tax":          return <TaxCenterView />;
      default:             return <Dashboard />;
    }
  };

  const timeStr = clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <>
      <style>{CSS}</style>
      <div className="desktop">
        {/* ── Menu Bar ── */}
        <div className="menubar">
          <div className="mb-item" style={{ fontSize: 14, paddingTop: 0, paddingBottom: 0, lineHeight: "20px" }}>✦</div>
          <div className="mb-item mb-bold">Ledger</div>
          <div className="mb-item">File</div>
          <div className="mb-item">Edit</div>
          <div className="mb-item">View</div>
          <div className="mb-item">Reports</div>
          <div className="mb-item">Window</div>
          <div className="mb-spacer" />
          <div className="mb-clock">{dateStr}  {timeStr}</div>
        </div>

        {/* ── App Window ── */}
        <div className="win">
          {/* Title Bar */}
          <div className="titlebar">
            <div className="tb-box" title="Close" />
            <div className="tb-title">Ledger  ·  Single-Member LLC  ·  Schedule C  ·  FY 2025</div>
            <div style={{ flex: 1 }} />
            <div className="tb-box" title="Zoom" />
          </div>

          {/* Body */}
          <div className="win-body">
            {/* Sidebar */}
            <div className="sidebar">
              <div className="sb-logo">
                <span>✦</span>
                <span>Ledger</span>
              </div>
              {groups.map(g => (
                <div key={g}>
                  <div className="sb-group">{g}</div>
                  {NAV.filter(n => n.group === g).map(n => (
                    <div
                      key={n.id}
                      className={`sb-item ${section === n.id ? "active" : ""}`}
                      onClick={() => setSection(n.id)}
                    >
                      <span className="sb-icon">{n.icon}</span>
                      <span>{n.label}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="sb-spacer" />
              <div className="sb-footer">
                <div style={{ fontWeight: 500 }}>Single-Member LLC</div>
                <div className="sb-footer-sub">Disregarded Entity</div>
                <div className="sb-footer-sub" style={{ fontSize: 9, marginTop: 3 }}>FY 2025  ·  Schedule C</div>
              </div>
            </div>

            {/* Main */}
            <div className="main">
              {render()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
