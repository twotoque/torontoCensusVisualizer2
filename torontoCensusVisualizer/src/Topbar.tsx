// Topbar.tsx
// Global top navigation bar.
// Accepts an optional `searchSlot` for per-page content in the centre.

import React from "react";
import { type Theme, type Tokens } from "./colours";

interface TopBarProps {
  t:            Tokens;
  theme:        Theme;
  onToggle:     () => void;
  searchSlot?:  React.ReactNode;
}

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

export const TopBar: React.FC<TopBarProps> = ({ t, theme, onToggle, searchSlot }) => (
  <header style={{
    display: "flex", alignItems: "center",
    padding: "0 20px", height: 52, gap: 16,
    background: t.accent, color: "#fff",
    boxShadow: t.shadowMd, flexShrink: 0, zIndex: 10,
  }}>
    {/* Title */}
    <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
      Toronto Census Visualizer
    </span>

    {/* Centre slot — injected per page */}
    {searchSlot && (
      <div style={{ flex: 1, maxWidth: 480 }}>
        {searchSlot}
      </div>
    )}

    {/* Spacer when no slot */}
    {!searchSlot && <div style={{ flex: 1 }} />}

    {/* Theme toggle */}
    <button
      onClick={onToggle}
      title="Toggle theme"
      style={{
        background: "rgba(255,255,255,0.15)", border: "none",
        borderRadius: 6, padding: "5px 8px", cursor: "pointer",
        color: "#fff", display: "flex", alignItems: "center",
        transition: "background 0.15s", flexShrink: 0,
      }}
    >
      {theme === "light" ? <IconMoon /> : <IconSun />}
    </button>
  </header>
);