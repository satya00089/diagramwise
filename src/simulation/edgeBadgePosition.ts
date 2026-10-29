import type {
  EdgeLabelNode,
  EdgeLabelRect,
  EdgePoint,
} from "../utils/edgeLabelLayout";

/** Prefer below the label, falling back to other sides when nodes block it. */
export function edgeBadgePosition(
  label: EdgeLabelRect,
  nodes: EdgeLabelNode[],
  labels: EdgeLabelRect[],
): EdgePoint {
  const gap = 4;
  const width = 260; // Reserve enough space for the longest simulation warning.
  const height = 22;
  const candidates = [
    {
      x: label.center.x,
      y: label.center.y + label.height / 2 + gap + height / 2,
    },
    {
      x: label.center.x,
      y: label.center.y - label.height / 2 - gap - height / 2,
    },
    {
      x: label.center.x + label.width / 2 + gap + width / 2,
      y: label.center.y,
    },
    {
      x: label.center.x - label.width / 2 - gap - width / 2,
      y: label.center.y,
    },
  ];
  const obstacles = [
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
            (width + obstacle.width) / 2 + gap ||
          Math.abs(candidate.y - obstacle.center.y) >=
            (height + obstacle.height) / 2 + gap,
      ),
    ) ?? candidates[0]
  );
}
