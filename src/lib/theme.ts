// The theme choice lives in a cookie rather than localStorage so the server
// can put it on <html> in the first response: no flash of the wrong theme.

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "theme";

export function parseTheme(value: string | undefined): Theme {
  return THEMES.find((t) => t === value) ?? "system";
}

// The class on <html>. None for "system": the CSS follows the OS then.
export const themeClass = (theme: Theme) => (theme === "system" ? undefined : theme);
