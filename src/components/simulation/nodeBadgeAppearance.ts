import type { CSSProperties } from "react";

export type NodeBadgeAppearance = {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
};

type Rgba = { red: number; green: number; blue: number; alpha: number };
let colorContext: CanvasRenderingContext2D | null | undefined;

function parseColor(color: string): Rgba | undefined {
  const hex = /^#((?:[\da-f]{3,4}){1,2})$/i.exec(color);
  if (hex) {
    const digits =
      hex[1].length <= 4
        ? [...hex[1]].map((character) => character + character).join("")
        : hex[1];
    return {
      red: Number.parseInt(digits.slice(0, 2), 16),
      green: Number.parseInt(digits.slice(2, 4), 16),
      blue: Number.parseInt(digits.slice(4, 6), 16),
      alpha:
        digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1,
    };
  }
  const rgb =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(
      color,
    );
  if (rgb)
    return {
      red: Number(rgb[1]),
      green: Number(rgb[2]),
      blue: Number(rgb[3]),
      alpha: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  // Computed colors in modern color spaces can be resolved by the browser.
  if (typeof document === "undefined") return undefined;
  colorContext ??= document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (
    !colorContext ||
    (typeof CSS !== "undefined" && !CSS.supports("color", color))
  )
    return undefined;
  colorContext.clearRect(0, 0, 1, 1);
  colorContext.fillStyle = color;
  colorContext.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = colorContext.getImageData(0, 0, 1, 1).data;
  return { red, green, blue, alpha: alpha / 255 };
}

/** Choose black or white against backgrounds in front-to-back order. */
export function getContrastForeground(backgrounds: string[]): string {
  const composite = [0, 0, 0];
  let opacity = 0;
  for (const background of backgrounds) {
    const color = parseColor(background);
    if (!color) continue;
    const weight = Math.max(0, Math.min(1, color.alpha)) * (1 - opacity);
    composite[0] += color.red * weight;
    composite[1] += color.green * weight;
    composite[2] += color.blue * weight;
    opacity += weight;
    if (opacity >= 0.999) break;
  }
  // A transparent document is rendered over the browser's white canvas.
  const channels = composite.map((component) => {
    const value = (component + 255 * (1 - opacity)) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}

/** Read the actual layers behind a badge, including translucent node fills. */
export function getElementContrastForeground(element: HTMLElement): string {
  const backgrounds: string[] = [];
  let current: HTMLElement | null = element;
  while (current) {
    const background = getComputedStyle(current).backgroundColor;
    backgrounds.push(background);
    if (parseColor(background)?.alpha === 1) break;
    current = current.parentElement;
  }
  return getContrastForeground(backgrounds);
}

export function getNodeBadgeAppearance(
  appearance: NodeBadgeAppearance,
  calculatedForeground?: string,
) {
  const background = appearance.backgroundColor?.trim();
  const border = appearance.borderColor?.trim();
  const explicitForeground = appearance.textColor?.trim();
  const parsedBackground =
    background && !explicitForeground && !calculatedForeground
      ? parseColor(background)
      : undefined;
  const foreground =
    explicitForeground ||
    calculatedForeground ||
    (background && parsedBackground?.alpha === 1
      ? getContrastForeground([background])
      : undefined);
  const style: CSSProperties & Record<`--${string}`, string> = {};
  if (background) style["--sim-badge-background"] = background;
  if (border) style["--sim-badge-border"] = border;
  if (foreground) style["--sim-badge-foreground"] = foreground;
  return { style, customForeground: Boolean(foreground) };
}
