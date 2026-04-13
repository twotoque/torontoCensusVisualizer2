import React, { useState, useMemo } from "react";
import Plot from "react-plotly.js";
import { ChevronDown, X } from "lucide-react";

interface ChartPanelProps {
  mapFig: any;
  barFig: any;
  loading: boolean;
  year: number;
  row: number;
}

export const ChartPanel: React.FC<ChartPanelProps> = ({
  mapFig,
  barFig,
  loading,
  year,
  row,
}) => {
  const [selectedNeighbourhoods, setSelectedNeighbourhoods] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Extract neighbourhood names from bar chart data
  const neighbourhoods = useMemo(() => {
    if (!barFig?.data?.[0]?.x) return [];
    return (barFig.data[0].x as string[]).filter(n => n && String(n).trim());
  }, [barFig]);

  // Determine which neighbourhoods to show
  const visibleNeighbourhoods = useMemo(() => {
    if (selectedNeighbourhoods.size === 0) return neighbourhoods;
    return neighbourhoods.filter(n => selectedNeighbourhoods.has(n));
  }, [neighbourhoods, selectedNeighbourhoods]);

  // Filter and rebuild bar chart with selected neighbourhoods
  const filteredBarFig = useMemo(() => {
    if (!barFig?.data?.[0]) {
      return barFig;
    }

    const originalData = barFig.data[0];
    const indices = visibleNeighbourhoods.map(n =>
      (originalData.x as string[]).indexOf(n)
    );

    const filteredX = indices.map(i => originalData.x[i]);
    const filteredY = indices.map(i => originalData.y[i]);

    return {
      ...barFig,
      data: [
        {
          ...originalData,
          x: filteredX,
          y: filteredY,
        },
      ],
      layout: {
        ...barFig.layout,
        xaxis: {
          ...barFig.layout?.xaxis,
          autorange: true,
        },
      },
    };
  }, [barFig, visibleNeighbourhoods]);

  const toggleNeighbourhood = (neighbourhood: string) => {
    const newSelected = new Set(selectedNeighbourhoods);
    if (newSelected.has(neighbourhood)) {
      newSelected.delete(neighbourhood);
    } else {
      newSelected.add(neighbourhood);
    }
    setSelectedNeighbourhoods(newSelected);
  };

  const clearFilters = () => {
    setSelectedNeighbourhoods(new Set());
  };

  const cardClass =
    "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]";

  return (
    <div className="flex basis-[60%] flex-col gap-3 overflow-y-auto px-4 pb-4 pt-4 pr-2">
      {loading && (
        <div className="py-5 text-center text-xs font-medium text-[var(--text-muted)]">
          Loading…
        </div>
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
          {/* Neighbourhood Filter Controls */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-alt)]"
              >
                <span className="truncate">
                  {selectedNeighbourhoods.size === 0
                    ? "All neighbourhoods"
                    : `${selectedNeighbourhoods.size} selected`}
                </span>
                <ChevronDown
                  size={16}
                  className={`ml-2 flex-shrink-0 transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg max-h-60 overflow-y-auto">
                  <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] p-2">
                    <input
                      type="text"
                      placeholder="Search neighbourhoods…"
                      className="w-full rounded px-2 py-1 text-xs bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        // Filter logic can be added here if needed
                      }}
                    />
                  </div>
                  <div className="p-2">
                    {neighbourhoods.map(neighbourhood => (
                      <label
                        key={neighbourhood}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--bg)] text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedNeighbourhoods.has(neighbourhood)}
                          onChange={() => toggleNeighbourhood(neighbourhood)}
                          className="rounded border-[var(--border)] cursor-pointer accent-[var(--accent)]"
                        />
                        <span className="text-[var(--text)] flex-1 truncate">{neighbourhood}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clear Button */}
            {selectedNeighbourhoods.size > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg)]"
                title="Clear all filters"
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>

          {/* Bar Chart */}
          <Plot
            key={`bar-${year}-${row}-${visibleNeighbourhoods.length}`}
            data={filteredBarFig.data}
            layout={{
              ...filteredBarFig.layout,
              autosize: true,
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              margin: { t: 10, b: 60, l: 40, r: 10 },
              title: undefined,
            }}
            revision={visibleNeighbourhoods.length}
            style={{ width: "100%", height: 260 }}
            useResizeHandler
          />
        </div>
      )}
    </div>
  );
};