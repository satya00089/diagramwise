import React from "react";
import { Background, useStore, type BackgroundVariant } from "@xyflow/react";
import { useTheme } from "../hooks/useTheme";

/** Pattern lines are this thick on screen, whatever the zoom level. */
const LINE_WIDTH_PX = 0.75;

/** Softer than React Flow's default grey, so the pattern stays in the background. */
const PATTERN_COLOR = { light: "#dcdce1", dark: "#34343c" } as const;

/**
 * Canvas background pattern. React Flow draws pattern lines in canvas units, so they
 * look heavier when zoomed out. Dividing by the zoom level keeps them the same width
 * on screen.
 */
const CanvasBackgroundLayer: React.FC<{ variant: BackgroundVariant }> = ({ variant }) => {
  const zoom = useStore((state) => state.transform[2]);
  const { flowColorMode } = useTheme();
  const lineWidth = LINE_WIDTH_PX / Math.max(zoom, 0.05);

  return (
    <Background
      gap={16}
      variant={variant}
      lineWidth={lineWidth}
      color={PATTERN_COLOR[flowColorMode === "dark" ? "dark" : "light"]}
    />
  );
};

export default CanvasBackgroundLayer;
