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
      { role: "assistant", text: "Here's the enhanced version with error handling, rate limiting, and CSV export:\n\nimport requests, csv, time\nfrom bs4 import BeautifulSoup\n\ndef scrape_with_retry(url, max_retries=3):\n    for attempt in range(max_retries):\n        try:\n            response = requests.get(url, timeout=10)\n            response.raise_for_status()\n            return response\n        except requests.RequestException as e:\n            if attempt == max_retries - 1:\n                raise\n            time.sleep(2 ** attempt)\n\nThis includes exponential backoff and writes results to products.csv automatically." },
    ],
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
      { role: "assistant", text: "Imagine you have a magic coin. A regular coin is either heads or tails when you look at it. But a quantum coin is spinning in the air — it's BOTH heads AND tails at the same time until you catch it!\n\nQuantum computers use tiny things called 'qubits' that work like these magic coins. Because they can be both 0 and 1 at once, they can try lots of answers to a problem at the same time, like having millions of helpers all working together.\n\nRegular computers are like reading one book at a time. Quantum computers are like reading ALL the books in the library at once!" },
      { role: "user", text: "That's great! Now what about quantum entanglement?" },
      { role: "assistant", text: "Okay, imagine you have two magic socks. You put one in your backpack and mail the other to your friend on the other side of the world.\n\nWhen you look at your sock and see it's RED, you INSTANTLY know your friend's sock is BLUE — no matter how far apart you are! It's like the socks are secretly connected by an invisible string.\n\nThat's quantum entanglement! Two quantum particles get 'entangled' so that what happens to one instantly affects the other. Einstein called it 'spooky action at a distance' because even he thought it was weird!\n\nScientists are using this to build super-secure communication systems where nobody can spy on your messages." },
    ],
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
      { role: "assistant", text: "April is perfect — cherry blossom season! Here's my suggested 14-day itinerary:\n\nWeek 1 — Kanto & Central:\n• Days 1-4: Tokyo (Shibuya, Shinjuku, Akihabara, Asakusa, Tsukiji Outer Market)\n• Day 5: Day trip to Kamakura (Great Buddha, bamboo groves)\n• Days 6-7: Hakone (hot springs, Mt. Fuji views)\n\nWeek 2 — Kansai & Beyond:\n• Days 8-10: Kyoto (Fushimi Inari, Arashiyama, Kinkaku-ji, geisha district)\n• Day 11: Nara (friendly deer, ancient temples)\n• Days 12-13: Osaka (street food in Dotonbori, Osaka Castle)\n• Day 14: Return to Tokyo for departure\n\nGet a 14-day Japan Rail Pass — it'll save you hundreds on bullet trains!" },
      { role: "user", text: "What about budget? How much should I expect to spend?" },
      { role: "assistant", text: "Here's a realistic daily budget breakdown:\n\nBudget traveler: ¥8,000-12,000/day ($55-80)\n- Hostels/capsule hotels, convenience store meals, free attractions\n\nMid-range: ¥15,000-25,000/day ($100-170)\n- Business hotels, mix of restaurants, paid attractions\n\nComfortable: ¥30,000-50,000/day ($200-340)\n- Nice ryokans, quality restaurants, taxis when needed\n\nBig costs to plan for:\n• JR Pass (14 days): ~¥50,000 ($340)\n• Flights: $800-1,400 round trip\n• Accommodation: $40-200/night depending on style\n\nFor 2 weeks mid-range, budget roughly $2,500-3,500 total excluding flights. Japan is surprisingly affordable if you eat at local spots!" },
    ],
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
      { role: "assistant", text: "Classic infinite loop! Here's what's happening:\n\n1. Component renders → useEffect runs\n2. setData updates state → triggers re-render\n3. 'data' changed → useEffect runs again\n4. Goto step 2... forever!\n\nThe fix depends on what you actually need:\n\n// If you only want to fetch once on mount:\nuseEffect(() => {\n  fetchData().then(setData);\n}, []); // empty dependency array\n\n// If you need to refetch when some trigger changes:\nuseEffect(() => {\n  fetchData(searchQuery).then(setData);\n}, [searchQuery]); // depend on the TRIGGER, not the RESULT\n\nGolden rule: Never put the state you're setting inside the dependency array of the effect that sets it." },
    ],
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
      { role: "assistant", text: "Welcome to the sourdough journey! Here's my foolproof beginner recipe:\n\nIngredients:\n• 500g bread flour\n• 350g water (warm, not hot)\n• 100g active sourdough starter\n• 10g salt\n\nTimeline (it's a 24-hour process):\n\nDay 1, Evening:\n1. Mix flour + water, rest 30 min (autolyse)\n2. Add starter + salt, squish together\n3. Every 30 min for 2 hours: stretch & fold\n4. Cover, leave on counter 4-8 hours\n\nDay 2, Morning:\n5. Shape into a ball on floured surface\n6. Place in floured bowl/banneton, fridge 8-12 hours\n\nDay 2, Evening:\n7. Preheat Dutch oven at 500°F for 45 min\n8. Score the top, bake covered 20 min\n9. Uncover, bake 20 more min at 450°F\n10. Cool 1 hour before cutting (hardest step!)\n\nThe key is patience. Your first loaf won't be perfect, and that's okay!" },
    ],
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
      { role: "assistant", text: "Great question — this comes up constantly in practice. Here's my honest comparison:\n\nRandom Forest:\n✓ Works great out of the box, minimal tuning needed\n✓ Handles missing values and mixed data types\n✓ Very interpretable (feature importance)\n✗ Can struggle with high-cardinality categoricals\n✗ Plateaus with very large datasets\nBest for: Quick baselines, interpretability requirements\n\nXGBoost/LightGBM:\n✓ Usually wins Kaggle competitions on tabular data\n✓ Excellent with structured/tabular data\n✓ Built-in regularization, handles imbalanced data\n✗ More hyperparameters to tune\n✗ Can overfit small datasets\nBest for: Production tabular ML, when you need peak performance\n\nNeural Networks:\n✓ Can capture complex non-linear patterns\n✓ Benefits from massive datasets\n✗ Needs much more data to outperform tree methods\n✗ Harder to interpret, expensive to train\n✗ Requires careful feature engineering for tabular data\nBest for: Very large datasets, multimodal inputs\n\nMy recommendation: Start with XGBoost. It wins 80% of tabular data problems." },
    ],
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
      { role: "assistant", text: "The hard problem of consciousness, coined by philosopher David Chalmers in 1995, asks a deceptively simple question: Why does subjective experience exist at all?\n\nWe can explain the 'easy problems' — how the brain processes information, responds to stimuli, integrates data, and controls behavior. These are mechanistic questions.\n\nBut the hard problem asks: Why is there SOMETHING IT IS LIKE to see red, taste chocolate, or feel pain? Why aren't we just biological robots processing information in the dark, with no inner experience?\n\nThink of it this way: A camera detects light at 700nm wavelength. Your eye does too. But you also experience the REDNESS of red. Where does that subjective quality come from? No amount of describing neural firing patterns seems to fully explain WHY there's an experience accompanying the processing.\n\nThis remains one of the deepest unsolved problems in philosophy and science. Major positions include:\n\n• Physicalism: Consciousness will eventually be explained by physics\n• Dualism: Mind is fundamentally non-physical\n• Panpsychism: Consciousness is a fundamental feature of matter\n• Illusionism: Subjective experience is itself an illusion\n\nEach has serious proponents and serious problems." },
    ],
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
      { role: "assistant", text: "Here's a complete 30-minute full-body workout — no equipment needed!\n\nWarm-up (3 min):\n• Jumping jacks — 1 min\n• Arm circles — 30 sec each direction\n• High knees — 1 min\n\nCircuit 1 — Upper Body (8 min, 2 rounds):\n• Push-ups: 12 reps\n• Tricep dips (using chair): 10 reps\n• Plank shoulder taps: 20 reps\n• Diamond push-ups: 8 reps\nRest 30 sec between rounds\n\nCircuit 2 — Lower Body (8 min, 2 rounds):\n• Bodyweight squats: 15 reps\n• Lunges: 10 each leg\n• Glute bridges: 15 reps\n• Jump squats: 10 reps\nRest 30 sec between rounds\n\nCircuit 3 — Core (8 min, 2 rounds):\n• Bicycle crunches: 20 reps\n• Mountain climbers: 30 sec\n• Dead bugs: 10 each side\n• Plank hold: 45 sec\nRest 30 sec between rounds\n\nCool-down (3 min):\n• Child's pose, quad stretch, hamstring stretch\n\nDo this 3-4x/week and you'll see results within a month!" },
    ],
  },
];

