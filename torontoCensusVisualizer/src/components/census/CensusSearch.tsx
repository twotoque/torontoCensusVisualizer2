import React, { useState } from "react";

interface CensusSearchProps {
  year: number;
  onSelect: (row: number) => void;
  apiBase?: string;
}

export const CensusSearch: React.FC<CensusSearchProps> = ({ year, onSelect, apiBase = "/api" }) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<
    { row_id: number; label: string; document?: string; year?: number }[]
  >([]);

  async function handleChange(q: string) {
    setInput(q);
    if (!q) {
      setSuggestions([]);
      return;
    }
    const d = await fetch(`${apiBase}/census/${year}/semantic-search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .catch(() => ({ results: [] }));
    setSuggestions(d.results || []);
  }

  function submit() {
    const n = parseInt(input);
    if (!isNaN(n)) {
      onSelect(n);
      setInput("");
      setSuggestions([]);
      return;
    }
    if (suggestions.length > 0) {
      onSelect(suggestions[0].row_id);
      setInput("");
      setSuggestions([]);
    }
  }

  return (
    <div className="relative flex w-full max-w-xl items-center gap-2">
      <input
        value={input}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="Search census variable..."
        className="h-8 flex-1 rounded-lg border border-white/30 bg-white/20 px-3 text-xs font-medium text-white placeholder:text-white/70 focus:border-white focus:outline-none"
      />
      <button
        onClick={submit}
        className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
      >
        Load
      </button>

      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)]">
          {suggestions.map(sg => (
            <li key={sg.row_id} className="border-b border-[var(--border)] last:border-0">
              <button
                type="button"
                onClick={() => {
                  onSelect(sg.row_id);
                  setInput(sg.label);
                  setSuggestions([]);
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
