import { useState, useEffect } from "react";
import Plot from "react-plotly.js";

const API = "/api";

export default function App() {
  const [year, setYear]       = useState(2021);
  const [years, setYears]     = useState([2021]);
  const [row, setRow]         = useState(37);
  const [input, setInput]     = useState("37");
const [suggestions, setSuggestions] = useState<{row: number, label: string}[]>([]);
const [stackSuggestions, setStackSuggestions] = useState<{row: number, label: string}[]>([]);
  const [mapFig, setMapFig] = useState<any>(null);
  const [barFig, setBarFig] = useState<any>(null);
  const [stackFig, setStackFig] = useState<any>(null);
const [stackRows, setStackRows] = useState<number[]>([]);
  const [stackInput, setStackInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [question, setQuestion]   = useState("");
const [qaAnswer, setQaAnswer]   = useState<string | null>(null);
const [qaLoading, setQaLoading] = useState(false)

async function handleAsk() {
  if (!question.trim()) return;
  setQaLoading(true);
  setQaAnswer(null);
  try {
    const d = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }).then(r => r.json());
    setQaAnswer(d.answer || "No answer returned.");
  } catch {
    setQaAnswer("Error contacting the server.");
  } finally {
    setQaLoading(false);
  }
}


  // Load available years on mount
  useEffect(() => {
    fetch(`${API}/years`)
      .then(r => r.json())
      .then(d => setYears(d.years));
  }, []);

  // Fetch map + bar whenever year or row changes
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/census/${year}/row/${row}/map`).then(r => r.json()),
      fetch(`${API}/census/${year}/row/${row}/bar`).then(r => r.json()),
    ]).then(([map, bar]) => {
      setMapFig(map);
      setBarFig(bar);
    }).finally(() => setLoading(false));
  }, [year, row]);

  // Search suggestions for single var
  async function handleSearch(q: string) {
      setInput(q);
      if (!q) { setSuggestions([]); return; }
      const d = await fetch(
          `${API}/census/${year}/semantic-search?q=${encodeURIComponent(q)}`
      ).then(r => r.json());
      setSuggestions(d.results || []);
  }
  function submitRow() {
    const n = parseInt(input);
    if (!isNaN(n)) { setRow(n); setSuggestions([]); }
  }

  // Stack chart
  async function addStackRow(r: number) {
    const next = [...stackRows, r];
    setStackRows(next);
    setStackInput("");
    setStackSuggestions([]);
    const fig = await fetch(`${API}/census/${year}/stack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: next }),
    }).then(r => r.json());
    setStackFig(fig);
  }

  async function removeStackRow(i: number) {
    const next = stackRows.filter((_, idx) => idx !== i);
    setStackRows(next);
    if (next.length === 0) { setStackFig(null); return; }
    const fig = await fetch(`${API}/census/${year}/stack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: next }),
    }).then(r => r.json());
    setStackFig(fig);
  }

  async function handleStackSearch(q : any) {
    setStackInput(q);
    if (!q || !isNaN(q)) { setStackSuggestions([]); return; }
    const d = await fetch(`${API}/census/${year}/search?q=${encodeURIComponent(q)}`).then(r => r.json());
    setStackSuggestions(d.results || []);
  }

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>

      {/* Year selector */}
      <div>
        <label>Year: </label>
        <select value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

<div style={{ marginBottom: 16, padding: 12, border: "1px solid #ccc", borderRadius: 4 }}>
  <label><strong>Ask a question:</strong></label>
  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
    <input
      style={{ flex: 1, padding: "6px 8px" }}
      value={question}
      onChange={e => setQuestion(e.target.value)}
      onKeyDown={e => e.key === "Enter" && handleAsk()}
      placeholder="e.g. What was the population of Annex in 2011?"
    />
    <button onClick={handleAsk} disabled={qaLoading}>
      {qaLoading ? "Thinking..." : "Ask"}
    </button>
  </div>
  {qaAnswer && (
    <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 8, borderRadius: 4 }}>
      {qaAnswer}
    </pre>
  )}
</div>

      <br />

      {/* Row search */}
      <div>
        <label>Row: </label>
        <input
          value={input}
          onChange={e => handleSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submitRow()}
          placeholder="Row number or name..."
        />
        <button onClick={submitRow}>Load</button>

        {suggestions.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, border: "1px solid #ccc", width: 300 }}>
            {suggestions.map(s => (
              <li key={s.row}
                style={{ padding: "4px 8px", cursor: "pointer" }}
                onClick={() => { setInput(String(s.row)); setSuggestions([]); setRow(s.row); }}>
                Row {s.row} — {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <br />

      {/* Export buttons */}
      <div>
        <a href={`${API}/census/${year}/row/${row}/export/map`} target="_blank" rel="noreferrer">
          <button>Export map PDF</button>
        </a>
        {" "}
        <a href={`${API}/census/${year}/row/${row}/export/bar`} target="_blank" rel="noreferrer">
          <button>Export bar PDF</button>
        </a>
      </div>

      <br />


      {/* Map */}
      
      {loading && <p>Loading...</p>}
      {mapFig && (
        <div className="w-screen" >
  <Plot
    key={JSON.stringify(mapFig.layout.title)} 
    data={mapFig.data}
    layout={{ ...mapFig.layout, autosize: true }}
    style={{ width: "100%", height: "600px" }}
    useResizeHandler
  />
        </div>
      )}

      {/* Bar */}
      {barFig && (
        <Plot
          data={barFig.data}
          layout={{ ...barFig.layout, autosize: true }}
          style={{ width: "100%", height: 500 }}
          useResizeHandler
        />
      )}

      <hr />

      {/* Stack section */}
      <h3>Stacked comparison</h3>
      <div>
        <input
          value={stackInput}
          onChange={e => handleStackSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !isNaN(Number(stackInput)) && stackInput) addStackRow(parseInt(stackInput)); }}
          placeholder="Row number or name..."
        />
        <button onClick={() => { if (!isNaN(Number(stackInput)) && stackInput) addStackRow(parseInt(stackInput)); }}>
          Add
        </button>

        {stackSuggestions.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, border: "1px solid #ccc", width: 300 }}>
            {stackSuggestions.map(s => (
              <li key={s.row}
                style={{ padding: "4px 8px", cursor: "pointer" }}
                onClick={() => addStackRow(s.row)}>
                Row {s.row} — {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        {stackRows.map((r, i) => (
          <button key={i} onClick={() => removeStackRow(i)} style={{ marginRight: 4 }}>
            Row {r} ✕
          </button>
        ))}
      </div>

      {stackFig && (
        <Plot
          data={stackFig.data}
          layout={{ ...stackFig.layout, autosize: true }}
          style={{ width: "100%", height: 500 }}
          useResizeHandler
        />
      )}

    </div>
  );
}