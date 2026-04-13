import React from "react";
import { type Message } from "./types";
import { type CellInfo, type CellTarget } from "../cell/CellViewer";

interface MessageBubbleProps {
  msg: Message;
  onSelect: (rowId: number, year: number, question: string) => void;
  onJumpToCell: (target: CellTarget) => void;
}

function getCellYears(cell: CellInfo): { year: number; row_id: number }[] {
  if (cell.years?.length) return cell.years;
  if (cell.year != null && cell.row_id != null) {
    return [{ year: cell.year, row_id: cell.row_id }];
  }
  return [];
}

function hasLargeScaleShift(content: string): boolean {
  // extract all year: value pairs from trend output
  const matches = [...content.matchAll(/(\d{4}):\s*([\d,]+\.?\d*)/g)];
  if (matches.length < 2) return false;

  const values = matches.map(m => parseFloat(m[2].replace(/,/g, "")));
  const max = Math.max(...values);
  const min = Math.min(...values);

  if (min <= 0) return false;
  return max / min > 8;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, onSelect, onJumpToCell }) => {
  const isUser = msg.role === "user";
  const isDisam = msg.role === "disambiguation";
  const baseBubble =
    "max-w-[66%] whitespace-pre-wrap rounded-3xl border px-4 py-3 text-sm leading-6 shadow-[var(--shadow)]";

  const bubbleClass = isDisam
    ? `${baseBubble} rounded-2xl border-[var(--disambig-border)] bg-[var(--disambig)] text-[var(--text)]`
    : isUser
      ? `${baseBubble} rounded-br-md bg-[var(--user-bubble)] border-[var(--border)] text-[var(--user-bubble-text)]`
      : `${baseBubble} rounded-bl-md bg-[var(--bot-bubble)] border-[var(--border)] text-[var(--bot-bubble-text)]`;

  return (
    <div className={`flex px-6 ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={bubbleClass}>
        {isDisam ? (
          <>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {msg.content}
            </div>
            {msg.options?.map((opt, i) => (
              <button
                key={i}
                onClick={() => onSelect(opt.row_id, opt.year, msg.question || "")}
                className="mb-2 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-alt)] last:mb-0"
              >
                {opt.document || opt.label} ({opt.year})
              </button>
            ))}
          </>
        ) : (
          <>
            {msg.content}

            <br></br>
            {msg.cell && getCellYears(msg.cell).map(({ year, row_id }) => (
              <button
                key={year}
                onClick={() => onJumpToCell({
                  year,
                  row_id,
                  neighbourhood: msg.cell!.columns[0],
                  metric: msg.cell!.row_label,
                })}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
              >
                ↗ Jump to cell ({year})
              </button>
            ))}
          </>
        )}
        {msg.role === "assistant" && hasLargeScaleShift(msg.content) && (
            <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
              <span>⚠</span>
              <span>Large variation detected — values may be from different metrics across years. Use Jump to Cell to verify.</span>
            </div>
          )}
      </div>
    </div>
  );
};
