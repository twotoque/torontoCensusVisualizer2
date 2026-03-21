import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, BarChart3 } from "lucide-react";
import { type Tokens } from "./colours";

interface SidebarProps {
  t: Tokens;
}

// enmoji icons placeholder
const NAV = [
  { id: "chat",   path: "/",       icon: "💬", label: "Ask" },
  { id: "census", path: "/census", icon: "📊", label: "Census Explorer" },
];

export const Sidebar: React.FC<SidebarProps> = ({ t }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav style={{
      width: 56, flexShrink: 0,
      background: t.surface, borderRight: `1px solid ${t.border}`,
      display: "flex", flexDirection: "column", alignItems: "center",
      paddingTop: 16, gap: 8,
    }}>
      {NAV.map(({ id, path, icon, label }) => {
        const active = location.pathname === path;
        return (
          <button
            key={id}
            title={label}
            onClick={() => navigate(path)}
            style={{
              width: 40, height: 40, borderRadius: 10, border: "none",
              background: active ? t.accent : "transparent",
              color:      active ? "#fff"   : t.textMuted,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", 
              transition: "all 0.15s ease",
              // Styling the text to look like a UI element
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "inherit"
            }}
          >
            {icon}
          </button>
        );
      })}
    </nav>
  );
};