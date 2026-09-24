export type NodePresentationData = {
  source?: unknown;
  label?: unknown;
  componentName?: unknown;
  componentId?: unknown;
};

const textValue = (value: unknown): string =>
  typeof value === "string" && value.trim() ? value.trim() : "";

/**
 * MCP nodes carry an explicit semantic label alongside the generic catalog
 * component name. Keep the existing componentName-first behavior for older
 * diagrams and use label-first only for MCP-generated nodes.
 */
export const getNodeDisplayLabel = (data: NodePresentationData): string => {
  const label = textValue(data.label);
  const componentName = textValue(data.componentName);
  const componentId = textValue(data.componentId);

  if (data.source === "diagramwise-mcp") {
    return label || componentName || componentId || "Untitled component";
  }

  return componentName || label || componentId || "Untitled component";
};
