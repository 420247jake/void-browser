/**
 * Theme definitions for Void Browser
 * Each theme defines colors for the entire UI
 */

export interface VoidTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  fog: string;
  nodeAlive: string;
  nodeDead: string;
  text: string;
  textMuted: string;
  glow: string;
  particleColors: string[];
}

// Neon Cyan (Default)
export const THEME_CYAN: VoidTheme = {
  id: "cyan",
  name: "Neon Cyan",
  primary: "#4fc3f7",
  secondary: "#29b6f6",
  accent: "#00e5ff",
  background: "#0a0a1a",
  fog: "#0a0a1a",
  nodeAlive: "#4fc3f7",
  nodeDead: "#666666",
  text: "#4fc3f7",
  textMuted: "rgba(79, 195, 247, 0.6)",
  glow: "rgba(79, 195, 247, 0.4)",
  particleColors: ["#4fc3f7", "#00e5ff", "#29b6f6"],
};

// Neon Pink
export const THEME_PINK: VoidTheme = {
  id: "pink",
  name: "Neon Pink",
  primary: "#f06292",
  secondary: "#ec407a",
  accent: "#ff4081",
  background: "#0a0a1a",
  fog: "#0a0a1a",
  nodeAlive: "#f06292",
  nodeDead: "#666666",
  text: "#f06292",
  textMuted: "rgba(240, 98, 146, 0.6)",
  glow: "rgba(240, 98, 146, 0.4)",
  particleColors: ["#f06292", "#ff4081", "#ec407a"],
};

// Neon Green (Matrix)
export const THEME_GREEN: VoidTheme = {
  id: "green",
  name: "Matrix Green",
  primary: "#69f0ae",
  secondary: "#00e676",
  accent: "#00ff88",
  background: "#0a0a0a",
  fog: "#0a0a0a",
  nodeAlive: "#69f0ae",
  nodeDead: "#444444",
  text: "#69f0ae",
  textMuted: "rgba(105, 240, 174, 0.6)",
  glow: "rgba(105, 240, 174, 0.4)",
  particleColors: ["#69f0ae", "#00ff88", "#00e676"],
};

// Neon Purple
export const THEME_PURPLE: VoidTheme = {
  id: "purple",
  name: "Neon Purple",
  primary: "#b388ff",
  secondary: "#7c4dff",
  accent: "#ea80fc",
  background: "#0a0812",
  fog: "#0a0812",
  nodeAlive: "#b388ff",
  nodeDead: "#555555",
  text: "#b388ff",
  textMuted: "rgba(179, 136, 255, 0.6)",
  glow: "rgba(179, 136, 255, 0.4)",
  particleColors: ["#b388ff", "#ea80fc", "#7c4dff"],
};

// Neon Orange
export const THEME_ORANGE: VoidTheme = {
  id: "orange",
  name: "Solar Flare",
  primary: "#ffab40",
  secondary: "#ff9100",
  accent: "#ffd740",
  background: "#0a0808",
  fog: "#0a0808",
  nodeAlive: "#ffab40",
  nodeDead: "#555555",
  text: "#ffab40",
  textMuted: "rgba(255, 171, 64, 0.6)",
  glow: "rgba(255, 171, 64, 0.4)",
  particleColors: ["#ffab40", "#ffd740", "#ff9100"],
};

// Neon Red
export const THEME_RED: VoidTheme = {
  id: "red",
  name: "Blood Moon",
  primary: "#ff5252",
  secondary: "#ff1744",
  accent: "#ff8a80",
  background: "#0a0808",
  fog: "#0a0808",
  nodeAlive: "#ff5252",
  nodeDead: "#444444",
  text: "#ff5252",
  textMuted: "rgba(255, 82, 82, 0.6)",
  glow: "rgba(255, 82, 82, 0.4)",
  particleColors: ["#ff5252", "#ff8a80", "#ff1744"],
};

// Ice Blue
export const THEME_ICE: VoidTheme = {
  id: "ice",
  name: "Ice Crystal",
  primary: "#80deea",
  secondary: "#4dd0e1",
  accent: "#e0f7fa",
  background: "#051015",
  fog: "#051015",
  nodeAlive: "#80deea",
  nodeDead: "#556666",
  text: "#80deea",
  textMuted: "rgba(128, 222, 234, 0.6)",
  glow: "rgba(128, 222, 234, 0.4)",
  particleColors: ["#80deea", "#e0f7fa", "#4dd0e1"],
};

// Gold
export const THEME_GOLD: VoidTheme = {
  id: "gold",
  name: "Golden Age",
  primary: "#ffd54f",
  secondary: "#ffca28",
  accent: "#fff176",
  background: "#0a0908",
  fog: "#0a0908",
  nodeAlive: "#ffd54f",
  nodeDead: "#555544",
  text: "#ffd54f",
  textMuted: "rgba(255, 213, 79, 0.6)",
  glow: "rgba(255, 213, 79, 0.4)",
  particleColors: ["#ffd54f", "#fff176", "#ffca28"],
};

// All themes
export const ALL_THEMES: VoidTheme[] = [
  THEME_CYAN,
  THEME_PINK,
  THEME_GREEN,
  THEME_PURPLE,
  THEME_ORANGE,
  THEME_RED,
  THEME_ICE,
  THEME_GOLD,
];

// Get theme by ID
export function getTheme(id: string): VoidTheme {
  return ALL_THEMES.find(t => t.id === id) || THEME_CYAN;
}

// Default theme
export const DEFAULT_THEME = THEME_CYAN;
