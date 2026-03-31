// CensusPage.tsx
// Dashboard layout split into focused sub-components:
//   YearTabs        — year selector strip
//   CensusSearch    — search input for TopBar slot
//   ChartPanel      — map + bar + stacked comparison
//   StatsPanel      — biggest + change table + export
//   CensusPage      — composes everything, owns state

import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import { type Tokens } from "./colours";
import { useSearchSlot } from "./SearchSlotContext";

const API = "/api";

const PREV_YEAR: Record<number, number> = {
  2021: 2016, 2016: 2011, 2011: 2006, 2006: 2001, 2001: 2001,
};

// ── shared types ──────────────────────────────────────────────────────────────

export interface ChangeRow {
  neighbourhood: string;
  current:       number;
  prev:          number;
}

export interface BiggestItem {
  name: string;
  val:  number;
}

// ── shared helpers ────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v > 100
    ? v.toLocaleString("en-CA", { maximumFractionDigits: 0 })
    : v.toFixed(2);

// ── YearTabs ──────────────────────────────────────────────────────────────────

interface YearTabsProps {
  t:      Tokens;
  years:  number[];
  active: number;
  onSelect: (y: number) => void;
}

export const YearTabs: React.FC<YearTabsProps> = ({ t, years, active, onSelect }) => (
  <div style={{ display: "flex", gap: 4 }}>
    {years.map(y => (
      <button
        key={y}
        onClick={() => onSelect(y)}
        style={{
          padding: "5px 12px", borderRadius: "6px 6px 0 0", border: "none",
          background: y === active ? t.accent : "transparent",
          color:      y === active ? "#fff"   : t.textMuted,
          fontSize: 12, fontWeight: 500, cursor: "pointer",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        {y}
      </button>
    ))}
  </div>
);

// ── CensusSearch — injected into TopBar centreSlot ────────────────────────────

interface CensusSearchProps {
  t:           Tokens;
  year:        number;
  onSelect:    (row: number) => void;
}

export const CensusSearch: React.FC<CensusSearchProps> = ({ t, year, onSelect }) => {
  const [input, setInput]           = useState("");
  const [suggestions, setSuggestions] = useState<{ row_id: number; label: string; document?: string; year?: number }[]>([]);

  async function handleChange(q: string) {
    setInput(q);
    if (!q) { setSuggestions([]); return; }
    const d = await fetch(`${API}/census/${year}/semantic-search?q=${encodeURIComponent(q)}`).then(r => r.json());
    setSuggestions(d.results || []);
  }

  

  function submit() {
    const n = parseInt(input);
    if (!isNaN(n)) { onSelect(n); setInput(""); setSuggestions([]); }
    else if (suggestions.length > 0) { onSelect(suggestions[0].row_id); setInput(""); setSuggestions([]); }
  }
  return (
    <div style={{ position: "relative", display: "flex", gap: 6, alignItems: "center", width: "100%", maxWidth: 480 }}>
      <input
        value={input}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="Search census variable..."
        style={{
          flex: 1, padding: "6px 11px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.3)",
          background: "rgba(255,255,255,0.15)",
          color: "#fff", fontSize: 13, outline: "none",
          fontFamily: "inherit",
        }}
      />
      <button
        onClick={submit}
        style={{
          padding: "6px 12px", borderRadius: 8, border: "none",
          background: "rgba(255,255,255,0.2)", color: "#fff",
          cursor: "pointer", fontSize: 12, fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        Load
      </button>

{/* Suggestions dropdown */}
      {suggestions.length > 0 && (
  <ul style={{
    position: "absolute", top: "100%", left: 0, right: 0,
    zIndex: 50, listStyle: "none", padding: 0, margin: "4px 0 0",
    border: `1px solid ${t.border}`, borderRadius: 8,
    background: t.surface, boxShadow: t.shadowMd,
  }}>
    {suggestions.map(sg => (
      
      <li
        key={sg.row_id}
        onClick={() => { onSelect(sg.row_id); setInput(sg.label); setSuggestions([]); }}
        style={{
          padding: "8px 12px", cursor: "pointer", fontSize: 13,
          borderBottom: `1px solid ${t.border}`, color: t.text,
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <span style={{ color: t.textMuted, fontSize: 11, flexShrink: 0 }}>#{sg.row_id}</span>
        <span style={{ flex: 1 }}>{sg.label}</span>
        {"year" in sg && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 6px",
            borderRadius: 4, background: t.surfaceAlt,
            border: `1px solid ${t.border}`, color: t.textMuted,
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {(sg as any).year}
          </span>
        )}
      </li>
    ))}
  </ul>
)}


      
    </div>
  );
};

// ── ChartPanel ────────────────────────────────────────────────────────────────

interface ChartPanelProps {
  t:        Tokens;
  mapFig:   any;
  barFig:   any;
  loading:  boolean;
  year:     number;
  row:      number;
}

export const ChartPanel: React.FC<ChartPanelProps> = ({ t, mapFig, barFig, loading, year, row }) => {
  const [showStack, setShowStack]       = useState(false);
  const [stackRows, setStackRows]       = useState<number[]>([]);
  const [stackInput, setStackInput]     = useState("");
  const [stackFig, setStackFig]         = useState<any>(null);
  const [stackSugg, setStackSugg]       = useState<{ row: number; label: string }[]>([]);

  const card: React.CSSProperties = {
    background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: 10, padding: 16, boxShadow: t.shadow,
  };
  const cardLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
  };
  const field: React.CSSProperties = {
    padding: "7px 11px", borderRadius: 8,
    border: `1px solid ${t.border}`, background: t.surfaceAlt,
    color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit",
  };
  const btn: React.CSSProperties = {
    padding: "7px 14px", borderRadius: 8, border: "none",
    background: t.accent, color: "#fff", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  };

  async function addStack(r: number) {
    const next = [...stackRows, r];
    setStackRows(next); setStackInput(""); setStackSugg([]);
    const fig = await fetch(`${API}/census/${year}/stack`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: next }),
    }).then(r => r.json());
    setStackFig(fig);
  }

  async function removeStack(i: number) {
    const next = stackRows.filter((_, idx) => idx !== i);
    setStackRows(next);
    if (!next.length) { setStackFig(null); return; }
    const fig = await fetch(`${API}/census/${year}/stack`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: next }),
    }).then(r => r.json());
    setStackFig(fig);
  }

  async function searchStack(q: string) {
    setStackInput(q);
    if (!q || !isNaN(Number(q))) { setStackSugg([]); return; }
    const d = await fetch(`${API}/census/${year}/search?q=${encodeURIComponent(q)}`).then(r => r.json());
    setStackSugg(d.results || []);
  }

  return (
    <div style={{ flex: "0 0 60%", overflowY: "auto", padding: "16px 8px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      {loading && (
        <div style={{ color: t.textMuted, fontSize: 13, padding: 20, textAlign: "center" }}>Loading...</div>
      )}

      {mapFig && (
        <div style={card}>
            <Plot
              key={`${year}-${row}`}  
              data={mapFig.data}
              layout={{
                ...mapFig.layout, autosize: true,
                paper_bgcolor: "transparent", plot_bgcolor: "transparent",
                margin: { t: 10, b: 10, l: 10, r: 10 }, title: undefined,
              }}
              style={{ width: "100%", height: 300 }}
              useResizeHandler
            />
        </div>
      )}

      {barFig && (
        <div style={card}>
          <Plot
            data={barFig.data}
            layout={{ ...barFig.layout, autosize: true, paper_bgcolor: "transparent", plot_bgcolor: "transparent", margin: { t: 10, b: 60, l: 40, r: 10 }, title: undefined }}
            style={{ width: "100%", height: 260 }}
            useResizeHandler
          />
        </div>
      )}

      </div>
  );
};

