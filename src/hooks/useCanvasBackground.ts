import { useCallback, useState } from "react";
import { BackgroundVariant } from "@xyflow/react";

/** Canvas background: a React Flow pattern, or none. */
export type CanvasBackground = BackgroundVariant | "none";

export const CANVAS_BACKGROUND_OPTIONS: ReadonlyArray<{
  value: CanvasBackground;
  label: string;
}> = [
  { value: BackgroundVariant.Dots, label: "Dots" },
  { value: BackgroundVariant.Lines, label: "Lines" },
  { value: BackgroundVariant.Cross, label: "Cross" },
  { value: "none", label: "None" },
];

const STORAGE_KEY = "canvas-background";

/** Accepts only known values, so a stale or edited stored value falls back to Dots. */
export function parseCanvasBackground(raw: string | null): CanvasBackground {
  return CANVAS_BACKGROUND_OPTIONS.some((option) => option.value === raw)
    ? (raw as CanvasBackground)
    : BackgroundVariant.Dots;
}

function readStoredBackground(): CanvasBackground {
  try {
    return parseCanvasBackground(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can be blocked (private mode, disabled site data). Use the default.
    return BackgroundVariant.Dots;
  }
}

/** The user's background choice, remembered in this browser. */
export function useCanvasBackground(): [
  CanvasBackground,
  (next: CanvasBackground) => void,
] {
  const [background, setBackground] =
    useState<CanvasBackground>(readStoredBackground);

  const update = useCallback((next: CanvasBackground) => {
    setBackground(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session.
    }
  }, []);

  return [background, update];
}
