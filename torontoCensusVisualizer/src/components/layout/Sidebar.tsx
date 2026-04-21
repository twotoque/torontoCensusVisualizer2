import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BarChart3, FileSpreadsheet, LineChart, Map, MessageCircle } from "lucide-react";

const NAV = [
  { id: "ask", path: "/ask", icon: MessageCircle, label: "Ask" },
  { id: "census", path: "/census", icon: Map, label: "Census Explorer" },
  { id: "prediction", path: "/prediction", icon: LineChart, label: "Prediction" },
  { id: "compare", path: "/compare", icon: BarChart3, label: "Compare" },
  { id: "crossrow", path: "/crossrow", icon: FileSpreadsheet, label: "CrossRow" },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="flex w-14 flex-shrink-0 flex-col items-center gap-2 border-r border-[var(--border)] bg-[var(--surface)] py-4">
      {NAV.map(({ id, path, icon: Icon, label }) => {
        const active = location.pathname === path;
        return (
          <button
            key={id}
            title={label}
            aria-label={label}
            onClick={() => navigate(path)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              active
                ? "bg-[var(--accent)] text-white shadow"
                : "text-[var(--text-muted)] hover:bg-white/10"
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </nav>
  );
};
