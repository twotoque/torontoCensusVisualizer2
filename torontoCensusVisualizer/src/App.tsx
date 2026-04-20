import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { TopBar } from "./components/layout/TopBar";
import { Sidebar } from "./components/layout/Sidebar";
import { ChatPage } from "./pages/ChatPage";
import { CensusPage } from "./pages/CensusPage";
import { PredictionPage } from "./pages/PredictionPage";
import { useSearchSlot } from "./SearchSlotContext";
import {
  type Theme,
  applyThemeToDocument,
  detectSystemTheme,
  getStoredTheme,
  persistTheme,
} from "./colours";
import { ComparePage } from "./pages/ComparePage";
import { CrossRowStatsPage } from "./pages/CrossrowPage";
import { HomePage } from "./pages/HomePage";

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? detectSystemTheme());
  const { slot } = useSearchSlot();

  useEffect(() => {
    applyThemeToDocument(theme);
    persistTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-[var(--bg)] font-['DM_Sans','Helvetica_Neue',sans-serif] text-[var(--text)] transition-colors">
      <TopBar theme={theme} onToggle={toggleTheme} searchSlot={slot} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/ask" element={<ChatPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/census" element={<CensusPage />} />
            <Route path="/prediction" element={<PredictionPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/crossrow" element={<CrossRowStatsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