// ── StatsPanel ────────────────────────────────────────────────────────────────

interface StatsPanelProps {
  t:          Tokens;
  biggest:    BiggestItem[];
  changeData: ChangeRow[];
  year:       number;
  prevYear:   number;
  row:        number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ t, biggest, changeData, year, prevYear, row }) => {
  const card: React.CSSProperties = {
    background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: 10, padding: 16, boxShadow: t.shadow,
  };
  const cardLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
  };
  const btn: React.CSSProperties = {
    padding: "7px 14px", borderRadius: 8, border: "none",
    background: t.accent, color: "#fff", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  };

  return (
    <div style={{ flex: "0 0 40%", overflowY: "auto", padding: "16px 16px 16px 8px", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Biggest */}
      <div style={card}>
        <div style={cardLabel}>Biggest by Neighbourhood</div>
        {biggest.length === 0
          ? <div style={{ color: t.textMuted, fontSize: 13 }}>Loading...</div>
          : biggest.map((b, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{b.name}</span>
              <span style={{ fontSize: 13, color: t.accent, fontWeight: 700 }}>{fmt(b.val)}</span>
            </div>
          ))
        }
      </div>

      {/* Change table */}
      <div style={card}>
        <div style={cardLabel}>Change by Neighbourhood</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 0 8px", borderBottom: `1px solid ${t.border}` }}>
          <span>Neighbourhood</span>
          <span>{year}</span>
          <span>{prevYear}</span>
        </div>
        {changeData.length === 0
          ? <div style={{ color: t.textMuted, fontSize: 12, paddingTop: 8 }}>{prevYear === year ? "No previous year." : "Loading..."}</div>
          : changeData.map((row, i) => {
            const pct = row.prev ? (row.current - row.prev) / row.prev * 100 : 0;
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "7px 0", borderBottom: `1px solid ${t.border}`, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: t.text, fontSize: 12 }}>{row.neighbourhood}</div>
                <div>
                  <div style={{ color: t.text }}>{fmt(row.current)}</div>
                  <div style={{ fontSize: 11, color: pct >= 0 ? "#22a366" : "#e05252", fontWeight: 500 }}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(0)}%
                  </div>
                </div>
                <div style={{ color: t.textMuted }}>{fmt(row.prev)}</div>
              </div>
            );
          })
        }
      </div>

      {/* Export */}
      <div style={card}>
        <div style={cardLabel}>Export</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={`${API}/census/${year}/row/${row}/export/map`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button style={btn}>Map PDF</button>
          </a>
          <a href={`${API}/census/${year}/row/${row}/export/bar`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button style={btn}>Bar PDF</button>
          </a>
        </div>
      </div>
    </div>
  );
};

