// App.tsx
// Root component. Reads the search slot from context and passes it to TopBar.
// No prop drilling — pages inject their own search via useSearchSlot().

import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { tokens, type Theme } from "./colours";
import { TopBar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { ChatPage } from "./ChatPage";
import { CensusPage } from "./CensusPage";
import { useSearchSlot } from "./SearchSlotContext";
import { PredictionPage } from "./PredictionPage";

export default function App() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "light"
  );
  const t = tokens[theme];
  const { slot } = useSearchSlot();

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      width: "100vw", height: "100vh",
      background: t.bg, color: t.text,
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      transition: "background 0.2s, color 0.2s",
    }}>
      {/* TopBar reads slot from context via App — no child-to-parent state */}
      <TopBar t={t} theme={theme} onToggle={toggleTheme} searchSlot={slot} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar t={t} />

        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Routes>
            <Route path="/"       element={<ChatPage   t={t} />} />
            <Route path="/census" element={<CensusPage t={t} />} />
            <Route path="/prediction" element={<PredictionPage t={t} />} />
          </Routes>
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}