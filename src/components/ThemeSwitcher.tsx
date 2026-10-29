import React from "react";
import { useTheme } from "../hooks/useTheme";
import { NavIcon } from "./navIcons/NavIcon";

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="nav-trigger p-2 rounded-full bg-[var(--bg)] text-[var(--text)] cursor-pointer"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      data-tooltip={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
    >
      {/* Shows the theme you would switch to, as before. */}
      <NavIcon
        name="theme"
        size={18}
        state={theme === "light" ? "moon" : "sun"}
      />
    </button>
  );
};

export default ThemeSwitcher;
