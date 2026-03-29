import React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
const CONVERSATIONS = [
  {
    id: 1,
    title: "Writing a Python web scraper",
    model: "Claude 3.5 Sonnet",
    date: "Feb 28, 2026",
    tags: ["coding", "python"],
    starred: true,
    messages: [
      { role: "user", text: "Can you help me write a Python web scraper that extracts product prices from an e-commerce site?" },
      { role: "assistant", text: "I'd be happy to help you build a web scraper! Here's a clean approach using requests and BeautifulSoup:\n\nimport requests\nfrom bs4 import BeautifulSoup\n\ndef scrape_prices(url):\n    response = requests.get(url)\n    soup = BeautifulSoup(response.text, 'html.parser')\n    products = soup.find_all('div', class_='product')\n    return [(p.find('h2').text, p.find('.price').text) for p in products]\n\nThis handles the basic structure. Want me to add error handling and rate limiting?" },
      { role: "user", text: "Yes, please add error handling and also save results to a CSV file." },
      { role: "assistant", text: "Here's the enhanced version with error handling, rate limiting, and CSV export:\n\nimport requests, csv, time\nfrom bs4 import BeautifulSoup\n\ndef scrape_with_retry(url, max_retries=3):\n    for attempt in range(max_retries):\n        try:\n            response = requests.get(url, timeout=10)\n            response.raise_for_status()\n            return response\n        except requests.RequestException as e:\n            if attempt == max_retries - 1:\n                raise\n            time.sleep(2 ** attempt)\n\nThis includes exponential backoff and writes results to products.csv automatically." }
    ]
  },
  {
    id: 2,
    title: "Explaining quantum computing",
    model: "GPT-4o",
    date: "Feb 27, 2026",
    tags: ["science", "education"],
    starred: false,
    messages: [
      { role: "user", text: "Explain quantum computing like I'm 10 years old." },
      { role: "assistant", text: "Imagine you have a magic coin. A regular coin is either heads or tails when you look at it. But a quantum coin is spinning in the air \u2014 it's BOTH heads AND tails at the same time until you catch it!\n\nQuantum computers use tiny things called 'qubits' that work like these magic coins. Because they can be both 0 and 1 at once, they can try lots of answers to a problem at the same time, like having millions of helpers all working together.\n\nRegular computers are like reading one book at a time. Quantum computers are like reading ALL the books in the library at once!" },
      { role: "user", text: "That's great! Now what about quantum entanglement?" },
      { role: "assistant", text: "Okay, imagine you have two magic socks. You put one in your backpack and mail the other to your friend on the other side of the world.\n\nWhen you look at your sock and see it's RED, you INSTANTLY know your friend's sock is BLUE \u2014 no matter how far apart you are! It's like the socks are secretly connected by an invisible string.\n\nThat's quantum entanglement! Two quantum particles get 'entangled' so that what happens to one instantly affects the other. Einstein called it 'spooky action at a distance' because even he thought it was weird!\n\nScientists are using this to build super-secure communication systems where nobody can spy on your messages." }
    ]
  },
  {
    id: 3,
    title: "Planning a trip to Japan",
    model: "Claude 3 Opus",
    date: "Feb 25, 2026",
    tags: ["travel", "planning"],
    starred: true,
    messages: [
      { role: "user", text: "I'm planning a 2-week trip to Japan in April. What's the best itinerary?" },
      { role: "assistant", text: "April is perfect \u2014 cherry blossom season! Here's my suggested 14-day itinerary:\n\nWeek 1 \u2014 Kanto & Central:\n\u2022 Days 1-4: Tokyo (Shibuya, Shinjuku, Akihabara, Asakusa, Tsukiji Outer Market)\n\u2022 Day 5: Day trip to Kamakura (Great Buddha, bamboo groves)\n\u2022 Days 6-7: Hakone (hot springs, Mt. Fuji views)\n\nWeek 2 \u2014 Kansai & Beyond:\n\u2022 Days 8-10: Kyoto (Fushimi Inari, Arashiyama, Kinkaku-ji, geisha district)\n\u2022 Day 11: Nara (friendly deer, ancient temples)\n\u2022 Days 12-13: Osaka (street food in Dotonbori, Osaka Castle)\n\u2022 Day 14: Return to Tokyo for departure\n\nGet a 14-day Japan Rail Pass \u2014 it'll save you hundreds on bullet trains!" },
      { role: "user", text: "What about budget? How much should I expect to spend?" },
      { role: "assistant", text: "Here's a realistic daily budget breakdown:\n\nBudget traveler: \xA58,000-12,000/day ($55-80)\n- Hostels/capsule hotels, convenience store meals, free attractions\n\nMid-range: \xA515,000-25,000/day ($100-170)\n- Business hotels, mix of restaurants, paid attractions\n\nComfortable: \xA530,000-50,000/day ($200-340)\n- Nice ryokans, quality restaurants, taxis when needed\n\nBig costs to plan for:\n\u2022 JR Pass (14 days): ~\xA550,000 ($340)\n\u2022 Flights: $800-1,400 round trip\n\u2022 Accommodation: $40-200/night depending on style\n\nFor 2 weeks mid-range, budget roughly $2,500-3,500 total excluding flights. Japan is surprisingly affordable if you eat at local spots!" }
    ]
  },
  {
    id: 4,
    title: "Debugging React useEffect",
    model: "Claude 3.5 Sonnet",
    date: "Feb 24, 2026",
    tags: ["coding", "react", "debugging"],
    starred: false,
    messages: [
      { role: "user", text: "My useEffect is causing an infinite loop. Here's my code:\n\nuseEffect(() => {\n  setData(fetchData());\n}, [data]);" },
      { role: "assistant", text: "Classic infinite loop! Here's what's happening:\n\n1. Component renders \u2192 useEffect runs\n2. setData updates state \u2192 triggers re-render\n3. 'data' changed \u2192 useEffect runs again\n4. Goto step 2... forever!\n\nThe fix depends on what you actually need:\n\n// If you only want to fetch once on mount:\nuseEffect(() => {\n  fetchData().then(setData);\n}, []); // empty dependency array\n\n// If you need to refetch when some trigger changes:\nuseEffect(() => {\n  fetchData(searchQuery).then(setData);\n}, [searchQuery]); // depend on the TRIGGER, not the RESULT\n\nGolden rule: Never put the state you're setting inside the dependency array of the effect that sets it." }
    ]
  },
  {
    id: 5,
    title: "Sourdough bread recipe",
    model: "GPT-4o",
    date: "Feb 22, 2026",
    tags: ["cooking", "recipes"],
    starred: false,
    messages: [
      { role: "user", text: "Give me a beginner-friendly sourdough bread recipe." },
      { role: "assistant", text: "Welcome to the sourdough journey! Here's my foolproof beginner recipe:\n\nIngredients:\n\u2022 500g bread flour\n\u2022 350g water (warm, not hot)\n\u2022 100g active sourdough starter\n\u2022 10g salt\n\nTimeline (it's a 24-hour process):\n\nDay 1, Evening:\n1. Mix flour + water, rest 30 min (autolyse)\n2. Add starter + salt, squish together\n3. Every 30 min for 2 hours: stretch & fold\n4. Cover, leave on counter 4-8 hours\n\nDay 2, Morning:\n5. Shape into a ball on floured surface\n6. Place in floured bowl/banneton, fridge 8-12 hours\n\nDay 2, Evening:\n7. Preheat Dutch oven at 500\xB0F for 45 min\n8. Score the top, bake covered 20 min\n9. Uncover, bake 20 more min at 450\xB0F\n10. Cool 1 hour before cutting (hardest step!)\n\nThe key is patience. Your first loaf won't be perfect, and that's okay!" }
    ]
  },
  {
    id: 6,
    title: "Machine learning model comparison",
    model: "Claude 3.5 Sonnet",
    date: "Feb 20, 2026",
    tags: ["coding", "ml", "data-science"],
    starred: true,
    messages: [
      { role: "user", text: "Compare Random Forest vs XGBoost vs Neural Networks for tabular data classification." },
      { role: "assistant", text: "Great question \u2014 this comes up constantly in practice. Here's my honest comparison:\n\nRandom Forest:\n\u2713 Works great out of the box, minimal tuning needed\n\u2713 Handles missing values and mixed data types\n\u2713 Very interpretable (feature importance)\n\u2717 Can struggle with high-cardinality categoricals\n\u2717 Plateaus with very large datasets\nBest for: Quick baselines, interpretability requirements\n\nXGBoost/LightGBM:\n\u2713 Usually wins Kaggle competitions on tabular data\n\u2713 Excellent with structured/tabular data\n\u2713 Built-in regularization, handles imbalanced data\n\u2717 More hyperparameters to tune\n\u2717 Can overfit small datasets\nBest for: Production tabular ML, when you need peak performance\n\nNeural Networks:\n\u2713 Can capture complex non-linear patterns\n\u2713 Benefits from massive datasets\n\u2717 Needs much more data to outperform tree methods\n\u2717 Harder to interpret, expensive to train\n\u2717 Requires careful feature engineering for tabular data\nBest for: Very large datasets, multimodal inputs\n\nMy recommendation: Start with XGBoost. It wins 80% of tabular data problems." }
    ]
  },
  {
    id: 7,
    title: "Philosophy of consciousness",
    model: "Claude 3 Opus",
    date: "Feb 18, 2026",
    tags: ["philosophy", "science"],
    starred: false,
    messages: [
      { role: "user", text: "What is the hard problem of consciousness?" },
      { role: "assistant", text: "The hard problem of consciousness, coined by philosopher David Chalmers in 1995, asks a deceptively simple question: Why does subjective experience exist at all?\n\nWe can explain the 'easy problems' \u2014 how the brain processes information, responds to stimuli, integrates data, and controls behavior. These are mechanistic questions.\n\nBut the hard problem asks: Why is there SOMETHING IT IS LIKE to see red, taste chocolate, or feel pain? Why aren't we just biological robots processing information in the dark, with no inner experience?\n\nThink of it this way: A camera detects light at 700nm wavelength. Your eye does too. But you also experience the REDNESS of red. Where does that subjective quality come from? No amount of describing neural firing patterns seems to fully explain WHY there's an experience accompanying the processing.\n\nThis remains one of the deepest unsolved problems in philosophy and science. Major positions include:\n\n\u2022 Physicalism: Consciousness will eventually be explained by physics\n\u2022 Dualism: Mind is fundamentally non-physical\n\u2022 Panpsychism: Consciousness is a fundamental feature of matter\n\u2022 Illusionism: Subjective experience is itself an illusion\n\nEach has serious proponents and serious problems." }
    ]
  },
  {
    id: 8,
    title: "Home workout routine",
    model: "GPT-4o",
    date: "Feb 15, 2026",
    tags: ["fitness", "health"],
    starred: false,
    messages: [
      { role: "user", text: "Design a 30-minute home workout with no equipment." },
      { role: "assistant", text: "Here's a complete 30-minute full-body workout \u2014 no equipment needed!\n\nWarm-up (3 min):\n\u2022 Jumping jacks \u2014 1 min\n\u2022 Arm circles \u2014 30 sec each direction\n\u2022 High knees \u2014 1 min\n\nCircuit 1 \u2014 Upper Body (8 min, 2 rounds):\n\u2022 Push-ups: 12 reps\n\u2022 Tricep dips (using chair): 10 reps\n\u2022 Plank shoulder taps: 20 reps\n\u2022 Diamond push-ups: 8 reps\nRest 30 sec between rounds\n\nCircuit 2 \u2014 Lower Body (8 min, 2 rounds):\n\u2022 Bodyweight squats: 15 reps\n\u2022 Lunges: 10 each leg\n\u2022 Glute bridges: 15 reps\n\u2022 Jump squats: 10 reps\nRest 30 sec between rounds\n\nCircuit 3 \u2014 Core (8 min, 2 rounds):\n\u2022 Bicycle crunches: 20 reps\n\u2022 Mountain climbers: 30 sec\n\u2022 Dead bugs: 10 each side\n\u2022 Plank hold: 45 sec\nRest 30 sec between rounds\n\nCool-down (3 min):\n\u2022 Child's pose, quad stretch, hamstring stretch\n\nDo this 3-4x/week and you'll see results within a month!" }
    ]
  }
];
const ALL_TAGS = [...new Set(CONVERSATIONS.flatMap((c) => c.tags))].sort();
const ALL_MODELS = [...new Set(CONVERSATIONS.map((c) => c.model))].sort();
const STRIPES_BG = `repeating-linear-gradient(0deg, #fff 0px, #fff 1px, #000 1px, #000 2px)`;
function ClassicButton({ children, onClick, active, style, small }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick,
      style: {
        background: active ? "#000" : "#fff",
        color: active ? "#fff" : "#000",
        border: "2px solid #000",
        borderRadius: 4,
        padding: small ? "2px 8px" : "4px 14px",
        fontFamily: "'Chicago_', 'Geneva', 'Monaco', monospace",
        fontSize: small ? 11 : 12,
        cursor: "pointer",
        boxShadow: active ? "none" : "1px 1px 0 #000",
        ...style
      },
      onMouseDown: (e) => {
        if (!active) e.currentTarget.style.boxShadow = "none";
      },
      onMouseUp: (e) => {
        if (!active) e.currentTarget.style.boxShadow = "1px 1px 0 #000";
      }
    },
    children
  );
}
function ClassicCheckbox({ checked, onChange, label }) {
  return /* @__PURE__ */ React.createElement(
    "label",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        fontSize: 11,
        fontFamily: "'Geneva', monospace"
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
function TitleBar({ title, onClose, icon }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        background: STRIPES_BG,
        borderBottom: "2px solid #000",
        padding: "3px 6px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 22,
        cursor: "default",
        userSelect: "none"
      }
    },
    onClose && /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick: onClose,
        style: {
          width: 14,
          height: 14,
          border: "2px solid #000",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: 8,
          flexShrink: 0
        }
      },
      "\u2715"
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          flex: 1,
          textAlign: "center",
          fontFamily: "'Chicago_', 'Geneva', monospace",
          fontSize: 12,
          fontWeight: "bold",
          background: "#fff",
          padding: "0 8px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      },
      icon && /* @__PURE__ */ React.createElement("span", { style: { marginRight: 4 } }, icon),
      title
    )
  );
}
function ClassicScrollbar({ children, style }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        overflow: "auto",
        ...style,
        scrollbarWidth: "auto",
        scrollbarColor: "#888 #fff"
      }
    },
    children
  );
}
function SearchPanel({ searchState, setSearchState, onClose }) {
  const { query, selectedTags, selectedModels, dateFrom, dateTo, starredOnly, searchIn } = searchState;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        border: "2px solid #000",
        background: "#fff",
        position: "absolute",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        width: 440,
        boxShadow: "4px 4px 0 #000"
      }
    },
    /* @__PURE__ */ React.createElement(TitleBar, { title: "\u{1F50D} Advanced Search", onClose }),
    /* @__PURE__ */ React.createElement("div", { style: { padding: 12 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, fontFamily: "'Geneva', monospace", fontWeight: "bold", display: "block", marginBottom: 3 } }, "Search Query:"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: query,
        onChange: (e) => setSearchState((s) => ({ ...s, query: e.target.value })),
        placeholder: "Type to search conversations\u2026",
        style: {
          width: "100%",
          boxSizing: "border-box",
          border: "2px solid #000",
          padding: "4px 6px",
          fontFamily: "'Geneva', monospace",
          fontSize: 12,
          background: "#fff",
          outline: "none"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, fontFamily: "'Geneva', monospace", fontWeight: "bold", display: "block", marginBottom: 3 } }, "Search in:"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12 } }, ["titles", "messages", "both"].map((opt) => /* @__PURE__ */ React.createElement("label", { key: opt, style: { fontSize: 11, fontFamily: "'Geneva', monospace", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" } }, /* @__PURE__ */ React.createElement(
      "span",
      {
        onClick: () => setSearchState((s) => ({ ...s, searchIn: opt })),
        style: {
          width: 12,
          height: 12,
          borderRadius: "50%",
          border: "2px solid #000",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center"
        }
      },
      searchIn === opt && /* @__PURE__ */ React.createElement("span", { style: { width: 6, height: 6, borderRadius: "50%", background: "#000", display: "block" } })
    ), opt.charAt(0).toUpperCase() + opt.slice(1))))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, fontFamily: "'Geneva', monospace", fontWeight: "bold", display: "block", marginBottom: 3 } }, "Tags:"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, ALL_TAGS.map((tag) => /* @__PURE__ */ React.createElement(
      ClassicButton,
      {
        key: tag,
        small: true,
        active: selectedTags.includes(tag),
        onClick: () => setSearchState((s) => ({
          ...s,
          selectedTags: s.selectedTags.includes(tag) ? s.selectedTags.filter((t) => t !== tag) : [...s.selectedTags, tag]
        }))
      },
      tag
    )))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, fontFamily: "'Geneva', monospace", fontWeight: "bold", display: "block", marginBottom: 3 } }, "Model:"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, ALL_MODELS.map((model) => /* @__PURE__ */ React.createElement(
      ClassicButton,
      {
        key: model,
        small: true,
        active: selectedModels.includes(model),
        onClick: () => setSearchState((s) => ({
          ...s,
          selectedModels: s.selectedModels.includes(model) ? s.selectedModels.filter((m) => m !== model) : [...s.selectedModels, model]
        }))
      },
      model
    )))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 12 } }, /* @__PURE__ */ React.createElement(
      ClassicCheckbox,
      {
        checked: starredOnly,
        onChange: () => setSearchState((s) => ({ ...s, starredOnly: !s.starredOnly })),
        label: "\u2B50 Starred only"
      }
    ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, fontFamily: "'Geneva', monospace", display: "block", marginBottom: 2 } }, "From:"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "date",
        value: dateFrom,
        onChange: (e) => setSearchState((s) => ({ ...s, dateFrom: e.target.value })),
        style: { border: "2px solid #000", fontFamily: "'Geneva', monospace", fontSize: 10, padding: "2px 4px" }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: 11, fontFamily: "'Geneva', monospace", display: "block", marginBottom: 2 } }, "To:"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "date",
        value: dateTo,
        onChange: (e) => setSearchState((s) => ({ ...s, dateTo: e.target.value })),
        style: { border: "2px solid #000", fontFamily: "'Geneva', monospace", fontSize: 10, padding: "2px 4px" }
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #000", paddingTop: 8 } }, /* @__PURE__ */ React.createElement(
      ClassicButton,
      {
        onClick: () => setSearchState({
          query: "",
          selectedTags: [],
          selectedModels: [],
          dateFrom: "",
          dateTo: "",
          starredOnly: false,
          searchIn: "both"
        })
      },
      "Clear All"
    ), /* @__PURE__ */ React.createElement(ClassicButton, { active: true, onClick: onClose }, "Done")))
  );
}
function ConversationList({ conversations, selected, onSelect, searchState }) {
  const highlightMatch = (text) => {
    const q = searchState.query.toLowerCase();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return /* @__PURE__ */ React.createElement(React.Fragment, null, text.slice(0, idx), /* @__PURE__ */ React.createElement("span", { style: { background: "#000", color: "#fff", padding: "0 1px" } }, text.slice(idx, idx + q.length)), text.slice(idx + q.length));
  };
  return /* @__PURE__ */ React.createElement("div", null, conversations.map((c) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: c.id,
      onClick: () => onSelect(c.id),
      style: {
        padding: "8px 10px",
        borderBottom: "1px solid #000",
        background: selected === c.id ? "#000" : "#fff",
        color: selected === c.id ? "#fff" : "#000",
        cursor: "pointer",
        fontFamily: "'Geneva', monospace"
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } }, c.starred ? "\u2B50 " : "\u{1F4AC} ", highlightMatch(c.title))),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 3 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, opacity: 0.7 } }, c.model), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, opacity: 0.7 } }, c.date)),
    /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" } }, c.tags.map((t) => /* @__PURE__ */ React.createElement(
      "span",
      {
        key: t,
        style: {
          fontSize: 9,
          border: selected === c.id ? "1px solid #fff" : "1px solid #000",
          padding: "0 4px",
          borderRadius: 2
        }
      },
      t
    )))
  )), conversations.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: 20, textAlign: "center", fontFamily: "'Geneva', monospace", fontSize: 12, color: "#666" } }, "No conversations found."));
}
function MessageView({ conversation }) {
  if (!conversation) {
    return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: "'Geneva', monospace" } }, /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", color: "#666" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u{1F5A5}\uFE0F"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13 } }, "Select a conversation"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, marginTop: 4 } }, "from the list on the left")));
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        padding: "8px 12px",
        borderBottom: "2px solid #000",
        background: "#f0f0f0",
        fontFamily: "'Geneva', monospace"
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: "bold" } }, conversation.starred ? "\u2B50 " : "", conversation.title),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, marginTop: 2, display: "flex", gap: 12, opacity: 0.7 } }, /* @__PURE__ */ React.createElement("span", null, "\u{1F916} ", conversation.model), /* @__PURE__ */ React.createElement("span", null, "\u{1F4C5} ", conversation.date), /* @__PURE__ */ React.createElement("span", null, "\u{1F4AC} ", conversation.messages.length, " messages"))
  ), /* @__PURE__ */ React.createElement(ClassicScrollbar, { style: { height: "calc(100% - 52px)" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: 12 } }, conversation.messages.map((msg, i) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: i,
      style: {
        marginBottom: 16,
        display: "flex",
        gap: 10
      }
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          width: 32,
          height: 32,
          border: "2px solid #000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
          background: msg.role === "user" ? "#fff" : "#000",
          color: msg.role === "user" ? "#000" : "#fff"
        }
      },
      msg.role === "user" ? "\u{1F464}" : "\u{1F916}"
    ),
    /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          fontSize: 10,
          fontFamily: "'Geneva', monospace",
          fontWeight: "bold",
          marginBottom: 3,
          textTransform: "uppercase"
        }
      },
      msg.role === "user" ? "You" : conversation.model
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          fontFamily: "'Geneva', monospace",
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          border: msg.role === "assistant" ? "1px solid #000" : "none",
          padding: msg.role === "assistant" ? 10 : 0,
          background: msg.role === "assistant" ? "#fafafa" : "transparent"
        }
      },
      msg.text
    ))
  )))));
}
function StatusBar({ count, total, activeFilters }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        borderTop: "2px solid #000",
        padding: "3px 10px",
        fontFamily: "'Geneva', monospace",
        fontSize: 10,
        display: "flex",
        justifyContent: "space-between",
        background: "#f0f0f0",
        flexShrink: 0
      }
    },
    /* @__PURE__ */ React.createElement("span", null, "\u{1F4C2} ", count, " of ", total, " conversations", activeFilters > 0 && ` \u2022 ${activeFilters} filter${activeFilters > 1 ? "s" : ""} active`),
    /* @__PURE__ */ React.createElement("span", null, "\u{1F5A5}\uFE0F AI Chat Browser v1.0")
  );
}
function App() {
  const [selectedId, setSelectedId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchState, setSearchState] = useState({
    query: "",
    selectedTags: [],
    selectedModels: [],
    dateFrom: "",
    dateTo: "",
    starredOnly: false,
    searchIn: "both"
  });
  const activeFilters = useMemo(() => {
    let count = 0;
    if (searchState.query) count++;
    if (searchState.selectedTags.length) count++;
    if (searchState.selectedModels.length) count++;
    if (searchState.starredOnly) count++;
    if (searchState.dateFrom || searchState.dateTo) count++;
    return count;
  }, [searchState]);
  const filtered = useMemo(() => {
    return CONVERSATIONS.filter((c) => {
      const q = searchState.query.toLowerCase();
      if (q) {
        const inTitle = c.title.toLowerCase().includes(q);
        const inMessages = c.messages.some((m) => m.text.toLowerCase().includes(q));
        if (searchState.searchIn === "titles" && !inTitle) return false;
        if (searchState.searchIn === "messages" && !inMessages) return false;
        if (searchState.searchIn === "both" && !inTitle && !inMessages) return false;
      }
      if (searchState.selectedTags.length && !searchState.selectedTags.some((t) => c.tags.includes(t))) return false;
      if (searchState.selectedModels.length && !searchState.selectedModels.includes(c.model)) return false;
      if (searchState.starredOnly && !c.starred) return false;
      return true;
    });
  }, [searchState]);
  const selectedConvo = CONVERSATIONS.find((c) => c.id === selectedId);
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100vh",
        background: "#c0c0c0",
        backgroundImage: `
          radial-gradient(circle at 2px 2px, #a0a0a0 1px, transparent 0)
        `,
        backgroundSize: "8px 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box"
      }
    },
    /* @__PURE__ */ React.createElement("style", null, `
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
        * { font-family: 'VT323', 'Geneva', 'Monaco', monospace !important; }
        ::-webkit-scrollbar { width: 16px; }
        ::-webkit-scrollbar-track { background: #fff; border-left: 2px solid #000; }
        ::-webkit-scrollbar-thumb { background: #888; border: 2px solid #000; }
        ::-webkit-scrollbar-button { background: #ccc; border: 2px solid #000; height: 16px; }
        ::selection { background: #000; color: #fff; }
        input:focus { outline: none; box-shadow: inset 0 0 0 1px #000; }
      `),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          width: "100%",
          maxWidth: 1100,
          height: "90vh",
          maxHeight: 720,
          border: "3px solid #000",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          boxShadow: "6px 6px 0 #000",
          position: "relative",
          overflow: "hidden"
        }
      },
      /* @__PURE__ */ React.createElement(TitleBar, { title: "\u{1F4BE} AI Chat Conversation Browser", icon: "" }),
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            borderBottom: "2px solid #000",
            padding: "2px 8px",
            display: "flex",
            gap: 16,
            fontFamily: "'Geneva', monospace",
            fontSize: 13,
            background: "#fff",
            alignItems: "center"
          }
        },
        /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", cursor: "pointer" } }, "\u{1F4C1} File"),
        /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", cursor: "pointer" } }, "\u270F\uFE0F Edit"),
        /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", cursor: "pointer" } }, "\u{1F441}\uFE0F View"),
        /* @__PURE__ */ React.createElement(
          "span",
          {
            style: { fontWeight: "bold", cursor: "pointer" },
            onClick: () => setShowSearch(true)
          },
          "\u{1F50D} Search"
        ),
        /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold", cursor: "pointer" } }, "\u2753 Help"),
        /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }),
        /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, opacity: 0.5 } }, (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }))
      ),
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            borderBottom: "2px solid #000",
            padding: "5px 8px",
            display: "flex",
            gap: 6,
            alignItems: "center",
            background: "#f8f8f8"
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { position: "relative", flex: 1, maxWidth: 300 } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            value: searchState.query,
            onChange: (e) => setSearchState((s) => ({ ...s, query: e.target.value })),
            placeholder: "\u{1F50D} Quick search\u2026",
            style: {
              width: "100%",
              boxSizing: "border-box",
              border: "2px solid #000",
              padding: "4px 8px",
              fontFamily: "'Geneva', monospace",
              fontSize: 13,
              background: "#fff"
            }
          }
        )),
        /* @__PURE__ */ React.createElement(ClassicButton, { onClick: () => setShowSearch(true) }, "\u{1F50D} Advanced"),
        /* @__PURE__ */ React.createElement("div", { style: { width: 1, height: 20, background: "#000", margin: "0 4px" } }),
        /* @__PURE__ */ React.createElement(
          ClassicButton,
          {
            active: searchState.starredOnly,
            onClick: () => setSearchState((s) => ({ ...s, starredOnly: !s.starredOnly }))
          },
          "\u2B50 Starred"
        ),
        activeFilters > 0 && /* @__PURE__ */ React.createElement(
          ClassicButton,
          {
            small: true,
            onClick: () => setSearchState({
              query: "",
              selectedTags: [],
              selectedModels: [],
              dateFrom: "",
              dateTo: "",
              starredOnly: false,
              searchIn: "both"
            })
          },
          "\u2715 Clear (",
          activeFilters,
          ")"
        )
      ),
      /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flex: 1, overflow: "hidden" } }, /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            width: 300,
            borderRight: "2px solid #000",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0
          }
        },
        /* @__PURE__ */ React.createElement(
          "div",
          {
            style: {
              padding: "4px 8px",
              borderBottom: "1px solid #000",
              background: "#e8e8e8",
              fontFamily: "'Geneva', monospace",
              fontSize: 11,
              fontWeight: "bold"
            }
          },
          "\u{1F4CB} Conversations (",
          filtered.length,
          ")"
        ),
        /* @__PURE__ */ React.createElement(ClassicScrollbar, { style: { flex: 1 } }, /* @__PURE__ */ React.createElement(
          ConversationList,
          {
            conversations: filtered,
            selected: selectedId,
            onSelect: setSelectedId,
            searchState
          }
        ))
      ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" } }, /* @__PURE__ */ React.createElement(ClassicScrollbar, { style: { flex: 1 } }, /* @__PURE__ */ React.createElement(MessageView, { conversation: selectedConvo })))),
      /* @__PURE__ */ React.createElement(StatusBar, { count: filtered.length, total: CONVERSATIONS.length, activeFilters }),
      showSearch && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
        "div",
        {
          onClick: () => setShowSearch(false),
          style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", zIndex: 99 }
        }
      ), /* @__PURE__ */ React.createElement(SearchPanel, { searchState, setSearchState, onClose: () => setShowSearch(false) }))
    )
  );
}
const __artifactDefault = App;
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(__artifactDefault));
