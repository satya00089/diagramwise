import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { ColorMode } from "@xyflow/react";

export type Theme = "system" | "light" | "dark";

const isValidTheme = (v: unknown): v is Theme =>
  v === "system" || v === "light" || v === "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  flowColorMode: ColorMode;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  const storedTheme = localStorage.getItem("theme");
  if (isValidTheme(storedTheme)) return storedTheme;

  // Preserve the preference from the landing page before it joined the
  // shared application theme state.
  const legacyLandingTheme = localStorage.getItem("diagrammatic-landing-theme");
  return isValidTheme(legacyLandingTheme) && legacyLandingTheme !== "system"
    ? legacyLandingTheme
    : "light";
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Initialize theme state from localStorage immediately
    return getInitialTheme();
  });

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });

  useLayoutEffect(() => {
    const root = document.documentElement;

    const apply = (t: Theme) => {
      if (t === "system") {
        root.classList.toggle("dark", systemDark);
      } else {
        root.classList.toggle("dark", t === "dark");
      }
    };

    apply(theme);

    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme, systemDark]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Keep separate same-origin tabs aligned when one of them changes theme.
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== "theme") return;
      setTheme(isValidTheme(event.newValue) ? event.newValue : "light");
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // map to @xyflow/react ColorMode
  const flowColorMode = ((): ColorMode => {
    if (theme === "system") {
      return systemDark ? "dark" : "light";
    }
    return theme as ColorMode;
  })();

  const value = useMemo(
    () => ({ theme, setTheme, flowColorMode }),
    [flowColorMode, theme],
  );

  return createElement(ThemeContext.Provider, { value }, children);
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
