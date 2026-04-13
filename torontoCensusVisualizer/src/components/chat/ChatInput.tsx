import React, { useRef } from "react";

interface ChatInputProps {
  value: string;
  loading: boolean;
  hasMessages: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
  onClear: () => void;
  onToggleBuilder: () => void;
  showBuilder: boolean;
}

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  loading,
  hasMessages,
  onChange,
  onSend,
  onClear,
  onToggleBuilder,
  showBuilder
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disabled = loading || !value.trim();

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--bg)] px-6 pb-5 pt-3">
      <div className="flex items-end gap-2 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow)]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder="Ask about Toronto census data..."
          rows={1}
          className="min-h-6 max-h-40 flex-1 resize-none bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          style={{ overflowY: "auto" }}
        />
          <button
            onClick={onToggleBuilder}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
            aria-label="Prompt builder"
          >
            {/* grid icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
        <button
          onClick={onSend}
          disabled={disabled}
          aria-label="Send message"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
            disabled
              ? "cursor-default bg-[var(--surface-alt)] text-[var(--text-muted)]"
              : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
          }`}
        >
          <IconSend />
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>Shift+Enter for new line</span>
        {hasMessages && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            <IconTrash /> Clear history
          </button>
        )}
      </div>
    </div>
  );
};
