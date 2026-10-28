import { Position, type Node } from "@xyflow/react";

/** Match the sides React Flow uses when an edge does not name a handle. */
export function getFallbackHandlePositions(source: Node, target: Node) {
  const sourcePosition =
    (
      source as Node & {
        internals?: { positionAbsolute?: { x: number; y: number } };
      }
    ).internals?.positionAbsolute ?? source.position;
  const targetPosition =
    (
      target as Node & {
        internals?: { positionAbsolute?: { x: number; y: number } };
      }
    ).internals?.positionAbsolute ?? target.position;
  const sourceSide =
    targetPosition.x >= sourcePosition.x ? Position.Right : Position.Left;
  return {
    sourcePosition: source.sourcePosition ?? sourceSide,
    targetPosition:
      target.targetPosition ??
      (sourceSide === Position.Right ? Position.Left : Position.Right),
  };
}

/** Resolve the same measured handle and endpoint React Flow uses in loose mode. */
export function getMeasuredHandleAnchor(
  node: Node,
  handleId: string | null | undefined,
  type: "source" | "target",
): { x: number; y: number; position: Position } | null {
  type Handle = {
    id?: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    position: Position;
  };
  const internals = (
    node as Node & {
      internals?: {
        positionAbsolute?: { x: number; y: number };
        handleBounds?: { source?: Handle[]; target?: Handle[] };
      };
    }
  ).internals;
  if (!internals?.handleBounds || !internals.positionAbsolute) return null;
  const bounds = internals.handleBounds;
  const handles =
    type === "source"
      ? (bounds.source ?? [])
      : [...(bounds.target ?? []), ...(bounds.source ?? [])];
  const handle = handleId
    ? handles.find((candidate) => candidate.id === handleId)
    : handles[0];
  if (!handle) return null;
  const x = internals.positionAbsolute.x + handle.x;
  const y = internals.positionAbsolute.y + handle.y;
  switch (handle.position) {
    case Position.Top:
      return { x: x + handle.width / 2, y, position: handle.position };
    case Position.Right:
      return {
        x: x + handle.width,
        y: y + handle.height / 2,
        position: handle.position,
      };
    case Position.Bottom:
      return {
        x: x + handle.width / 2,
        y: y + handle.height,
        position: handle.position,
      };
    case Position.Left:
      return { x, y: y + handle.height / 2, position: handle.position };
  }
}
