export type ThemeMode = "light" | "dark";

const THEME_KEY = "vault_theme";

function inBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getStoredTheme(): ThemeMode | null {
  if (!inBrowser()) {
    return null;
  }

  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

export function getPreferredTheme(): ThemeMode {
  if (!inBrowser()) {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemeMode): void {
  if (!inBrowser()) {
    return;
  }

  const root = window.document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function setStoredTheme(theme: ThemeMode): void {
  if (!inBrowser()) {
    return;
  }

  window.localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function initializeTheme(): ThemeMode {
  const theme = getStoredTheme() ?? getPreferredTheme();
  applyTheme(theme);
  return theme;
}
