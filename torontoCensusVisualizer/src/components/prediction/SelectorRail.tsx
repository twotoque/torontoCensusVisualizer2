import React from "react";

interface SelectorRailProps {
  suggestions: string[];
  selected: string[];
  searchInput: string;
  onSearchChange: (val: string) => void;
  onSelect: (name: string) => void;
  onRemove: (name: string) => void;
  forecastYears: number[];
  onToggleYear: (year: number) => void;
  onRun: () => void;
  loading: boolean;
  colors: string[];
}

export const SelectorRail: React.FC<SelectorRailProps> = ({
  suggestions,
  selected,
  searchInput,
  onSearchChange,
  onSelect,
  onRemove,
  forecastYears,
  onToggleYear,
  onRun,
  loading,
  colors,
}) => (
  <div className="flex w-64 flex-shrink-0 flex-col gap-3 border-r border-[var(--border)] bg-[var(--surface)] p-3">
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
      Select Neighbourhoods
    </div>
    <input
      value={searchInput}
      onChange={e => onSearchChange(e.target.value)}
      placeholder="Search..."
      className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
    />
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
      {suggestions.slice(0, 20).map(n => (
        <button
          key={n}
          onMouseDown={e => {
            e.preventDefault();
            onSelect(n);
          }}
          className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-left text-[11px] font-medium text-[var(--text)] transition hover:bg-[var(--surface)]"
        >
          {n}
        </button>
      ))}
    </div>

    {selected.length > 0 && (
      <div className="border-t border-[var(--border)] pt-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Selected
        </div>
        <div className="flex flex-col gap-2">
          {selected.map((n, i) => (
            <div
              key={n}
              className="flex items-center justify-between rounded-md px-2 py-1 text-[11px]"
              style={{
                background: `${colors[i % colors.length]}22`,
                border: `1px solid ${colors[i % colors.length]}55`,
                color: colors[i % colors.length],
              }}
            >
              <span className="flex-1 truncate">{n}</span>
              <button
                onClick={() => onRemove(n)}
                className="ml-2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="border-t border-[var(--border)] pt-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Forecast to
      </div>
      <div className="mt-2 flex gap-2">
        {[2026, 2031, 2036].map(y => {
          const active = forecastYears.includes(y);
          return (
            <button
              key={y}
              onClick={() => onToggleYear(y)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-alt)] text-[var(--text-muted)]"
              }`}
            >
              {y}
            </button>
          );
        })}
      </div>
    </div>

    <button
      onClick={onRun}
      disabled={!selected.length || loading}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
        selected.length
          ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
          : "cursor-not-allowed bg-[var(--surface-alt)] text-[var(--text-muted)]"
      }`}
    >
      {loading ? "Running..." : "Run Forecast"}
    </button>
  </div>
);
