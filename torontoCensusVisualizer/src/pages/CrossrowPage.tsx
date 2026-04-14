import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchSlot } from "../SearchSlotContext";
import { formatMetric } from "../components/census/types.ts";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";

const API = "/api";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6",
];

interface Column {
  id:       string;           // `${rowId}-${year}`
  rowId:    number;
  year:     number;
  label:    string;
  color:    string;
  neighMap: Record<string, number>;  // neighbourhood → value
}

type SortKey = "alpha" | "highest" | "lowest" | "changeHigh" | "changeLow";

async function fetchNeighMap(
  rowId: number,
  year: number
): Promise<Record<string, number>> {
  try {
    const d = await fetch(`${API}/census/${year}/row/${rowId}/bar`).then(r => r.json());
    const trace = d?.data?.[0];
    if (!trace) return {};
    const xs: string[] = trace.x ?? [];
    const ys: number[] = trace.y ?? [];
    const map: Record<string, number> = {};
    xs.forEach((x, i) => { if (x?.trim()) map[x.trim()] = ys[i]; });
    return map;
  } catch {
    return {};
  }
}

function pctChange(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || a === 0) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

interface SlotSearchProps {
  onAdd: (rowId: number, year: number, label: string) => void;
}

const SlotSearch: React.FC<SlotSearchProps> = ({ onAdd }) => {
  const [val,   setVal]   = useState("");
  const [year,  setYear]  = useState(2021);
  const [suggs, setSuggs] = useState<{ row_id: number; label: string }[]>([]);

  async function onChange(q: string) {
    setVal(q);
    if (!q) { setSuggs([]); return; }
    const d = await fetch(
      `${API}/census/${year}/semantic-search?q=${encodeURIComponent(q)}`
    ).then(r => r.json()).catch(() => ({ results: [] }));
    setSuggs(d.results || []);
  }

  function submit(rowId: number, label: string) {
    onAdd(rowId, year, label);
    setVal(""); setSuggs([]);
  }

  function handleEnter() {
    const n = parseInt(val);
    if (!isNaN(n)) { submit(n, `Row ${n}`); return; }
    if (suggs[0])  { submit(suggs[0].row_id, suggs[0].label); }
  }

  return (
    <div className="relative flex items-center gap-2 w-full max-w-2xl">
      {/* year picker */}
      <select
        value={year}
        onChange={e => setYear(Number(e.target.value))}
        className="h-8 rounded-lg border border-white/30 bg-white/20 px-2 text-xs font-medium text-white focus:outline-none"
      >
        {[2001, 2006, 2011, 2016, 2021].map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* query */}
      <input
        value={val}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleEnter()}
        placeholder="Search census variable…"
        className="h-8 flex-1 rounded-lg border border-white/30 bg-white/20 px-3 text-xs font-medium text-white placeholder:text-white/70 focus:border-white focus:outline-none"
      />
      <button
        onClick={handleEnter}
        className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/30"
      >
        Add column
      </button>

      {suggs.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
          {suggs.map(sg => (
            <li key={sg.row_id} className="border-b border-[var(--border)] last:border-0">
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); submit(sg.row_id, sg.label); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-alt)]"
              >
                <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                  #{sg.row_id} · {year}
                </span>
                <span className="flex-1 text-[var(--text)]">{sg.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


export const CrossRowStatsPage: React.FC = () => {
  const { setSlot } = useSearchSlot();
  const [columns,     setColumns]     = useState<Column[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [neighSearch, setNeighSearch] = useState("");
  const [sortBy,      setSortBy]      = useState<SortKey>("changeHigh");
  const [showLimit,   setShowLimit]   = useState(20);

  const columnsRef = useRef(columns);
  columnsRef.current = columns;


  const addColumn = useCallback(async (rowId: number, year: number, label: string) => {
    const id = `${rowId}-${year}`;
    if (columnsRef.current.some(c => c.id === id)) return;
    setLoading(true);
    const neighMap = await fetchNeighMap(rowId, year);
    const color    = COLORS[columnsRef.current.length % COLORS.length];
    setColumns(prev => [...prev, { id, rowId, year, label, color, neighMap }]);
    setLoading(false);
  }, []);

  const removeColumn = useCallback((id: string) => {
    setColumns(prev => prev.filter(c => c.id !== id));
  }, []);


  useEffect(() => {
    setSlot(<SlotSearch onAdd={addColumn} />);
    return () => setSlot(null);
  }, [setSlot, addColumn]);


  const allNeighbourhoods = useMemo(() => {
    const set = new Set<string>();
    columns.forEach(c => Object.keys(c.neighMap).forEach(n => set.add(n)));
    return Array.from(set);
  }, [columns]);

  const firstCol = columns[0] ?? null;
  const lastCol  = columns[columns.length - 1] ?? null;

  const tableRows = useMemo(() => {
    return allNeighbourhoods
      .filter(n => n.toLowerCase().includes(neighSearch.toLowerCase()))
      .map(n => {
        const values = Object.fromEntries(columns.map(c => [c.id, c.neighMap[n] ?? null]));
        const change = pctChange(
          firstCol ? firstCol.neighMap[n] : null,
          lastCol  ? lastCol.neighMap[n]  : null,
        );
        return { neighbourhood: n, values, change };
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "alpha":      return a.neighbourhood.localeCompare(b.neighbourhood);
          case "highest":    return (lastCol ? (b.values[lastCol.id] ?? -Infinity) - (a.values[lastCol.id] ?? -Infinity) : 0);
          case "lowest":     return (lastCol ? (a.values[lastCol.id] ?? Infinity)  - (b.values[lastCol.id] ?? Infinity)  : 0);
          case "changeHigh": return Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0);
          case "changeLow":  return Math.abs(a.change ?? 0) - Math.abs(b.change ?? 0);
          default:           return 0;
        }
      });
  }, [allNeighbourhoods, columns, neighSearch, sortBy, firstCol, lastCol]);


  const cardClass  = "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]";

  const gridCols = `minmax(160px, 2fr) repeat(${columns.length}, minmax(100px, 1fr)) minmax(80px, 1fr)`;

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--text)]">

      {/* header */}
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-2 pt-3">
        <div className="mb-1 text-base font-semibold">Row Trends</div>
        <div className="text-xs text-[var(--text-muted)]">
          Add any census variable + year as a column. All neighbourhoods shown as rows.
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">

        {/* column pills */}
        {columns.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {columns.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[12px]"
              >
                <span
                  className="h-2 w-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="font-medium text-[var(--text)] max-w-[200px] truncate">{c.label}</span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-muted)]">{c.year}</span>
                <button
                  onClick={() => removeColumn(c.id)}
                  className="ml-1 rounded-full p-0.5 text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="py-4 text-center text-xs text-[var(--text-muted)]">Loading…</div>
        )}

        {/* empty state */}
        {columns.length === 0 && !loading && (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
            Use the search above to add a census variable + year as a column.
          </div>
        )}

        {/* main table */}
        {columns.length > 0 && (
          <div className={cardClass}>

            {/* filters */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={neighSearch}
                onChange={e => { setNeighSearch(e.target.value); setShowLimit(20); }}
                placeholder="Search neighbourhood…"
                className="min-w-[160px] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-[11px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
                className="rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1 text-[11px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="changeHigh">Biggest change (col 1 → last)</option>
                <option value="changeLow">Smallest change</option>
                <option value="highest">Highest (last col)</option>
                <option value="lowest">Lowest (last col)</option>
                <option value="alpha">A → Z</option>
              </select>
              <span className="text-[11px] text-[var(--text-muted)]">
                {tableRows.length} neighbourhoods
              </span>
            </div>

            {/* table header */}
            <div
              className="grid gap-x-3 border-b border-[var(--border)] pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
              style={{ gridTemplateColumns: gridCols }}
            >
              <span>Neighbourhood</span>
              {columns.map(c => (
                <span key={c.id} className="flex items-center gap-1 min-w-0">
                  <span
                    className="inline-block h-2 w-2 flex-shrink-0 rounded-sm"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="truncate">{c.label}</span>
                  <span className="flex-shrink-0 opacity-60">· {c.year}</span>
                </span>
              ))}
              <span>Change</span>
            </div>

            {/* table body */}
            {tableRows.slice(0, showLimit).map((row, i) => (
              <div
                key={row.neighbourhood}
                className={`grid gap-x-3 border-b border-[var(--border)] py-2 text-[12px] ${
                  i % 2 === 0 ? "" : "bg-[var(--surface-alt)]/30"
                }`}
                style={{ gridTemplateColumns: gridCols }}
              >
                <span className="truncate font-medium text-[var(--text)]">
                  {row.neighbourhood}
                </span>

                {columns.map(c => {
                  const val = row.values[c.id];
                  return (
                    <span key={c.id} className="text-[var(--text)]">
                      {val != null ? formatMetric(val) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </span>
                  );
                })}

                <span className="flex items-center gap-0.5">
                  {row.change != null ? (
                    <>
                      {row.change > 0
                        ? <TrendingUp  size={11} className="text-emerald-500 flex-shrink-0" />
                        : row.change < 0
                        ? <TrendingDown size={11} className="text-rose-500 flex-shrink-0" />
                        : <Minus       size={11} className="text-[var(--text-muted)] flex-shrink-0" />
                      }
                      <span className={`font-semibold ${
                        row.change > 0 ? "text-emerald-500"
                        : row.change < 0 ? "text-rose-500"
                        : "text-[var(--text-muted)]"
                      }`}>
                        {row.change > 0 ? "+" : ""}
                        {row.change.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </span>
              </div>
            ))}

            {/* pagination */}
            {tableRows.length > showLimit && (
              <button
                onClick={() => setShowLimit(p => p + 20)}
                className="mt-3 w-full rounded-md border border-[var(--border)] py-2 text-[11px] text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)]"
              >
                Show more ({tableRows.length - showLimit} remaining)
              </button>
            )}
            {showLimit > 20 && (
              <button
                onClick={() => setShowLimit(20)}
                className="mt-1 w-full rounded-md py-1.5 text-[11px] text-[var(--text-muted)] underline-offset-2 hover:underline"
              >
                Show less
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};