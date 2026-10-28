const widthCache = new Map<string, number>();
let context: CanvasRenderingContext2D | null | undefined;

/** Resolve the font once per batch of label measurements. */
export function getEdgeLabelFont(): string | null {
  if (typeof document === "undefined" || !document.body) return null;
  const fontFamily =
    getComputedStyle(document.body).fontFamily || "Inter, sans-serif";
  return `11px ${fontFamily}`;
}

/** Measure labels consistently for the rendered edge and collision estimates. */
export function measureEdgeLabelText(label: string, font = getEdgeLabelFont()): number {
  const fallback = Math.max(6, label.length * 6);
  if (!font) return fallback;
  const key = `${font}\0${label}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return fallback;
  context.font = font;
  const width = context.measureText(label).width;
  if (widthCache.size >= 512) widthCache.clear();
  widthCache.set(key, width);
  return width;
}