const ALL_TAGS = [...new Set(CONVERSATIONS.flatMap((c) => c.tags))].sort();
const ALL_MODELS = [...new Set(CONVERSATIONS.map((c) => c.model))].sort();

// Classic Mac bitmap-style patterns
const STRIPES_BG = `repeating-linear-gradient(0deg, #fff 0px, #fff 1px, #000 1px, #000 2px)`;

function ClassicButton({ children, onClick, active, style, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#000" : "#fff",
        color: active ? "#fff" : "#000",
        border: "2px solid #000",
        borderRadius: 4,
        padding: small ? "2px 8px" : "4px 14px",
        fontFamily: "'Chicago_', 'Geneva', 'Monaco', monospace",
        fontSize: small ? 11 : 12,
        cursor: "pointer",
        boxShadow: active ? "none" : "1px 1px 0 #000",
        ...style,
      }}
      onMouseDown={(e) => {
        if (!active) e.currentTarget.style.boxShadow = "none";
      }}
      onMouseUp={(e) => {
        if (!active) e.currentTarget.style.boxShadow = "1px 1px 0 #000";
      }}
    >
      {children}
    </button>
  );
}

function ClassicCheckbox({ checked, onChange, label }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        fontSize: 11,
        fontFamily: "'Geneva', monospace",
      }}
    >
      <span
        onClick={onChange}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          border: "2px solid #000",
          background: "#fff",
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {checked ? "✕" : ""}
      </span>
      {label}
    </label>
  );
}

