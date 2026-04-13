import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchSlot } from "../SearchSlotContext";
import { formatMetric } from "../components/census/types";
import Plot from "react-plotly.js";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";

const API = "/api";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
];

interface TrackedRow {
  rowId: number;
  label: string;
  color: string;
  // keyed by year
  medians: Record<number, number | null>;
  // keyed by year → neighbourhood → value
  neighData: Record<number, Record<string, number>>;
}

interface NeighbourhoodChange {
  neighbourhood: string;
  values: Record<number, number | null>;  // year → value
  pctChange: number | null; // between first and last available year
}

type SortKey = "alpha" | "highest" | "lowest" | "changeHigh" | "changeLow";

export const CrossRowStatsPage: React.FC = () => {
  const { setSlot } = useSearchSlot();
  // All selected years to compare across (default: all available)
  const [activeYears, setActiveYears] = useState<number[]>([]);
  const [trackedRows, setTrackedRows] = useState<TrackedRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Which row is "focused" for the neighbourhood table
  const [focusedRowId, setFocusedRowId] = useState<number | null>(null);
  const [neighSearch, setNeighSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("changeHigh");
  const [showLimit, setShowLimit] = useState(10);

  const trackedRowsRef = useRef(trackedRows);
  trackedRowsRef.current = trackedRows;
  const activeYearsRef = useRef(activeYears);
  activeYearsRef.current = activeYears;

  // Fetch available years
  useEffect(() => {
    fetch(`${API}/years`)
      .then(r => r.json())
      .then(d => {
        const years: number[] = d.years ?? [];
        setActiveYears(years);
      });
  }, []);

  // Fetch bar data for a row+year, returns { neighbourhood → value }
  const fetchRowYear = async (
    rowId: number,
    year: number
  ): Promise<{ neighMap: Record<string, number>; median: number | null }> => {
    try {
      const barData = await fetch(`${API}/census/${year}/row/${rowId}/bar`).then(r => r.json());
      const trace = barData?.data?.[0];
      if (!trace) return { neighMap: {}, median: null };
      const xs: string[] = trace.x ?? [];
      const ys: number[] = trace.y ?? [];
      const neighMap: Record<string, number> = {};
      xs.forEach((x, i) => { if (x?.trim()) neighMap[x.trim()] = ys[i]; });
      const values = Object.values(neighMap).filter(v => !isNaN(v));
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length === 0
          ? null
          : sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;
      return { neighMap, median };
    } catch {
      return { neighMap: {}, median: null };
    }
  };

  const addRow = useCallback(async (rowId: number, label: string) => {
    if (trackedRowsRef.current.some(r => r.rowId === rowId)) return;
    setLoading(true);

    const years = activeYearsRef.current;
    const results = await Promise.all(years.map(y => fetchRowYear(rowId, y)));

    const medians: Record<number, number | null> = {};
    const neighData: Record<number, Record<string, number>> = {};
    years.forEach((y, i) => {
      medians[y] = results[i].median;
      neighData[y] = results[i].neighMap;
    });

    const colorIndex = trackedRowsRef.current.length % COLORS.length;
    const newRow: TrackedRow = {
      rowId,
      label,
      color: COLORS[colorIndex],
      medians,
      neighData,
    };

    setTrackedRows(prev => {
      const updated = [...prev, newRow];
      if (updated.length === 1) setFocusedRowId(rowId);
      return updated;
    });
    setLoading(false);
  }, []);

  const removeRow = (rowId: number) => {
    setTrackedRows(prev => {
      const next = prev.filter(r => r.rowId !== rowId);
      if (focusedRowId === rowId) setFocusedRowId(next[0]?.rowId ?? null);
      return next;
    });
  };

  // ── Median trend chart (one line per row across years) ──────────────────────
  const medianTrendFig = trackedRows.length > 0 && activeYears.length > 0
    ? {
        data: trackedRows.map(row => ({
          x: activeYears,
          y: activeYears.map(y => row.medians[y] ?? null),
          type: "scatter" as const,
          mode: "lines+markers" as const,
          name: row.label,
          line: { color: row.color, width: 2 },
          marker: { color: row.color, size: 6 },
          connectgaps: false,
        })),
        layout: {
          autosize: true,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          margin: { t: 10, b: 50, l: 60, r: 10 },
          hovermode: "x unified" as const,
          xaxis: { tickmode: "array" as const, tickvals: activeYears },
          yaxis: { title: "Median" },
        },
      }
    : null;

  // ── Neighbourhood table for focused row ─────────────────────────────────────
  const focusedRow = trackedRows.find(r => r.rowId === focusedRowId) ?? null;

  const neighbourhoodRows: NeighbourhoodChange[] = React.useMemo(() => {
    if (!focusedRow) return [];
    const allNeighs = new Set<string>();
    activeYears.forEach(y => {
      Object.keys(focusedRow.neighData[y] ?? {}).forEach(n => allNeighs.add(n));
    });
    return Array.from(allNeighs).map(n => {
      const values: Record<number, number | null> = {};
      activeYears.forEach(y => {
        values[y] = focusedRow.neighData[y]?.[n] ?? null;
      });
      const firstYear = activeYears[0];
      const lastYear = activeYears[activeYears.length - 1];
      const first = values[firstYear];
      const last = values[lastYear];
      const pctChange =
        first !== null && last !== null && first !== 0
          ? ((last - first) / Math.abs(first)) * 100
          : null;
      return { neighbourhood: n, values, pctChange };
    });
  }, [focusedRow, activeYears]);

  const filteredNeighRows = neighbourhoodRows
    .filter(r => r.neighbourhood.toLowerCase().includes(neighSearch.toLowerCase()))
    .sort((a, b) => {
      const lastYear = activeYears[activeYears.length - 1];
      const firstYear = activeYears[0];
      switch (sortBy) {
        case "alpha": return a.neighbourhood.localeCompare(b.neighbourhood);
        case "highest": return (b.values[lastYear] ?? -Infinity) - (a.values[lastYear] ?? -Infinity);
        case "lowest": return (a.values[lastYear] ?? Infinity) - (b.values[lastYear] ?? Infinity);
        case "changeHigh": return Math.abs(b.pctChange ?? 0) - Math.abs(a.pctChange ?? 0);
        case "changeLow": return Math.abs(a.pctChange ?? 0) - Math.abs(b.pctChange ?? 0);
        default: return 0;
      }
    });

  // ── Slot search (stable, self-contained) ───────────────────────────────────
  useEffect(() => {
    const yearRef2 = activeYearsRef; // borrow ref

    const SlotSearch = () => {
      const [localVal, setLocalVal] = useState("");
      const [localSuggs, setLocalSuggs] = useState<
        { row_id: number; label: string; year?: number }[]
      >([]);

      const onChange = async (q: string) => {
        setLocalVal(q);
        if (!q) { setLocalSuggs([]); return; }
        const year = yearRef2.current[0] ?? 2021;
        const d = await fetch(
          `${API}/census/${year}/semantic-search?q=${encodeURIComponent(q)}`
        ).then(r => r.json()).catch(() => ({ results: [] }));
        setLocalSuggs(d.results || []);
      };

      const onSubmit = () => {
        const n = parseInt(localVal);
        if (!isNaN(n)) { addRow(n, `Row ${n}`); setLocalVal(""); setLocalSuggs([]); return; }
        if (localSuggs.length > 0) {
          addRow(localSuggs[0].row_id, localSuggs[0].label);
          setLocalVal(""); setLocalSuggs([]);
        }
      };

      return (
        <div className="relative flex w-full max-w-xl items-center gap-2">
          <input
            value={localVal}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSubmit()}
            placeholder="Add census variable…"
            className="h-8 flex-1 rounded-lg border border-white/30 bg-white/20 px-3 text-xs font-medium text-white placeholder:text-white/70 focus:border-white focus:outline-none"
          />
          <button
            onClick={onSubmit}
            className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/30"
          >
            Add
          </button>
          {localSuggs.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)]">
              {localSuggs.map(sg => (
                <li key={sg.row_id} className="border-b border-[var(--border)] last:border-0">
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      addRow(sg.row_id, sg.label);
                      setLocalVal(""); setLocalSuggs([]);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-alt)]"
                  >
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">#{sg.row_id}</span>
                    <span className="flex-1">{sg.label}</span>
                    {sg.year !== undefined && (
                      <span className="flex-shrink-0 rounded border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                        {sg.year}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    };

    setSlot(<SlotSearch />);
    return () => setSlot(null);
  }, [setSlot, addRow]);

  const cardClass =
    "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]";
  const labelClass =
    "text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]";

  const firstYear = activeYears[0];
  const lastYear = activeYears[activeYears.length - 1];

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-2 pt-3">
        <div className="mb-1 text-base font-semibold text-[var(--text)]">Row Trends</div>
        <div className="text-xs text-[var(--text-muted)]">
          Track multiple census variables across all available years
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden gap-3 p-4">

        {/* Left: row list + median summary cards */}
        <div className="flex basis-[25%] flex-col gap-3 overflow-y-auto">
          <div className={cardClass}>
            <div className={`${labelClass} mb-2`}>Tracked Variables ({trackedRows.length})</div>
            {trackedRows.length === 0 ? (
              <div className="py-3 text-sm text-[var(--text-muted)]">Search above to add rows</div>
            ) : (
              <div className="flex flex-col gap-2">
                {trackedRows.map(row => {
                  const firstVal = row.medians[firstYear];
                  const lastVal = row.medians[lastYear];
                  const pct =
                    firstVal !== null &&
                    firstVal !== undefined &&
                    lastVal !== null &&
                    lastVal !== undefined &&
                    firstVal !== 0
                      ? ((lastVal - firstVal) / Math.abs(firstVal)) * 100
                      : null;
                  const isFocused = focusedRowId === row.rowId;

                  return (
                    <div
                      key={row.rowId}
                      onClick={() => setFocusedRowId(row.rowId)}
                      className={`flex flex-col gap-1 rounded-lg p-2 border cursor-pointer transition ${
                        isFocused
                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                          : "border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-alt)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="text-sm text-[var(--text)] truncate">{row.label}</span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); removeRow(row.rowId); }}
                          className="ml-1 p-1 hover:bg-[var(--surface-alt)] rounded transition flex-shrink-0"
                        >
                          <X size={14} className="text-[var(--text-muted)]" />
                        </button>
                      </div>

                      {/* Mini median summary */}
                      <div className="grid grid-cols-2 gap-1 text-[11px] pl-5">
                        {firstYear && lastYear && firstYear !== lastYear && (
                          <>
                            <div className="text-[var(--text-muted)]">{firstYear}</div>
                            <div className="text-[var(--text)]">
                              {firstVal !== null && firstVal !== undefined
                                ? formatMetric(firstVal)
                                : "—"}
                            </div>
                            <div className="text-[var(--text-muted)]">{lastYear}</div>
                            <div className="text-[var(--text)]">
                              {lastVal !== null && lastVal !== undefined
                                ? formatMetric(lastVal)
                                : "—"}
                            </div>
                          </>
                        )}
                        {pct !== null && (
                          <div className="col-span-2 flex items-center gap-1">
                            {pct > 0 ? (
                              <TrendingUp size={11} className="text-emerald-500" />
                            ) : pct < 0 ? (
                              <TrendingDown size={11} className="text-rose-500" />
                            ) : (
                              <Minus size={11} className="text-[var(--text-muted)]" />
                            )}
                            <span
                              className={`font-semibold ${
                                pct > 0
                                  ? "text-emerald-500"
                                  : pct < 0
                                  ? "text-rose-500"
                                  : "text-[var(--text-muted)]"
                              }`}
                            >
                              {pct > 0 ? "+" : ""}
                              {pct.toFixed(1)}%
                            </span>
                            <span className="text-[var(--text-muted)]">overall</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* City median cards per row */}
          {trackedRows.length > 0 && activeYears.length > 0 && (
            <div className={cardClass}>
              <div className={`${labelClass} mb-2`}>City Median by Year</div>
              <div className="flex flex-col gap-3">
                {trackedRows.map(row => (
                  <div key={row.rowId} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="text-xs font-medium text-[var(--text)] truncate">
                        {row.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 pl-4">
                      {activeYears.map(y => (
                        <React.Fragment key={y}>
                          <span className="text-[11px] text-[var(--text-muted)]">{y}</span>
                          <span className="text-[11px] font-semibold text-[var(--accent)]">
                            {row.medians[y] !== null && row.medians[y] !== undefined
                              ? formatMetric(row.medians[y]!)
                              : "—"}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Centre: trend chart + neighbourhood table */}
        <div className="flex basis-[75%] flex-col gap-3 overflow-y-auto">
          {loading && (
            <div className="py-5 text-center text-xs font-medium text-[var(--text-muted)]">
              Loading…
            </div>
          )}

          {/* Median trend line chart */}
          {medianTrendFig && (
            <div className={cardClass}>
              <div className={`${labelClass} mb-3`}>City Median Over Time</div>
              <Plot
                data={medianTrendFig.data}
                    layout={{
                        ...(medianTrendFig.layout as any),
                        autosize: true,
                        paper_bgcolor: "transparent",
                        plot_bgcolor: "transparent",
                    }}
                style={{ width: "100%", height: 280 }}
                useResizeHandler
              />
            </div>
          )}

          {/* Neighbourhood breakdown */}
          {focusedRow && (
            <div className={cardClass}>
              <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className={labelClass}>Neighbourhood Breakdown</div>
                  <div className="mt-0.5 text-xs font-medium text-[var(--text)]">
                    <span
                      className="inline-block w-2 h-2 rounded-sm mr-1.5"
                      style={{ backgroundColor: focusedRow.color }}
                    />
                    {focusedRow.label}
                  </div>
                </div>

                {/* Row selector if multiple rows */}
                {trackedRows.length > 1 && (
                  <select
                    value={focusedRowId ?? ""}
                    onChange={e => setFocusedRowId(Number(e.target.value))}
                    className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-[11px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  >
                    {trackedRows.map(r => (
                      <option key={r.rowId} value={r.rowId}>{r.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Filters */}
              <div className="mb-2 flex flex-wrap gap-2">
                <input
                  value={neighSearch}
                  onChange={e => setNeighSearch(e.target.value)}
                  placeholder="Search neighbourhood..."
                  className="min-w-[120px] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-[11px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortKey)}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-[11px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  <option value="changeHigh">Biggest change</option>
                  <option value="changeLow">Smallest change</option>
                  <option value="highest">Highest ({lastYear})</option>
                  <option value="lowest">Lowest ({lastYear})</option>
                  <option value="alpha">A → Z</option>
                </select>
              </div>

              {/* Table header */}
              <div
                className="grid gap-x-2 border-b border-[var(--border)] pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                style={{ gridTemplateColumns: `2fr repeat(${activeYears.length}, 1fr) 1fr` }}
              >
                <span>Neighbourhood</span>
                {activeYears.map(y => <span key={y}>{y}</span>)}
                <span>Change</span>
              </div>

              {filteredNeighRows.length === 0 ? (
                <div className="pt-3 text-xs text-[var(--text-muted)]">
                  {neighSearch ? "No matches." : "No data."}
                </div>
              ) : (
                <>
                  {filteredNeighRows.slice(0, showLimit).map((nr, i) => (
                    <div
                      key={`${nr.neighbourhood}-${i}`}
                      className="grid gap-x-2 border-b border-[var(--border)] py-2.5 text-[12px]"
                      style={{ gridTemplateColumns: `2fr repeat(${activeYears.length}, 1fr) 1fr` }}
                    >
                      <span className="font-semibold text-[var(--text)] truncate">
                        {nr.neighbourhood}
                      </span>
                      {activeYears.map(y => (
                        <span key={y} className="text-[var(--text)]">
                          {nr.values[y] !== null && nr.values[y] !== undefined
                            ? formatMetric(nr.values[y]!)
                            : <span className="text-[var(--text-muted)]">—</span>}
                        </span>
                      ))}
                      <span>
                        {nr.pctChange !== null ? (
                          <span
                            className={`font-semibold flex items-center gap-0.5 ${
                              nr.pctChange > 0
                                ? "text-emerald-500"
                                : nr.pctChange < 0
                                ? "text-rose-500"
                                : "text-[var(--text-muted)]"
                            }`}
                          >
                            {nr.pctChange > 0 ? "+" : ""}
                            {nr.pctChange.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </span>
                    </div>
                  ))}

                  {filteredNeighRows.length > showLimit && (
                    <button
                      onClick={() => setShowLimit(prev => prev + 10)}
                      className="mt-3 w-full rounded-md border border-[var(--border)] px-3 py-2 text-[11px] text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)]"
                    >
                      Show more ({filteredNeighRows.length - showLimit} remaining)
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
          )}
        </div>
      </div>
    </div>
  );
};