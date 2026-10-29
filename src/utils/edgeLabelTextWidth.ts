const widthCache = new Map<string, number>();
const heightCache = new Map<string, number>();
let context: CanvasRenderingContext2D | null | undefined;
let fontRevision = 0;
const fontListeners = new Set<() => void>();

const onFontsChanged = () => {
  widthCache.clear();
  heightCache.clear();
  fontRevision += 1;
  fontListeners.forEach((listener) => listener());
};

/** Notify edges when asynchronously loaded fonts can change text metrics. */
export function subscribeToEdgeLabelFonts(listener: () => void) {
  const firstSubscriber = fontListeners.size === 0;
  fontListeners.add(listener);
  if (firstSubscriber && typeof document !== "undefined") {
    document.fonts?.addEventListener("loadingdone", onFontsChanged);
    document.fonts?.addEventListener("loadingerror", onFontsChanged);
    // Fonts may have loaded while no edges were mounted or before subscription.
    onFontsChanged();
  }
  return () => {
    fontListeners.delete(listener);
    if (fontListeners.size === 0 && typeof document !== "undefined") {
      document.fonts?.removeEventListener("loadingdone", onFontsChanged);
      document.fonts?.removeEventListener("loadingerror", onFontsChanged);
    }
  };
}

export const getEdgeLabelFontRevision = () => fontRevision;

/** Resolve the font once per batch of label measurements. */
export function getEdgeLabelFont(): string | null {
  if (typeof document === "undefined" || !document.body) return null;
  const fontFamily =
    getComputedStyle(document.body).fontFamily || "Inter, sans-serif";
  return `11px ${fontFamily}`;
}

/** Measure labels consistently for the rendered edge and collision estimates. */
export function measureEdgeLabelText(
  label: string,
  font = getEdgeLabelFont(),
): number {
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

/** Measure word wrapping using the same box model as the displayed label. */
export function measureEdgeLabelHeight(
  label: string,
  width: number,
  font: string | null,
): number | null {
  if (!font || typeof document === "undefined" || !document.body) return null;
  const key = `${font}\0${width}\0${label}`;
  const cached = heightCache.get(key);
  if (cached !== undefined) return cached;
  const element = document.createElement("div");
  Object.assign(element.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    visibility: "hidden",
    font,
    lineHeight: "14px",
    padding: "2px 8px",
    border: "1px solid transparent",
    boxSizing: "border-box",
    width: `${width}px`,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "normal",
    display: "block",
  });
  element.textContent = label;
  document.body.appendChild(element);
  const height = element.getBoundingClientRect().height;
  element.remove();
  if (height <= 0) return null;
  if (heightCache.size >= 512) heightCache.clear();
  heightCache.set(key, height);
  return height;
}