function TitleBar({ title, onClose, icon }) {
  return (
    <div
      style={{
        background: STRIPES_BG,
        borderBottom: "2px solid #000",
        padding: "3px 6px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 22,
        cursor: "default",
        userSelect: "none",
      }}
    >
      {onClose && (
        <div
          onClick={onClose}
          style={{
            width: 14,
            height: 14,
            border: "2px solid #000",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 8,
            flexShrink: 0,
          }}
        >
          ✕
        </div>
      )}
      <div
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: "'Chicago_', 'Geneva', monospace",
          fontSize: 12,
          fontWeight: "bold",
          background: "#fff",
          padding: "0 8px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
        {title}
      </div>
    </div>
  );
}

function ClassicScrollbar({ children, style }) {
  return (
    <div
      style={{
        overflow: "auto",
        ...style,
        scrollbarWidth: "auto",
        scrollbarColor: "#888 #fff",
      }}
    >
      {children}
    </div>
  );
}

function SearchPanel({ searchState, setSearchState, onClose }) {
  const { query, selectedTags, selectedModels, dateFrom, dateTo, starredOnly, searchIn } = searchState;

  return (
    <div
      style={{
        border: "2px solid #000",
        background: "#fff",
        position: "absolute",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        width: 440,
        boxShadow: "4px 4px 0 #000",
      }}
    >
      <TitleBar title="🔍 Advanced Search" onClose={onClose} />
      <div style={{ padding: 12 }}>
        {/* Search text */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontFamily: "'Geneva', monospace", fontWeight: "bold", display: "block", marginBottom: 3 }}>
            Search Query:
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setSearchState((s) => ({ ...s, query: e.target.value }))}
            placeholder="Type to search conversations…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "2px solid #000",
              padding: "4px 6px",
              fontFamily: "'Geneva', monospace",
              fontSize: 12,
              background: "#fff",
              outline: "none",
            }}
          />
        </div>

        {/* Search in */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontFamily: "'Geneva', monospace", fontWeight: "bold", display: "block", marginBottom: 3 }}>
            Search in:
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            {["titles", "messages", "both"].map((opt) => (
              <label key={opt} style={{ fontSize: 11, fontFamily: "'Geneva', monospace", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <span
                  onClick={() => setSearchState((s) => ({ ...s, searchIn: opt }))}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: "2px solid #000",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {searchIn === opt && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#000", display: "block" }} />
                  )}
                </span>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontFamily: "'Geneva', monospace", fontWeight: "bold", display: "block", marginBottom: 3 }}>
            Tags:
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ALL_TAGS.map((tag) => (
              <ClassicButton
                key={tag}
                small
                active={selectedTags.includes(tag)}
                onClick={() =>
                  setSearchState((s) => ({
                    ...s,
                    selectedTags: s.selectedTags.includes(tag) ? s.selectedTags.filter((t) => t !== tag) : [...s.selectedTags, tag],
                  }))
                }
              >
                {tag}
              </ClassicButton>
            ))}
          </div>
        </div>

        {/* Models */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontFamily: "'Geneva', monospace", fontWeight: "bold", display: "block", marginBottom: 3 }}>
            Model:
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ALL_MODELS.map((model) => (
              <ClassicButton
                key={model}
                small
                active={selectedModels.includes(model)}
                onClick={() =>
                  setSearchState((s) => ({
                    ...s,
                    selectedModels: s.selectedModels.includes(model) ? s.selectedModels.filter((m) => m !== model) : [...s.selectedModels, model],
                  }))
                }
              >
                {model}
              </ClassicButton>
            ))}
          </div>
        </div>

        {/* Starred + Date */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 12 }}>
          <ClassicCheckbox
            checked={starredOnly}
            onChange={() => setSearchState((s) => ({ ...s, starredOnly: !s.starredOnly }))}
            label="⭐ Starred only"
          />
          <div>
            <label style={{ fontSize: 11, fontFamily: "'Geneva', monospace", display: "block", marginBottom: 2 }}>From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setSearchState((s) => ({ ...s, dateFrom: e.target.value }))}
              style={{ border: "2px solid #000", fontFamily: "'Geneva', monospace", fontSize: 10, padding: "2px 4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontFamily: "'Geneva', monospace", display: "block", marginBottom: 2 }}>To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setSearchState((s) => ({ ...s, dateTo: e.target.value }))}
              style={{ border: "2px solid #000", fontFamily: "'Geneva', monospace", fontSize: 10, padding: "2px 4px" }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #000", paddingTop: 8 }}>
          <ClassicButton
            onClick={() =>
              setSearchState({
                query: "",
                selectedTags: [],
                selectedModels: [],
                dateFrom: "",
                dateTo: "",
                starredOnly: false,
                searchIn: "both",
              })
            }
          >
            Clear All
          </ClassicButton>
          <ClassicButton active onClick={onClose}>
            Done
          </ClassicButton>
        </div>
      </div>
    </div>
  );
}

function ConversationList({ conversations, selected, onSelect, searchState }) {
  const highlightMatch = (text) => {
    const q = searchState.query.toLowerCase();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ background: "#000", color: "#fff", padding: "0 1px" }}>{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div>
      {conversations.map((c) => (
        <div
          key={c.id}
          onClick={() => onSelect(c.id)}
          style={{
            padding: "8px 10px",
            borderBottom: "1px solid #000",
            background: selected === c.id ? "#000" : "#fff",
            color: selected === c.id ? "#fff" : "#000",
            cursor: "pointer",
            fontFamily: "'Geneva', monospace",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {c.starred ? "⭐ " : "💬 "}
              {highlightMatch(c.title)}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{c.model}</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{c.date}</span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {c.tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 9,
                  border: selected === c.id ? "1px solid #fff" : "1px solid #000",
                  padding: "0 4px",
                  borderRadius: 2,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
      {conversations.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", fontFamily: "'Geneva', monospace", fontSize: 12, color: "#666" }}>
          No conversations found.
        </div>
      )}
    </div>
  );
}

function MessageView({ conversation }) {
  if (!conversation) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: "'Geneva', monospace" }}>
        <div style={{ textAlign: "center", color: "#666" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🖥️</div>
          <div style={{ fontSize: 13 }}>Select a conversation</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>from the list on the left</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Conversation header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "2px solid #000",
          background: "#f0f0f0",
          fontFamily: "'Geneva', monospace",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: "bold" }}>
          {conversation.starred ? "⭐ " : ""}{conversation.title}
        </div>
        <div style={{ fontSize: 10, marginTop: 2, display: "flex", gap: 12, opacity: 0.7 }}>
          <span>🤖 {conversation.model}</span>
          <span>📅 {conversation.date}</span>
          <span>💬 {conversation.messages.length} messages</span>
        </div>
      </div>

      {/* Messages */}
      <ClassicScrollbar style={{ height: "calc(100% - 52px)" }}>
        <div style={{ padding: 12 }}>
          {conversation.messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: 16,
                display: "flex",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "2px solid #000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                  background: msg.role === "user" ? "#fff" : "#000",
                  color: msg.role === "user" ? "#000" : "#fff",
                }}
              >
                {msg.role === "user" ? "👤" : "🤖"}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "'Geneva', monospace",
                    fontWeight: "bold",
                    marginBottom: 3,
                    textTransform: "uppercase",
                  }}
                >
                  {msg.role === "user" ? "You" : conversation.model}
                </div>
                <div
                  style={{
                    fontFamily: "'Geneva', monospace",
                    fontSize: 12,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    border: msg.role === "assistant" ? "1px solid #000" : "none",
                    padding: msg.role === "assistant" ? 10 : 0,
                    background: msg.role === "assistant" ? "#fafafa" : "transparent",
                  }}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ClassicScrollbar>
    </div>
  );
}

