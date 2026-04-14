import React from "react";
import Plot from "../Plot";

interface ForecastChartProps {
  traces: any[];
  selected: string[];
  results: Record<string, any>;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ traces, selected, results }) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
    {selected.some(n => results[n]?.is_split) && (
      <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
        <strong>Boundary change detected:</strong> {selected.filter(n => results[n]?.is_split).join(", ")}{" "}
        {selected.filter(n => results[n]?.is_split).length === 1 ? "was" : "were"} affected by
        neighbourhood boundary splits between census periods.
      </div>
    )}
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
      Population Forecast with 95% CI
    </div>
    <Plot
      data={traces}
      layout={{
        autosize: true,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        margin: { t: 10, b: 40, l: 50, r: 10 },
        xaxis: {
          title: { text: "Year" },
          color: "var(--text-muted)",
          gridcolor: "var(--border)",
        },
        yaxis: {
          title: { text: "Population" },
          color: "var(--text-muted)",
          gridcolor: "var(--border)",
        },
        legend: { font: { color: "var(--text)" }, bgcolor: "transparent" },
        font: { family: "DM Sans, sans-serif", color: "var(--text)" },
      }}
      style={{ width: "100%", height: 380 }}
    />
  </div>
);
