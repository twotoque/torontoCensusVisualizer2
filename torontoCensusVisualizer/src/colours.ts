// tokens.ts
// Shared design tokens for light and dark themes.
// Import { tokens, type Theme } wherever you need colours.

export type Theme = "light" | "dark";

export const tokens = {
  light: {
    bg:              "#F7F5F0",
    surface:         "#FFFFFF",
    surfaceAlt:      "#F0EDE8",
    border:          "#E2DDD8",
    text:            "#1A1714",
    textMuted:       "#7A736C",
    accent:          "#4B6CB7",
    accentHover:     "#3A5A9E",
    userBubble:      "#E8EDF7",
    userBubbleText:  "#1A1714",
    botBubble:       "#FFFFFF",
    botBubbleText:   "#1A1714",
    disambig:        "#FDF6E3",
    disambigBorder:  "#E8D5A0",
    shadow:          "0 1px 3px rgba(0,0,0,0.08)",
    shadowMd:        "0 4px 12px rgba(0,0,0,0.10)",
  },
  dark: {
    bg:              "#141210",
    surface:         "#1E1C19",
    surfaceAlt:      "#252220",
    border:          "#2E2B27",
    text:            "#EDE9E3",
    textMuted:       "#8A837B",
    accent:          "#6B8DD6",
    accentHover:     "#82A0E0",
    userBubble:      "#2A3147",
    userBubbleText:  "#EDE9E3",
    botBubble:       "#252220",
    botBubbleText:   "#EDE9E3",
    disambig:        "#2A2416",
    disambigBorder:  "#4A3E20",
    shadow:          "0 1px 3px rgba(0,0,0,0.30)",
    shadowMd:        "0 4px 12px rgba(0,0,0,0.40)",
  },
} as const;

export type Tokens = typeof tokens.light;