function StatusBar({ count, total, activeFilters }) {
  return (
    <div
      style={{
        borderTop: "2px solid #000",
        padding: "3px 10px",
        fontFamily: "'Geneva', monospace",
        fontSize: 10,
        display: "flex",
        justifyContent: "space-between",
        background: "#f0f0f0",
        flexShrink: 0,
      }}
    >
      <span>
        📂 {count} of {total} conversations
        {activeFilters > 0 && ` • ${activeFilters} filter${activeFilters > 1 ? "s" : ""} active`}
      </span>
      <span>🖥️ AI Chat Browser v1.0</span>
    </div>
  );
}

export default function App() {
  const [selectedId, setSelectedId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchState, setSearchState] = useState({
    query: "",
    selectedTags: [],
    selectedModels: [],
    dateFrom: "",
    dateTo: "",
    starredOnly: false,
    searchIn: "both",
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

  return (
    <div
      style={{
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
        boxSizing: "border-box",
      }}
    >
      {/* Import a pixel-style font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
        * { font-family: 'VT323', 'Geneva', 'Monaco', monospace !important; }
        ::-webkit-scrollbar { width: 16px; }
        ::-webkit-scrollbar-track { background: #fff; border-left: 2px solid #000; }
        ::-webkit-scrollbar-thumb { background: #888; border: 2px solid #000; }
        ::-webkit-scrollbar-button { background: #ccc; border: 2px solid #000; height: 16px; }
        ::selection { background: #000; color: #fff; }
        input:focus { outline: none; box-shadow: inset 0 0 0 1px #000; }
      `}</style>

      {/* Main Window */}
      <div
        style={{
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
          overflow: "hidden",
        }}
      >
        {/* Title Bar */}
        <TitleBar title="💾 AI Chat Conversation Browser" icon="" />

        {/* Menu Bar */}
        <div
          style={{
            borderBottom: "2px solid #000",
            padding: "2px 8px",
            display: "flex",
            gap: 16,
            fontFamily: "'Geneva', monospace",
            fontSize: 13,
            background: "#fff",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: "bold", cursor: "pointer" }}>📁 File</span>
          <span style={{ fontWeight: "bold", cursor: "pointer" }}>✏️ Edit</span>
          <span style={{ fontWeight: "bold", cursor: "pointer" }}>👁️ View</span>
          <span
            style={{ fontWeight: "bold", cursor: "pointer" }}
            onClick={() => setShowSearch(true)}
          >
            🔍 Search
          </span>
          <span style={{ fontWeight: "bold", cursor: "pointer" }}>❓ Help</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, opacity: 0.5 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>

        {/* Toolbar */}
        <div
          style={{
            borderBottom: "2px solid #000",
            padding: "5px 8px",
            display: "flex",
            gap: 6,
            alignItems: "center",
            background: "#f8f8f8",
          }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <input
              type="text"
              value={searchState.query}
              onChange={(e) => setSearchState((s) => ({ ...s, query: e.target.value }))}
              placeholder="🔍 Quick search…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "2px solid #000",
                padding: "4px 8px",
                fontFamily: "'Geneva', monospace",
                fontSize: 13,
                background: "#fff",
              }}
            />
          </div>
          <ClassicButton onClick={() => setShowSearch(true)}>
            🔍 Advanced
          </ClassicButton>
          <div style={{ width: 1, height: 20, background: "#000", margin: "0 4px" }} />
          <ClassicButton
            active={searchState.starredOnly}
            onClick={() => setSearchState((s) => ({ ...s, starredOnly: !s.starredOnly }))}
          >
            ⭐ Starred
          </ClassicButton>
          {activeFilters > 0 && (
            <ClassicButton
              small
              onClick={() =>
                setSearchState({
                  query: "",
                  selectedTags: [],
                  selectedModels: [],
                  dateFrom: "",
                  dateTo: "",
                  starredOnly: false,
                  searchIn: "both",
                })
              }
            >
              ✕ Clear ({activeFilters})
            </ClassicButton>
          )}
        </div>

        {/* Content Area */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Sidebar */}
          <div
            style={{
              width: 300,
              borderRight: "2px solid #000",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "4px 8px",
                borderBottom: "1px solid #000",
                background: "#e8e8e8",
                fontFamily: "'Geneva', monospace",
                fontSize: 11,
                fontWeight: "bold",
              }}
            >
              📋 Conversations ({filtered.length})
            </div>
            <ClassicScrollbar style={{ flex: 1 }}>
              <ConversationList
                conversations={filtered}
                selected={selectedId}
                onSelect={setSelectedId}
                searchState={searchState}
              />
            </ClassicScrollbar>
          </div>

          {/* Main Content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <ClassicScrollbar style={{ flex: 1 }}>
              <MessageView conversation={selectedConvo} />
            </ClassicScrollbar>
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar count={filtered.length} total={CONVERSATIONS.length} activeFilters={activeFilters} />

        {/* Advanced Search Panel */}
        {showSearch && (
          <>
            <div
              onClick={() => setShowSearch(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", zIndex: 99 }}
            />
            <SearchPanel searchState={searchState} setSearchState={setSearchState} onClose={() => setShowSearch(false)} />
          </>
        )}
      </div>
    </div>
  );
}
