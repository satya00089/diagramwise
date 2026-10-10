import type { Edge, Node } from "@xyflow/react";
import type { GuidedStep } from "../types/systemDesign";

export interface GuidedCanvas {
  nodes: Node[];
  edges: Edge[];
}

const rememberStep = (data: Record<string, unknown>, stepId: string) => ({
  ...data,
  _guidedAppliedSteps: Array.from(
    new Set([
      ...(Array.isArray(data._guidedAppliedSteps)
        ? data._guidedAppliedSteps
        : []),
      stepId,
    ]),
  ),
});

/** A viewed lesson is never applied evidence. This runs only on explicit acceptance. */
export function applyGuidedStep(
  canvas: GuidedCanvas,
  step: GuidedStep,
  createNode?: (step: GuidedStep) => Node,
): GuidedCanvas {
  if (step.type === "add_component" && step.component) {
    if (canvas.nodes.some((node) => node.id === step.component?.nodeId))
      return canvas;
    const component = step.component;
    const node = createNode?.(step) ?? {
      id: component.nodeId,
      type: "custom",
      position: component.position,
      data: {
        ...component.properties,
        purpose:
          component.properties.purpose ?? component.properties.description,
        componentId: component.componentType,
        label: component.label,
        subtitle: component.description,
      },
    };
    return {
      ...canvas,
      nodes: [
        ...canvas.nodes,
        { ...node, data: rememberStep(node.data, step.id) },
      ],
    };
  }
  if (step.type === "add_connection" && step.connection) {
    const connection = step.connection;
    if (canvas.edges.some((edge) => edge.id === connection.edgeId))
      return canvas;
    if (
      ![connection.sourceNodeId, connection.targetNodeId].every((id) =>
        canvas.nodes.some((node) => node.id === id),
      )
    )
      return canvas;
    return {
      ...canvas,
      edges: [
        ...canvas.edges,
        {
          id: connection.edgeId,
          source: connection.sourceNodeId,
          target: connection.targetNodeId,
          sourceHandle: "right",
          targetHandle: "left",
          type: "customEdge",
          data: rememberStep(
            {
              label: connection.label,
              purpose: connection.description,
              type: connection.connectionType,
              hasLabel: true,
            },
            step.id,
          ),
        },
      ],
    };
  }
  if (step.componentUpdate) {
    const update = step.componentUpdate;
    if (!canvas.nodes.some((node) => node.id === update.nodeId)) return canvas;
    return {
      ...canvas,
      nodes: canvas.nodes.map((node) =>
        node.id === update.nodeId
          ? {
              ...node,
              data: rememberStep(
                { ...node.data, ...update.properties },
                step.id,
              ),
            }
          : node,
      ),
    };
  }
  return canvas;
}

export function getAppliedGuidedSteps(canvas: GuidedCanvas): string[] {
  return Array.from(
    new Set(
      [...canvas.nodes, ...canvas.edges].flatMap((item) =>
        Array.isArray(item.data?._guidedAppliedSteps)
          ? item.data._guidedAppliedSteps.filter(
              (id): id is string => typeof id === "string",
            )
          : [],
      ),
    ),
  );
}
