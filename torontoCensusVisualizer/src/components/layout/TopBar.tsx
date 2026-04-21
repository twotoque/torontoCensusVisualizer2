// Topbar.tsx
// Global top navigation bar.
// Accepts an optional `searchSlot` for per-page content in the centre.

import React from "react";
import { useNavigate } from "react-router-dom";
import { House } from "lucide-react";
import { type Theme } from "../../colours";

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1"  x2="12" y2="3"/>  <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1"  y1="12" x2="3"  y2="12"/> <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
  </svg>
);

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

interface TopBarProps {
  theme: Theme;
  onToggle: () => void;
  searchSlot?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ theme, onToggle, searchSlot }) => {
  const navigate = useNavigate();

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-4 bg-[var(--accent)] px-5 text-white shadow-[var(--shadow-md)]">
      <button
        type="button"
        onClick={() => navigate("/")}
        title="Home"
        aria-label="Home"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 text-sm font-bold tracking-wide transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
      >
        <span>Toronto Census Visualizer</span>
      </button>
      {searchSlot ? (
        <div className="flex flex-1 max-w-xl">{searchSlot}</div>
      ) : (
        <div className="flex flex-1" />
      )}
      <button
        onClick={onToggle}
        title="Toggle theme"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
      >
        {theme === "light" ? <IconMoon /> : <IconSun />}
      </button>
    </header>
  );
};
