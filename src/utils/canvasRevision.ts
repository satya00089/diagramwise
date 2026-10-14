import type { Edge, Node } from "@xyflow/react";

/** Persisted canvas edits, excluding selection, dragging and renderer measurements. */
export const getCanvasNodesRevision = (nodes: Node[]): string =>
  JSON.stringify(
    nodes.map(
      ({
        id,
        type,
        parentId,
        position,
        width,
        height,
        style,
        data,
        hidden,
      }) => ({
        id,
        type,
        parentId,
        position,
        width,
        height,
        style,
        data,
        hidden,
      }),
    ),
  );

export const getCanvasEdgesRevision = (edges: Edge[]): string =>
  JSON.stringify(
    edges.map(
      ({
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        type,
        data,
        label,
        hidden,
        markerStart,
        markerEnd,
        style,
      }) => ({
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        type,
        data,
        label,
        hidden,
        markerStart,
        markerEnd,
        style,
      }),
    ),
  );

export const getCanvasRevision = (nodes: Node[], edges: Edge[]): string =>
  JSON.stringify([
    getCanvasNodesRevision(nodes),
    getCanvasEdgesRevision(edges),
  ]);
