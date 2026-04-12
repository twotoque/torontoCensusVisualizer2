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
            <Route path="/" element={<ChatPage />} />
            <Route path="/census" element={<CensusPage />} />
            <Route path="/prediction" element={<PredictionPage />} />
            <Route path="/compare" element={<ComparePage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
