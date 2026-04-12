import React from "react";
import Plot from "react-plotly.js";

interface ChartPanelProps {
  mapFig: any;
  barFig: any;
  loading: boolean;
  year: number;
  row: number;
}

export const ChartPanel: React.FC<ChartPanelProps> = ({ mapFig, barFig, loading, year, row }) => {
  const cardClass =
    "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]";

  return (
    <div className="flex basis-[60%] flex-col gap-3 overflow-y-auto px-4 pb-4 pt-4 pr-2">
      {loading && (
        <div className="py-5 text-center text-xs font-medium text-[var(--text-muted)]">Loading…</div>
      )}

      {mapFig && (
        <div className={cardClass}>
          <Plot
            key={`${year}-${row}`}
            data={mapFig.data}
            layout={{
              ...mapFig.layout,
              autosize: true,
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              margin: { t: 10, b: 10, l: 10, r: 10 },
              title: undefined,
            }}
            style={{ width: "100%", height: 300 }}
            useResizeHandler
          />
        </div>
      )}

      {barFig && (
        <div className={cardClass}>
          <Plot
            data={barFig.data}
            layout={{
              ...barFig.layout,
              autosize: true,
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              margin: { t: 10, b: 60, l: 40, r: 10 },
              title: undefined,
            }}
            style={{ width: "100%", height: 260 }}
            useResizeHandler
          />
        </div>
      )}
    </div>
  );
};
