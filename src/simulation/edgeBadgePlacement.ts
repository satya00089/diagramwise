import type {
  EdgeLabelNode,
  EdgeLabelRect,
  EdgePoint,
} from "../utils/edgeLabelLayout";

const GAP = 4;
export const EDGE_BADGE_HEIGHT = 22;

/**
 * Where to put the simulation badge for an edge that has its own label:
 * directly below the label, else right beside it (right, then left). `width`
 * is the badge's real width, so "beside" means touching distance, not far off.
 * Spots that overlap a node or another label are skipped. If every spot is
 * blocked, the badge goes below the label anyway.
 */
export function placeBadgeNearLabel(
  label: EdgeLabelRect,
  width: number,
  nodes: EdgeLabelNode[],
  labels: EdgeLabelRect[],
): EdgePoint {
  const height = EDGE_BADGE_HEIGHT;
  const candidates: EdgePoint[] = [
    {
      x: label.center.x,
      y: label.center.y + label.height / 2 + GAP + height / 2,
    },
    {
      x: label.center.x + label.width / 2 + GAP + width / 2,
      y: label.center.y,
    },
    {
      x: label.center.x - label.width / 2 - GAP - width / 2,
      y: label.center.y,
    },
  ];
  const obstacles: EdgeLabelRect[] = [
    ...nodes.map((node) => {
      const position = node.internals?.positionAbsolute ?? node.position;
      const w = node.measured?.width ?? node.width ?? 0;
      const h = node.measured?.height ?? node.height ?? 0;
      return {
        center: { x: position.x + w / 2, y: position.y + h / 2 },
        width: w,
        height: h,
      };
    }),
    ...labels,
  ];
  return (
    candidates.find((candidate) =>
      obstacles.every(
        (obstacle) =>
          Math.abs(candidate.x - obstacle.center.x) >=
            (width + obstacle.width) / 2 + GAP ||
          Math.abs(candidate.y - obstacle.center.y) >=
            (height + obstacle.height) / 2 + GAP,
      ),
    ) ?? candidates[0]
  );
}
