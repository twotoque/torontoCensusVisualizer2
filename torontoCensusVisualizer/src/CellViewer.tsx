// CellViewer.tsx
import React, { useEffect, useRef, useState } from "react";
import { type Tokens } from "./colours";

const API = "/api";

// ── types ─────────────────────────────────────────────────────────────────────


export interface CellInfo {
  row_label: string;
  row_id:    number;
  columns:   string[];
  year:      number;
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
  t:       Tokens;
  target:  CellTarget | null;
  onClose: () => void;
}

export const CellViewer: React.FC<CellViewerProps> = ({ t, target, onClose }) => {
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

  const panelW = 560;

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.25)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s",
          zIndex: 40,
        }}
      />

      {/* slide-over panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: panelW,
        background: t.bg,
        borderLeft: `1px solid ${t.border}`,
        boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
        transform: open ? "translateX(0)" : `translateX(${panelW}px)`,
        transition: "transform 0.25s cubic-bezier(.4,0,.2,1)",
        zIndex: 50,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${t.border}`,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>
              Source Cell
            </div>
            {target && (
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                {target.year} · {target.neighbourhood}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close cell viewer"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: t.textMuted, fontSize: 20, lineHeight: 1,
              padding: "4px 8px", borderRadius: 6,
            }}
          >
            ×
          </button>
        </div>

        {/* metric label pill */}
        {target?.metric && (
          <div style={{ padding: "10px 20px 0", flexShrink: 0 }}>
            <span style={{
              display: "inline-block",
              background: t.surfaceAlt, border: `1px solid ${t.border}`,
              borderRadius: 20, padding: "4px 12px",
              fontSize: 12, color: t.text, fontWeight: 500,
            }}>
              {target.metric}
            </span>
          </div>
        )}

        {/* table area */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 0 24px" }}>
          {loading && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
              Loading…
            </div>
          )}

          {error && (
            <div style={{ padding: "20px", color: "#c0392b", fontSize: 13 }}>
              Failed to load cell data: {error}
            </div>
          )}

          {data && !loading && (
            <table style={{
              borderCollapse: "collapse",
              fontSize: 12,
              width: "100%",
              tableLayout: "auto",
            }}>
              <thead>
                <tr>
                  {/* row-number gutter */}
                  <th style={thStyle(t, false, true)}>#</th>
                  {Object.keys(data.rows[0] || {}).map(col => (
                    <th
                      key={col}
                      style={thStyle(t, col === data.target_col, false)}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => {
                  const absIdx    = data.row_start + i;
                  const isTarget  = absIdx === data.target_df_idx;

                  return (
                    <tr
                      key={i}
                      style={{
                        background: isTarget ? `${t.accent}18` : "transparent",
                      }}
                    >
                      {/* row number */}
                      <td style={gutterStyle(t, isTarget)}>{absIdx + 1}</td>

                      {Object.entries(row).map(([col, val]) => {
                        const isHit = isTarget && col === data.target_col;
                        return (
                          <td
                            key={col}
                            ref={isHit ? targetCellRef : undefined}
                            style={cellStyle(t, isHit, col === data.target_col, isTarget)}
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

        {/* footer */}
        <div style={{
          padding: "10px 20px",
          borderTop: `1px solid ${t.border}`,
          flexShrink: 0,
          fontSize: 11, color: t.textMuted,
          display: "flex", gap: 16,
        }}>
          <span>Showing ±6 rows around match</span>
          <span style={{ marginLeft: "auto" }}>Press Esc to close</span>
        </div>
      </div>
    </>
  );
};

// ── style helpers ──────────────────────────────────────────────────────────────

function thStyle(t: Tokens, isTargetCol: boolean, isGutter: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    textAlign: isGutter ? "center" : "left",
    fontWeight: 600,
    whiteSpace: "nowrap",
    position: "sticky", top: 0,
    background: isTargetCol ? `${t.accent}22` : t.surfaceAlt,
    color: isTargetCol ? t.accent : t.textMuted,
    borderBottom: `2px solid ${isTargetCol ? t.accent : t.border}`,
    borderRight: `1px solid ${t.border}`,
    fontSize: 11,
    minWidth: isGutter ? 36 : 90,
  };
}

function gutterStyle(t: Tokens, isTargetRow: boolean): React.CSSProperties {
  return {
    padding: "5px 8px",
    textAlign: "center",
    color: isTargetRow ? t.accent : t.textMuted,
    fontWeight: isTargetRow ? 700 : 400,
    borderRight: `1px solid ${t.border}`,
    background: isTargetRow ? `${t.accent}10` : t.surfaceAlt,
    fontSize: 11,
  };
}

function cellStyle(
  t: Tokens,
  isHit: boolean,
  isTargetCol: boolean,
  isTargetRow: boolean,
): React.CSSProperties {
  return {
    padding: "5px 12px",
    borderBottom: `1px solid ${t.border}`,
    borderRight: `1px solid ${t.border}`,
    whiteSpace: "nowrap",
    color: isHit ? t.accent : t.text,
    fontWeight: isHit ? 700 : 400,
    background: isHit
      ? `${t.accent}30`
      : isTargetCol
      ? `${t.accent}08`
      : isTargetRow
      ? `${t.accent}10`
      : "transparent",
    outline: isHit ? `2px solid ${t.accent}` : "none",
    outlineOffset: -2,
  };
}