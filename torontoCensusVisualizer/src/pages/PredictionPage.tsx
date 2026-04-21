import React, { useState, useEffect } from "react";
import { useSearchSlot } from "../SearchSlotContext";
import { SelectorRail } from "../components/prediction/SelectorRail";
import { ForecastChart } from "../components/prediction/ForecastChart";
import { ForecastTable } from "../components/prediction/ForecastTable";
import { ShapPanel } from "../components/prediction/ShapPanel";
import { PREDICTION_COLORS } from "../components/prediction/constants";
import { type ForecastResult } from "../components/prediction/types";

const API = "/api";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const PredictionPage: React.FC = () => {
  const { setSlot } = useSearchSlot();
  const [neighbourhoods, setNeighbourhoods] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<Record<string, ForecastResult>>({});
  const [loading, setLoading] = useState(false);
  const [forecastYears, setForecastYears] = useState([2026, 2031]);
  const [shapNeigh, setShapNeigh] = useState<string | null>(null);
  const [usePermitCorrection, setUsePermitCorrection] = useState(true);

  useEffect(() => {
    fetch(`${API}/predict/neighbourhoods`)
      .then(r => r.json())
      .then(d => setNeighbourhoods(d.neighbourhoods));
    setSlot(null);
    return () => setSlot(null);
  }, []);

  useEffect(() => {
    if (selected.length > 0 && !shapNeigh) {
      setShapNeigh(selected[0]);
    }
  }, [results, selected, shapNeigh]);

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

  const filtered = neighbourhoods.filter(
    n => n.toLowerCase().includes(searchInput.toLowerCase()) && !selected.includes(n)
  );

  function handleSelectNeighbourhood(name: string) {
    setSelected(prev => (prev.includes(name) ? prev : [...prev, name]));
    setSearchInput("");
  }

  function handleRemoveNeighbourhood(name: string) {
    setSelected(prev => prev.filter(n => n !== name));
  }

  function handleToggleForecastYear(year: number) {
    setForecastYears(prev => (prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]));
  }

  const COLORS = PREDICTION_COLORS;

  const traces = React.useMemo(() => {
    const nextTraces: any[] = [];

    selected.forEach((neigh, ci) => {
      const r = results[neigh];
      if (!r || r.error) return;
      const color = COLORS[ci % COLORS.length];
      const histYears = Object.keys(r.historical).map(Number).sort();
      const histValues = histYears.map(y => r.historical[y]);

      if (r.is_split) {
        const preYears = histYears.filter(y => y < 2021);
        const preValues = preYears.map(y => r.historical[y]);
        nextTraces.push({
          x: preYears,
          y: preValues,
          mode: "lines+markers",
          name: `${neigh} (pre-split)`,
          line: { color, width: 1.5, dash: "dot" },
          marker: { size: 4, color },
          opacity: 0.4,
        });

        const postYears = histYears.filter(y => y >= 2021);
        const postValues = postYears.map(y => r.historical[y]);
        nextTraces.push({
          x: postYears,
          y: postValues,
          mode: "markers+lines",
          name: `${neigh} (historical)`,
          line: { color, width: 2 },
          marker: { size: 6, color },
        });

        if (r.predecessor_series) {
          Object.entries(r.predecessor_series).forEach(([predName, pred]: [string, any]) => {
            const predYears = Object.keys(pred.historical)
              .map(Number)
              .sort()
              .filter(y => y <= 2021);
            const predValues = predYears.map(y => pred.historical[y]);
            const pct = Math.round(pred.weight * 100);
            const sourceName = r.predecessors?.find((p: any) => p.name === predName)?.source_neighbourhood;
            const label = sourceName
              ? `${predName} (formed from ${sourceName}, ${pct}%)`
              : `${predName} (${pct}%)`;
            nextTraces.push({
              x: predYears,
              y: predValues,
              mode: "lines+markers",
              name: label,
              line: { color, width: 1.5, dash: "dashdot" },
              marker: { size: 4, symbol: "diamond", color },
              opacity: 0.6,
            });
          });
        }
      } else {
        nextTraces.push({
          x: histYears,
          y: histValues,
          mode: "markers+lines",
          name: `${neigh} (historical)`,
          line: { color, width: 2 },
          marker: { size: 6, color },
        });
      }

      nextTraces.push({
        x: r.gp_full.years,
        y: r.gp_full.mean,
        mode: "lines",
        name: `${neigh} (forecast)`,
        line: { color, width: 2, dash: "dot" },
      });

      nextTraces.push({
        x: [...r.gp_full.years, ...r.gp_full.years.slice().reverse()],
        y: [...r.gp_full.upper, ...r.gp_full.lower.slice().reverse()],
        fill: "toself",
        fillcolor: hexToRgba(color, 0.1),
        line: { color: "transparent" },
        name: `${neigh} 95% CI`,
        showlegend: false,
        type: "scatter",
      });
    });

    return nextTraces;
  }, [COLORS, selected, results]);

  const activeShapNeigh = shapNeigh ?? selected[0];
  const shapTraces = React.useMemo(() => {
    const shap = activeShapNeigh && results[activeShapNeigh]?.shap;
    return shap
      ? shap.features.map((f: string) => ({
          x: shap.years,
          y: shap.values.map((v: any) => v[f]),
          type: "bar",
          name: f,
        }))
      : [];
  }, [activeShapNeigh, results]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="text-base font-semibold">Population Prediction</div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          Gaussian Process model with SHAP explanations. Treat results as experimental.
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <SelectorRail
          suggestions={filtered}
          selected={selected}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onSelect={handleSelectNeighbourhood}
          onRemove={handleRemoveNeighbourhood}
          forecastYears={forecastYears}
          onToggleYear={handleToggleForecastYear}
          onRun={runForecast}
          loading={loading}
          colors={COLORS}
        />

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {traces.length === 0 && !loading && (
            <div className="mt-12 text-center text-sm text-[var(--text-muted)]">
              Select neighbourhoods and click Run Forecast.
            </div>
          )}

          {loading && (
            <div className="mt-12 text-center text-sm text-[var(--text-muted)]">
              Fitting GP models…
            </div>
          )}

          {traces.length > 0 && (
            <ForecastChart traces={traces} selected={selected} results={results} />
          )}

          {Object.keys(results).length > 0 && (
            <ForecastTable
              selected={selected}
              forecastYears={forecastYears}
              results={results}
              usePermitCorrection={usePermitCorrection}
              onModeChange={setUsePermitCorrection}
              colors={COLORS}
            />
          )}

          {shapTraces.length > 0 && (
            <ShapPanel
              shapTraces={shapTraces}
              selected={selected}
              results={results}
              activeShapNeigh={activeShapNeigh}
              onSelect={setShapNeigh}
              colors={COLORS}
            />
          )}
        </div>
      </div>
    </div>
  );
};
