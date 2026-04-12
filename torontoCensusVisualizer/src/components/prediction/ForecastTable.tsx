import React from "react";
import { type ForecastResult } from "./types";

interface ForecastTableProps {
  selected: string[];
  forecastYears: number[];
  results: Record<string, ForecastResult>;
  usePermitCorrection: boolean;
  onModeChange: (usePermit: boolean) => void;
  colors: string[];
}

export const ForecastTable: React.FC<ForecastTableProps> = ({
  selected,
  forecastYears,
  results,
  usePermitCorrection,
  onModeChange,
  colors,
}) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Forecast Values
      </div>
      <div className="flex items-center gap-2">
        {["Permit + GP", "GP only"].map((label, i) => {
          const active = (i === 0) === usePermitCorrection;
          return (
            <button
              key={label}
              onClick={() => onModeChange(i === 0)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-alt)] text-[var(--text-muted)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>

    <div
      className="grid border-b border-[var(--border)] pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
      style={{ gridTemplateColumns: `2fr repeat(${forecastYears.length}, minmax(0, 1fr))` }}
    >
      <span>Neighbourhood</span>
      {forecastYears.map(y => (
        <span key={y}>{y}</span>
      ))}
    </div>

    {selected.map((neigh, ci) => {
      const r = results[neigh];
      if (!r || r.error) return null;
      const color = colors[ci % colors.length];
      return (
        <div
          key={neigh}
          className="grid border-b border-[var(--border)] py-3 text-sm"
          style={{ gridTemplateColumns: `2fr repeat(${forecastYears.length}, minmax(0, 1fr))` }}
        >
          <div className="font-semibold" style={{ color }}>
            {neigh}
          </div>
          {forecastYears.map(y => {
            const f = (usePermitCorrection ? r.forecast : r.forecast_gp_only)?.[y];
            return f ? (
              <div key={y}>
                <div className="text-[var(--text)]">{f.mean.toLocaleString()}</div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {f.lower.toLocaleString()}–{f.upper.toLocaleString()}
                </div>
              </div>
            ) : (
              <div key={y} className="text-[var(--text-muted)]">
                —
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
);
