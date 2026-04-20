import React, { useState, useEffect } from "react";
import { formatMetric, type ChangeRow } from "./types";
import { Spinner } from "../Spinner";

interface StatsPanelProps {
  changeData: ChangeRow[];
  year: number;
  prevYear: number;
  row: number;
  matchScore: number | null;
  prevLabel: string;
  apiBase?: string;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  changeData,
  year,
  prevYear,
  row,
  matchScore,
  prevLabel,
  apiBase = "/api",
}) => {
  const [sortBy, setSortBy] = useState<"alpha" | "highest" | "lowest" | "changeHigh" | "changeLow">(
    "changeHigh"
  );
  const [neighSearch, setNeighSearch] = useState("");
  const [showLimit, setShowLimit] = useState(10);
  const [cityMedian, setCityMedian] = useState<number | null>(null);

  // Fetch city median from API
  useEffect(() => {
    setCityMedian(null);
    fetch(`${apiBase}/census/${year}/row/${row}/median`)
      .then(r => r.json())
      .then(d => setCityMedian(d.median ?? null))
      .catch(() => setCityMedian(null));
  }, [year, row, apiBase]);

  const sortedChangeData = [...changeData]
    .filter(r => r.neighbourhood.toLowerCase().includes(neighSearch.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case "alpha":
          return a.neighbourhood.localeCompare(b.neighbourhood);
        case "highest":
          return b.current - a.current;
        case "lowest":
          return a.current - b.current;
        case "changeHigh":
          return Math.abs(b.current - b.prev) - Math.abs(a.current - a.prev);
        case "changeLow":
          return Math.abs(a.current - a.prev) - Math.abs(b.current - b.prev);
        default:
          return 0;
      }
    });

  const cardClass =
    "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]";
  const labelClass =
    "text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]";

  return (
    <div className="flex basis-[40%] flex-col gap-3 overflow-y-auto px-4 pb-4 pt-4 pl-2">
    
      
      <div className={cardClass}>
        <div className={labelClass}>City of Toronto Median</div>
        {cityMedian === null ? (
          
          <div className="flex h-[300px] items-center justify-center">
                <Spinner />
              </div>
        ) : (
          <div className="flex items-baseline justify-between border-b border-dashed border-[var(--border)] py-2 last:border-b-0">
            <span className="text-sm font-semibold text-[var(--text)]">Median</span>
            <span className="text-sm font-bold text-[var(--accent)]">{formatMetric(cityMedian)}</span>
          </div>
        )}
      </div>

      <div className={cardClass}>
        <div className={labelClass}>Change by Neighbourhood</div>

        {prevLabel && (
          <div className="mb-3 flex flex-col gap-1 border-b border-[var(--border)] pb-2 text-[11px] text-[var(--text-muted)]">
            <span className="pt-3 text-[var(--text)] font-semibold">Comparing against {prevYear}:</span>
            <span className="italic">{prevLabel}</span>
            {matchScore !== null && (
              <span
                className={`text-[10px] font-semibold ${
                  matchScore >= 0.7 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {matchScore >= 0.7 ? "✓" : "⚠"} {(matchScore * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
        )}

        <div className="mb-2 flex flex-wrap gap-2">
          <input
            value={neighSearch}
            onChange={e => setNeighSearch(e.target.value)}
            placeholder="Search neighbourhood..."
            className="min-w-[120px] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-[11px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-[11px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="changeHigh">Biggest change</option>
            <option value="changeLow">Smallest change</option>
            <option value="highest">Highest value</option>
            <option value="lowest">Lowest value</option>
            <option value="alpha">A → Z</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-x-2 border-b border-[var(--border)] pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          <span>Neighbourhood</span>
          <span>{year}</span>
          <span>{prevYear}</span>
        </div>

        {sortedChangeData.length === 0 ? (
          <div className="pt-3 text-xs text-[var(--text-muted)]">
            {prevYear === year ? "No previous year." : neighSearch ? "No matches." : "Loading..."}
          </div>
        ) : (
          <>
            {sortedChangeData.slice(0, showLimit).map((rowData, i) => {
              const pct = rowData.prev ? ((rowData.current - rowData.prev) / rowData.prev) * 100 : 0;
              return (
                <div
                  key={`${rowData.neighbourhood}-${i}`}
                  className="grid grid-cols-3 gap-x-2 border-b border-[var(--border)] py-3 text-[12px]"
                >
                  <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
                    {rowData.neighbourhood}
                    {rowData.mapping && rowData.mapping.length > 0 && (
                      <div className="group relative inline-flex">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-alt)] text-[9px] font-bold text-[var(--text-muted)]">
                          i
                        </span>
                        <div className="pointer-events-none absolute bottom-full left-0 z-50 hidden min-w-[180px] flex-col gap-1 rounded-md bg-neutral-900 px-3 py-2 text-[11px] text-white shadow-lg group-hover:flex">
                          <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                            2016 sources
                          </div>
                          {rowData.mapping.map((m, mi) => (
                            <div key={`${m.name}-${mi}`} className="flex items-center justify-between">
                              <span>{m.name}</span>
                              <span className="text-neutral-300">{(m.weight * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[var(--text)]">{formatMetric(rowData.current)}</div>
                    <div
                      className={`text-[11px] font-semibold ${
                        pct >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {pct >= 0 ? "+" : ""}
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-[var(--text-muted)]">{formatMetric(rowData.prev)}</div>
                </div>
              );
            })}

            {sortedChangeData.length > showLimit && (
              <button
                onClick={() => setShowLimit(prev => prev + 10)}
                className="mt-3 w-full rounded-md border border-[var(--border)] px-3 py-2 text-[11px] text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)]"
              >
                Show more ({sortedChangeData.length - showLimit} remaining)
              </button>
            )}
            {showLimit > 10 && (
              <button
                onClick={() => setShowLimit(10)}
                className="mt-2 w-full rounded-md px-3 py-2 text-[11px] text-[var(--text-muted)] underline-offset-2 hover:underline"
              >
                Show less
              </button>
            )}
          </>
        )}
      </div>

      <div className={cardClass}>
        <div className={labelClass}>Export</div>
        <div className="flex flex-wrap gap-3">
          <a href={`${apiBase}/census/${year}/row/${row}/export/map`} target="_blank" rel="noreferrer">
            <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
              Map PDF
            </button>
          </a>
          <a href={`${apiBase}/census/${year}/row/${row}/export/bar`} target="_blank" rel="noreferrer">
            <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
              Bar PDF
            </button>
          </a>
        </div>
      </div>
    </div>
  );
};