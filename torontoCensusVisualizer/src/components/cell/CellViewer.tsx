// CellViewer.tsx
import React, { useEffect, useRef, useState } from "react";

const API = "/api";

// ── types ─────────────────────────────────────────────────────────────────────


export interface CellInfo {
  row_label: string;
  row_id:    number;
  columns:   string[];
  year:      number;
  years?: { year: number; row_id: number }[];
} 

export interface CellTarget {
  year:         number;
  row_id:       number;
  neighbourhood: string;   // column name
  metric:       string;    // human label for the header


}

interface CellRow {
  [col: string]: string | number;
}

interface CellData {
  rows:          CellRow[];
  target_row_id: number;
  target_col:    string;
  label_col:     string;
  target_df_idx: number;
  row_start:     number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(v: string | number): string {
  if (typeof v === "number") return isNaN(v) ? "—" : v.toLocaleString();
  const n = parseFloat(String(v).replace(/,/g, ""));
  if (!isNaN(n) && v !== "") return n.toLocaleString();
  return v || "—";
}

// ── CellViewer ────────────────────────────────────────────────────────────────

interface CellViewerProps {
  target: CellTarget | null;
  onClose: () => void;
}

export const CellViewer: React.FC<CellViewerProps> = ({ target, onClose }) => {
  const [data,    setData]    = useState<CellData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const targetCellRef         = useRef<HTMLTableCellElement>(null);
  const open                  = target !== null;

  // fetch when target changes
  useEffect(() => {
    if (!target) { setData(null); return; }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      year:          String(target.year),
      row_id:        String(target.row_id),
      neighbourhood: target.neighbourhood,
    });
    fetch(`${API}/census/cell?${params}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [target]);

  // scroll highlighted cell into view once rendered
  useEffect(() => {
    if (data && targetCellRef.current) {
      targetCellRef.current.scrollIntoView({ block: "center", inline: "center" });
    }
  }, [data]);

  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/30 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] transform flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <div className="text-sm font-semibold">Source Cell</div>
            {target && (
              <div className="text-xs text-[var(--text-muted)]">
                {target.year} · {target.neighbourhood}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close cell viewer"
            className="rounded-md p-1 text-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)]"
          >
            ×
          </button>
        </div>

        {target?.metric && (
          <div className="px-5 pt-3">
            <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
              {target.metric}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading && (
            <div className="py-10 text-center text-sm text-[var(--text-muted)]">Loading…</div>
          )}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Failed to load cell data: {error}
            </div>
          )}

          {data && !loading && (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className="sticky top-0 min-w-[40px] border-b-2 border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-center text-[11px] font-semibold text-[var(--text-muted)]">
                    #
                  </th>
                  {Object.keys(data.rows[0] || {}).map(col => {
                    const isTargetCol = col === data.target_col;
                    return (
                      <th
                        key={col}
                        className={`sticky top-0 min-w-[120px] border-b-2 border-[var(--border)] px-3 py-2 text-left text-[11px] font-semibold ${
                          isTargetCol
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--surface-alt)] text-[var(--text-muted)]"
                        }`}
                      >
                        {col}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => {
                  const absIdx = data.row_start + i;
                  const isTarget = absIdx === data.target_df_idx;
                  return (
                    <tr key={i} className={isTarget ? "bg-[var(--accent)]/5" : undefined}>
                      <td
                        className={`border-r border-[var(--border)] px-2 py-1 text-center text-[11px] ${
                          isTarget ? "font-semibold text-[var(--accent)]" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {absIdx + 1}
                      </td>
                      {Object.entries(row).map(([col, val]) => {
                        const isHit = isTarget && col === data.target_col;
                        const isTargetCol = col === data.target_col;
                        return (
                          <td
                            key={col}
                            ref={isHit ? targetCellRef : undefined}
                            className={`border-b border-r border-[var(--border)] px-3 py-2 ${
                              isHit
                                ? "bg-[var(--accent)]/20 font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]"
                                : isTargetCol
                                  ? "bg-[var(--accent)]/10 text-[var(--text)]"
                                  : "text-[var(--text)]"
                            }`}
                          >
                            {fmt(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--text-muted)]">
          <span>Showing ±6 rows around match</span>
          <span className="ml-auto">Press Esc to close</span>
        </div>
      </div>
    </>
  );
};
