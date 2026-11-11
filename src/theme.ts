// Color theme: "auto" follows the OS setting, "light"/"dark" force a theme.
// The choice is applied as data-theme on <html> and remembered per browser.
import { useEffect, useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";

const KEY = "theme";

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    /* storage unavailable */
  }
  return "auto";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(readChoice);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  return { theme, setTheme };
}