// ── CensusPage ────────────────────────────────────────────────────────────────

interface CensusPageProps {
  t: Tokens;
}

export const CensusPage: React.FC<CensusPageProps> = ({ t }) => {
  const { setSlot } = useSearchSlot();
  const [availableYears, setAvailableYears] = useState<number[]>([2021]);
  const [year, setYear]       = useState(2021);
  const [row, setRow]         = useState(37);
  const [mapFig, setMapFig]   = useState<any>(null);
  const [barFig, setBarFig]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle]     = useState("");
  const [changeData, setChangeData] = useState<ChangeRow[]>([]);
  const [biggest, setBiggest] = useState<BiggestItem[]>([]);

  // Load years
  useEffect(() => {
    fetch(`${API}/years`).then(r => r.json()).then(d => {
      setAvailableYears(d.years);
      if (d.years.length) setYear(d.years[0]);
    });
  }, []);

  // Load figures + change data
  useEffect(() => {
  setLoading(true);
  setBiggest([]);
  setChangeData([]);
  const prevYear = PREV_YEAR[year] ?? year;
  Promise.all([
    fetch(`${API}/census/${year}/row/${row}/map`).then(r => r.json()),
    fetch(`${API}/census/${year}/row/${row}/bar`).then(r => r.json()),
    prevYear !== year
      ? fetch(`${API}/census/${year}/row/${row}/compare/${prevYear}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      : Promise.resolve(null),
  ]).then(([map, bar, compareData]) => {
    setMapFig(map);
    setBarFig(bar);
    if (bar?.layout?.title?.text) setTitle(bar.layout.title.text);

    if (bar?.data?.[0]) {
      setBiggest(
        (bar.data[0].x as string[])
          .map((n: string, i: number) => ({ name: n, val: bar.data[0].y[i] as number }))
          .filter(x => x.val && x.val > 0)
          .sort((a, b) => b.val - a.val)
          .slice(0, 2)
      );
    }

    if (compareData?.data) {
      setChangeData(
        Object.entries(compareData.data)
          .map(([n, v]: [string, any]) => ({
            neighbourhood: n,
            current:       v.current,
            prev:          v.prev,
            mapping:       compareData.mapping?.[n] ?? undefined,
          }))
          .filter(r => r.current && r.prev)
          .sort((a, b) => Math.abs(b.current - b.prev) - Math.abs(a.current - a.prev))
          .slice(0, 8)
      );
    }
  }).finally(() => setLoading(false));
}, [year, row]);

  // Inject search into TopBar via context — clean on unmount
  useEffect(() => {
    setSlot(<CensusSearch t={t} year={year} onSelect={setRow} />);
    return () => setSlot(null);
  }, [t, year]);

  const prevYear = PREV_YEAR[year] ?? year;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: t.bg, overflow: "hidden" }}>

      {/* Year tabs + title */}
      <div style={{ padding: "12px 16px 0", background: t.surface, borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        {title && (
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 8 }}>{title}</div>
        )}
        <YearTabs t={t} years={availableYears} active={year} onSelect={setYear} />
      </div>

      {/* Two-column body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <ChartPanel t={t} mapFig={mapFig} barFig={barFig} loading={loading} year={year} row={row} />
        <StatsPanel t={t} biggest={biggest} changeData={changeData} year={year} prevYear={prevYear} row={row} />
      </div>

    </div>
  );
};