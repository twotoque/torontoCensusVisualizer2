import React from "react";
import { type Message } from "./types";
import { type CellTarget } from "../cell/CellViewer";

interface MessageBubbleProps {
  msg: Message;
  onSelect: (rowId: number, year: number, question: string) => void;
  onJumpToCell: (target: CellTarget) => void;
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
            {msg.cell && (
              <button
                onClick={() =>
                  onJumpToCell({
                    year: msg.cell!.year,
                    row_id: msg.cell!.row_id,
                    neighbourhood: msg.cell!.columns[0],
                    metric: msg.cell!.row_label,
                  })
                }
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
              >
                ↗ Jump to cell
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
