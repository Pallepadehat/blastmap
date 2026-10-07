"use client";

import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { THEME_COOKIE, THEMES, themeClass, type Theme } from "@/lib/theme";

const YEAR = 60 * 60 * 24 * 365;

// Applies the choice to <html> at once and remembers it in a cookie for the
// next server render. No request: nothing on the server needs to know now.
export function ThemeControl({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);

  const choose = (next: Theme) => {
    setTheme(next);
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    const cls = themeClass(next);
    if (cls) root.classList.add(cls);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${YEAR}; samesite=lax`;
  };

  return (
    <ToggleGroup
      value={[theme]}
      onValueChange={(v) => {
        const next = THEMES.find((t) => t === v[0]);
        if (next) choose(next);
      }}
      size="sm"
      variant="outline"
      aria-label="Theme"
    >
      {THEMES.map((t) => (
        <ToggleGroupItem key={t} value={t} className="px-2 text-xs">
          {t}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
