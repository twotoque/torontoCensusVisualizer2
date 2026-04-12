import React from "react";

interface YearTabsProps {
  years: number[];
  active: number;
  onSelect: (y: number) => void;
}

export const YearTabs: React.FC<YearTabsProps> = ({ years, active, onSelect }) => (
  <div className="flex gap-1">
    {years.map(y => (
      <button
        key={y}
        onClick={() => onSelect(y)}
        className={`rounded-t-lg px-3 py-1 text-xs font-semibold transition ${
          y === active
            ? "bg-[var(--accent)] text-white shadow-sm"
            : "text-[var(--text-muted)] hover:bg-white/10"
        }`}
      >
        {y}
      </button>
    ))}
  </div>
);
