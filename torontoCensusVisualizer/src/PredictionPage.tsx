import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import { type Tokens } from "./colours";
import { useSearchSlot } from "./SearchSlotContext";

const API = "/api";

interface ForecastResult {
  neighbourhood: string;
  historical:    Record<number, number>;
  forecast:      Record<number, { mean: number; lower: number; upper: number }>;
  gp_full:       { years: number[]; mean: number[]; lower: number[]; upper: number[] };
  shap:          { features: string[]; years: number[]; values: Record<string, number>[] };
  error?:        string;
}

interface PredictionPageProps {
  t: Tokens;
}

export const PredictionPage: React.FC<PredictionPageProps> = ({ t }) => {
  const { setSlot }   = useSearchSlot();
  const [neighbourhoods, setNeighbourhoods]   = useState<string[]>([]);
  const [selected, setSelected]               = useState<string[]>([]);
  const [searchInput, setSearchInput]         = useState("");
  const [results, setResults]                 = useState<Record<string, ForecastResult>>({});
  const [loading, setLoading]                 = useState(false);
  const [forecastYears, setForecastYears]     = useState([2026, 2031]);

  const card: React.CSSProperties = {
    background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: 10, padding: 16, boxShadow: t.shadow,
  };
  const cardLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
  };

  useEffect(() => {
    fetch(`${API}/predict/neighbourhoods`)
      .then(r => r.json())
      .then(d => setNeighbourhoods(d.neighbourhoods));
    setSlot(null);
    return () => setSlot(null);
  }, []);

  async function runForecast() {
    if (!selected.length) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/predict/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ neighbourhoods: selected, years: forecastYears }),
      }).then(r => r.json());
      setResults(res);
    } finally {
      setLoading(false);
    }
  }

  const filtered = neighbourhoods.filter(n =>
    n.toLowerCase().includes(searchInput.toLowerCase()) && !selected.includes(n)
  );

  // Build Plotly traces for all selected neighbourhoods
  const traces: any[] = [];
  const COLORS = ["#4C9BE8", "#E8834C", "#4CE87A", "#E84C4C", "#B44CE8"];

  selected.forEach((neigh, ci) => {
    const r = results[neigh];
    if (!r || r.error) return;
    const color = COLORS[ci % COLORS.length];

    // Historical points
    const histYears  = Object.keys(r.historical).map(Number).sort();
    const histValues = histYears.map(y => r.historical[y]);

    traces.push({
      x: histYears, y: histValues,
      mode: "markers+lines", name: `${neigh} (historical)`,
      line: { color, width: 2 },
      marker: { size: 6, color },
    });

    // GP mean line (includes forecast)
    traces.push({
      x: r.gp_full.years, y: r.gp_full.mean,
      mode: "lines", name: `${neigh} (forecast)`,
      line: { color, width: 2, dash: "dot" },
    });

    // Confidence band
    traces.push({
      x: [...r.gp_full.years, ...r.gp_full.years.slice().reverse()],
      y: [...r.gp_full.upper, ...r.gp_full.lower.slice().reverse()],
      fill: "toself", fillcolor: color.replace(")", ", 0.1)").replace("rgb", "rgba"),
      line: { color: "transparent" },
      name: `${neigh} 95% CI`,
      showlegend: false, type: "scatter",
    });
  });

  // SHAP bar for first selected neighbourhood
  const shap = selected[0] && results[selected[0]]?.shap;
  const shapTraces: any[] = shap ? shap.features.map(f => ({
    x: shap.years,
    y: shap.values.map(v => v[f]),
    type: "bar", name: f,
  })) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: t.bg, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", background: t.surface, borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Population Forecast</div>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Gaussian Process model with SHAP explanations</div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: 0 }}>
        {/* Left panel — neighbourhood selector */}
        <div style={{ width: 260, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", padding: 12, gap: 8, flexShrink: 0 }}>
          <div style={cardLabel}>Select Neighbourhoods</div>

          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search..."
            style={{
              padding: "6px 10px", borderRadius: 6,
              border: `1px solid ${t.border}`, background: t.surfaceAlt,
              color: t.text, fontSize: 12, outline: "none", fontFamily: "inherit",
            }}
          />

          {/* Suggestions */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.slice(0, 20).map(n => (
              <div
                key={n}
                onMouseDown={e => {
                    e.preventDefault();
                    setSelected(s => [...s, n]);
                    setSearchInput("");
                }}
                style={{
                    padding: "5px 8px", borderRadius: 5, cursor: "pointer",
                    fontSize: 11, color: t.text, background: t.surfaceAlt,
                    border: `1px solid ${t.border}`,
                }}
                >
                {n}
                </div>
            ))}
          </div>

          {/* Selected tags */}
          {selected.length > 0 && (
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
              <div style={{ ...cardLabel, marginBottom: 6 }}>Selected</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {selected.map((n, i) => (
                  <div key={n} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "4px 8px", borderRadius: 5, fontSize: 11,
                    background: COLORS[i % COLORS.length] + "22",
                    border: `1px solid ${COLORS[i % COLORS.length]}44`,
                    color: t.text,
                  }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>
                    <span
                      onClick={() => setSelected(s => s.filter(x => x !== n))}
                      style={{ cursor: "pointer", color: t.textMuted, marginLeft: 6, flexShrink: 0 }}
                    >×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forecast horizon */}
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
            <div style={cardLabel}>Forecast to</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[2026, 2031, 2036].map(y => (
                <button
                  key={y}
                  onClick={() => setForecastYears(
                    forecastYears.includes(y)
                      ? forecastYears.filter(x => x !== y)
                      : [...forecastYears, y]
                  )}
                  style={{
                    padding: "4px 8px", borderRadius: 5, border: "none",
                    background: forecastYears.includes(y) ? t.accent : t.surfaceAlt,
                    color: forecastYears.includes(y) ? "#fff" : t.textMuted,
                    fontSize: 11, cursor: "pointer",
                  }}
                >{y}</button>
              ))}
            </div>
          </div>

          <button
            onClick={runForecast}
            disabled={!selected.length || loading}
            style={{
              padding: "8px 0", borderRadius: 7, border: "none",
              background: selected.length ? t.accent : t.surfaceAlt,
              color: selected.length ? "#fff" : t.textMuted,
              fontSize: 12, fontWeight: 600, cursor: selected.length ? "pointer" : "default",
            }}
          >
            {loading ? "Running..." : "Run Forecast"}
          </button>
        </div>

        {/* Right panel — charts */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {traces.length === 0 && !loading && (
            <div style={{ color: t.textMuted, fontSize: 13, textAlign: "center", marginTop: 60 }}>
              Select neighbourhoods and click Run Forecast
            </div>
          )}

          {loading && (
            <div style={{ color: t.textMuted, fontSize: 13, textAlign: "center", marginTop: 60 }}>
              Fitting GP models...
            </div>
          )}

          {traces.length > 0 && (
            <div style={card}>
              <div style={cardLabel}>Population Forecast with 95% Confidence Interval</div>
              <Plot
                data={traces}
                layout={{
                  autosize: true,
                  paper_bgcolor: "transparent", plot_bgcolor: "transparent",
                  margin: { t: 10, b: 40, l: 50, r: 10 },
                  xaxis: { title: "Year", color: t.textMuted, gridcolor: t.border },
                  yaxis: { title: "Population", color: t.textMuted, gridcolor: t.border },
                  legend: { font: { color: t.text }, bgcolor: "transparent" },
                  font: { family: "proxima-nova, sans-serif", color: t.text },
                }}
                style={{ width: "100%", height: 380 }}
                useResizeHandler
              />
            </div>
          )}

          {/* Forecast table */}
          {Object.keys(results).length > 0 && (
            <div style={card}>
              <div style={cardLabel}>Forecast Values</div>
              <div style={{ display: "grid", gridTemplateColumns: `2fr ${forecastYears.map(() => "1fr").join(" ")}`, fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", padding: "4px 0 8px", borderBottom: `1px solid ${t.border}` }}>
                <span>Neighbourhood</span>
                {forecastYears.map(y => <span key={y}>{y}</span>)}
              </div>
              {selected.map((neigh, ci) => {
                const r = results[neigh];
                if (!r || r.error) return null;
                return (
                  <div key={neigh} style={{ display: "grid", gridTemplateColumns: `2fr ${forecastYears.map(() => "1fr").join(" ")}`, padding: "7px 0", borderBottom: `1px solid ${t.border}`, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: COLORS[ci % COLORS.length] }}>{neigh}</div>
                    {forecastYears.map(y => {
                      const f = r.forecast[y];
                      return f ? (
                        <div key={y}>
                          <div style={{ color: t.text }}>{f.mean.toLocaleString()}</div>
                          <div style={{ fontSize: 10, color: t.textMuted }}>{f.lower.toLocaleString()}–{f.upper.toLocaleString()}</div>
                        </div>
                      ) : <div key={y} style={{ color: t.textMuted }}>—</div>;
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* SHAP explanation */}
          {shapTraces.length > 0 && (
            <div style={card}>
              <div style={cardLabel}>SHAP Feature Importance — {selected[0]}</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>
                How much each feature contributed to the population prediction at each census year
              </div>
              <Plot
                data={shapTraces}
                layout={{
                  barmode: "relative",
                  autosize: true,
                  paper_bgcolor: "transparent", plot_bgcolor: "transparent",
                  margin: { t: 10, b: 40, l: 50, r: 10 },
                  xaxis: { title: "Year", color: t.textMuted, gridcolor: t.border },
                  yaxis: { title: "SHAP value", color: t.textMuted, gridcolor: t.border },
                  legend: { font: { color: t.text }, bgcolor: "transparent" },
                  font: { family: "proxima-nova, sans-serif", color: t.text },
                }}
                style={{ width: "100%", height: 260 }}
                useResizeHandler
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};