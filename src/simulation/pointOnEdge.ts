import type { EdgePoint } from "../utils/edgeLabelLayout";

// Keep the badge clear of the node it leaves.
const MIN_FROM_SOURCE = 44;

/**
 * A point on the edge path where the simulation badge sits. The badge always
 * stays on its own edge, so it cannot drift away or jump between sides.
 * `fraction` is how far along the path from the source (0.5 = midpoint). A
 * badge nearer the source than MIN_FROM_SOURCE is pushed out, but never past
 * the midpoint. Returns null where SVG geometry is unavailable.
 */
export function pointOnEdge(
  path: string,
  fraction: number,
): EdgePoint | null {
  if (typeof document === "undefined") return null;
  const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
  element.setAttribute("d", path);
  if (typeof element.getTotalLength !== "function") return null;
  const length = element.getTotalLength();
  if (!Number.isFinite(length) || length <= 0) return null;
  const distance = Math.min(
    length * 0.5,
    Math.max(length * fraction, MIN_FROM_SOURCE),
  );
  const point = element.getPointAtLength(distance);
  return { x: point.x, y: point.y };
}
