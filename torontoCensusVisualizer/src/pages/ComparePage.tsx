import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchSlot } from "../SearchSlotContext";
import { YearTabs } from "../components/census/YearTabs";
import Plot from "react-plotly.js";
import { X } from "lucide-react";

const API = "/api";

interface StackedRow {
  rowId: number;
  label: string;
  data: any;
  color: string;
}

interface LineGraphMode {
  type: "median" | "neighbourhood";
  neighbourhood?: string;
}

const COLORS = [
 "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#14b8a6", // teal
];

export const ComparePage: React.FC = () => {
  const { setSlot } = useSearchSlot();
  const [availableYears, setAvailableYears] = useState<number[]>([2021]);
  const [year, setYear] = useState(2021);
  const [stackedRows, setStackedRows] = useState<StackedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lineMode, setLineMode] = useState<LineGraphMode>({ type: "median" });
  const [neighbourhoods, setNeighbourhoods] = useState<string[]>([]);
  const [lineFig, setLineFig] = useState<any>(null);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<
    { row_id: number; label: string; document?: string; year?: number }[]>([]);

  const searchInputRef = useRef(searchInput);
  const suggestionsRef = useRef(suggestions);
  const yearRef = useRef(year);
  searchInputRef.current = searchInput;
  suggestionsRef.current = suggestions;
  yearRef.current = year;

  useEffect(() => {
    fetch(`${API}/years`)
      .then(r => r.json())
      .then(d => {
        setAvailableYears(d.years);
        if (d.years.length) setYear(d.years[0]);
      });
  }, []);

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setStackedRows([]);
    setLineFig(null);
    setSearchInput("");
    setSuggestions([]);
  };

  const handleSearchChange = useCallback(async (q: string) => {
    setSearchInput(q);
    if (!q) {
      setSuggestions([]);
      return;
    }
    const d = await fetch(
      `${API}/census/${yearRef.current}/semantic-search?q=${encodeURIComponent(q)}`
    )
      .then(r => r.json())
      .catch(() => ({ results: [] }));
    setSuggestions(d.results || []);
  }, []);

  // addRowToStack kept stable via ref to stackedRows
  const stackedRowsRef = useRef(stackedRows);
  stackedRowsRef.current = stackedRows;

  const buildLineGraph = useCallback(
    (rows: StackedRow[], mode?: LineGraphMode) => {
      const activeMode = mode ?? lineMode;
      if (rows.length === 0) {
        setLineFig(null);
        return;
      }
      const traces: any[] = [];
      if (activeMode.type === "median") {
        rows.forEach(row => {
          const median = calculateMedian(row.data.y);
          traces.push({
            x: [row.label],
            y: [median],
            type: "bar",
            name: row.label,
            marker: { color: row.color },
          });
        });
      } else if (activeMode.type === "neighbourhood" && activeMode.neighbourhood) {
        rows.forEach(row => {
          const xLabels = row.data.x as string[];
          const yValues = row.data.y as number[];
          const neighIdx = xLabels.indexOf(activeMode.neighbourhood!);
          const value = neighIdx >= 0 ? yValues[neighIdx] : null;
          if (value !== null) {
            traces.push({
              x: [row.label],
              y: [value],
              type: "bar",
              name: row.label,
              marker: { color: row.color },
            });
          }
        });
      }
      setLineFig({
        data: traces,
        layout: {
          autosize: true,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          margin: { t: 20, b: 60, l: 60, r: 20 },
          hovermode: "closest" as const,
          barmode: "group",
        },
      });
    },
    [lineMode]
  );

  const addRowToStack = useCallback(
    (rowId: number, label: string) => {
      if (stackedRowsRef.current.some(r => r.rowId === rowId)) return;
      setLoading(true);
      fetch(`${API}/census/${yearRef.current}/row/${rowId}/bar`)
        .then(r => r.json())
        .then(barData => {
          if (stackedRowsRef.current.length === 0 && barData?.data?.[0]?.x) {
            const neighs = (barData.data[0].x as string[]).filter(
              n => n && String(n).trim()
            );
            setNeighbourhoods(neighs);
          }
          const colorIndex = stackedRowsRef.current.length % COLORS.length;
          const newRow: StackedRow = {
            rowId,
            label,
            data: barData.data[0],
            color: COLORS[colorIndex],
          };
          const newStack = [...stackedRowsRef.current, newRow];
          setStackedRows(newStack);
          buildLineGraph(newStack);
        })
        .finally(() => setLoading(false));
    },
    [buildLineGraph]
  );

  const submitSearch = useCallback(() => {
    const n = parseInt(searchInputRef.current);
    if (!isNaN(n)) {
      addRowToStack(n, `Row ${n}`);
      setSearchInput("");
      setSuggestions([]);
      return;
    }
    const suggs = suggestionsRef.current;
    if (suggs.length > 0) {
      addRowToStack(suggs[0].row_id, suggs[0].label);
      setSearchInput("");
      setSuggestions([]);
    }
  }, [addRowToStack]);

  const removeRowFromStack = (rowId: number) => {
    const newStack = stackedRows.filter(r => r.rowId !== rowId);
    setStackedRows(newStack);
    if (newStack.length === 0) {
      setLineFig(null);
      setNeighbourhoods([]);
    } else {
      buildLineGraph(newStack);
    }
  };

  const calculateMedian = (values: number[]) => {
    const sorted = [...values].filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // Slot: set once, never re-set (stable callbacks via refs/useCallback)
  useEffect(() => {
    const SlotSearch = () => {
      // Uses a local uncontrolled-style input that calls stable callbacks
      const inputRef = useRef<HTMLInputElement>(null);
      const [localVal, setLocalVal] = useState("");
      const [localSuggs, setLocalSuggs] = useState<typeof suggestions>([]);

      const onChange = async (q: string) => {
        setLocalVal(q);
        if (!q) { setLocalSuggs([]); return; }
        const d = await fetch(
          `${API}/census/${yearRef.current}/semantic-search?q=${encodeURIComponent(q)}`
        ).then(r => r.json()).catch(() => ({ results: [] }));
        setLocalSuggs(d.results || []);
      };

      const onSubmit = () => {
        const n = parseInt(localVal);
        if (!isNaN(n)) { addRowToStack(n, `Row ${n}`); setLocalVal(""); setLocalSuggs([]); return; }
        if (localSuggs.length > 0) {
          addRowToStack(localSuggs[0].row_id, localSuggs[0].label);
          setLocalVal(""); setLocalSuggs([]);
        }
      };

      return (
        <div className="relative flex w-full max-w-xl items-center gap-2">
          <input
            ref={inputRef}
            value={localVal}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSubmit()}
            placeholder="Search census variable..."
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
                      // use onMouseDown + preventDefault so input doesn't blur before click registers
                      e.preventDefault();
                      addRowToStack(sg.row_id, sg.label);
                      setLocalVal("");
                      setLocalSuggs([]);
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-alt)]"
                  >
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">#{sg.row_id}</span>
                    <span className="flex-1">{sg.label}</span>
                    {"year" in sg && (
                      <span className="flex-shrink-0 rounded border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                        {(sg as any).year}
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
    // Only re-run if addRowToStack changes (which is stable)
  }, [setSlot, addRowToStack]);

  const stackedBarFig =
    stackedRows.length > 0
      ? {
          data: stackedRows.map(row => ({
            ...row.data,
            name: row.label,
            marker: { color: row.color },
          })),
          layout: {
            autosize: true,
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            margin: { t: 10, b: 60, l: 40, r: 10 },
            barmode: "stack" as const,
            hovermode: "closest" as const,
          },
        }
      : null;

  const cardClass =
    "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]";

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--text)]">
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-2 pt-3">
        <div className="mb-2 text-base font-semibold text-[var(--text)]">Census Comparison</div>
        <YearTabs years={availableYears} active={year} onSelect={handleYearChange} />
      </div>

      <div className="flex flex-1 overflow-hidden gap-3 p-4">
        <div className="flex basis-[25%] flex-col gap-3 overflow-y-auto">
          <div className={cardClass}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-2">
              Selected Rows ({stackedRows.length})
            </div>
            {stackedRows.length === 0 ? (
              <div className="py-3 text-sm text-[var(--text-muted)]">Search above to add rows</div>
            ) : (
              <div className="flex flex-col gap-2">
                {stackedRows.map(row => (
                  <div
                    key={row.rowId}
                    className="flex items-center justify-between rounded-lg bg-[var(--bg)] p-2 border border-[var(--border)]"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[var(--text)] truncate">{row.label}</div>
                        <div className="text-xs text-[var(--text-muted)]">ID: {row.rowId}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeRowFromStack(row.rowId)}
                      className="ml-2 p-1 hover:bg-[var(--surface-alt)] rounded transition flex-shrink-0"
                    >
                      <X size={16} className="text-[var(--text-muted)]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex basis-[70%] flex-col gap-3 overflow-y-auto">
          {loading && (
            <div className="py-5 text-center text-xs font-medium text-[var(--text-muted)]">
              Loading…
            </div>
          )}

          {stackedBarFig && (
            <div className={cardClass}>
              <Plot
                data={stackedBarFig.data}
                layout={{
                  ...stackedBarFig.layout,
                  autosize: true,
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                  margin: { t: 10, b: 60, l: 40, r: 10 },
                  title: undefined,
                }}
                style={{ width: "100%", height: 300 }}
                useResizeHandler
              />
            </div>
          )}

          {lineFig && (
            <div className={cardClass}>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const newMode: LineGraphMode = { type: "median" };
                    setLineMode(newMode);
                    buildLineGraph(stackedRows, newMode);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-lg border transition ${
                    lineMode.type === "median"
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
                  }`}
                >
                  Median
                </button>

                {neighbourhoods.length > 0 && (
                  <select
                    value={lineMode.type === "neighbourhood" ? lineMode.neighbourhood || "" : ""}
                    onChange={e => {
                      if (e.target.value) {
                        const newMode: LineGraphMode = {
                          type: "neighbourhood",
                          neighbourhood: e.target.value,
                        };
                        setLineMode(newMode);
                        buildLineGraph(stackedRows, newMode);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-lg border transition ${
                      lineMode.type === "neighbourhood"
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    <option value="">Select neighbourhood…</option>
                    {neighbourhoods.map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <Plot
                data={lineFig.data}
                layout={{
                  ...lineFig.layout,
                  autosize: true,
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                  margin: { t: 10, b: 60, l: 60, r: 10 },
                  title: undefined,
                }}
                style={{ width: "100%", height: 300 }}
                useResizeHandler
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};