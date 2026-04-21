import React from "react";
import Plot from "../Plot";
import { type ForecastResult } from "./types";

interface ShapPanelProps {
  shapTraces: any[];
  selected: string[];
  results: Record<string, ForecastResult>;
  activeShapNeigh: string | null;
  onSelect: (neigh: string) => void;
  colors: string[];
}

export const ShapPanel: React.FC<ShapPanelProps> = ({
  shapTraces,
  selected,
  results,
  activeShapNeigh,
  onSelect,
  colors,
}) => {
  const layout = React.useMemo(
    () => ({
      barmode: "relative",
      autosize: true,
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      margin: { t: 10, b: 40, l: 50, r: 10 },
      xaxis: { title: { text: "Year" }, color: "var(--text-muted)", gridcolor: "var(--border)" },
      yaxis: { title: { text: "SHAP value" }, color: "var(--text-muted)", gridcolor: "var(--border)" },
      legend: { font: { color: "var(--text)" }, bgcolor: "transparent" },
      font: { family: "DM Sans, sans-serif", color: "var(--text)" },
    }),
    []
  );
  const style = React.useMemo(() => ({ width: "100%", height: 260 }), []);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          SHAP Feature Importance
        </div>
        <div className="flex flex-wrap gap-2">
          {selected
            .filter(n => results[n]?.shap)
            .map((n, i) => {
              const active = activeShapNeigh === n;
              return (
                <button
                  key={n}
                  onClick={() => onSelect(n)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                    active ? "text-white" : "bg-[var(--surface-alt)] text-[var(--text-muted)]"
                  }`}
                  style={active ? { background: colors[i % colors.length] } : undefined}
                >
                  {n}
                </button>
              );
            })}
        </div>
      </div>
      <div className="mb-2 text-[11px] text-[var(--text-muted)]">
        Contribution of each feature to the prediction at each census year.
      </div>
      <Plot data={shapTraces} layout={layout} style={style} />
    </div>
  );
};
