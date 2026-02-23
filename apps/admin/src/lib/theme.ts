export const ADMIN_THEME_KEY = "starter_admin_theme";

export type AdminTheme = "light" | "dark";

export function getSystemTheme(): AdminTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredTheme(): AdminTheme | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(ADMIN_THEME_KEY);
  return raw === "dark" || raw === "light" ? raw : null;
}

export function applyTheme(theme: AdminTheme) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function resolveInitialTheme(): AdminTheme {
  return getStoredTheme() ?? getSystemTheme();
}
