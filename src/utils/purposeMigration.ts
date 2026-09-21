import type { ComponentProperty } from "../types/canvas";

export const PURPOSE_PLACEHOLDER =
  "What does this component do in the architecture?";
export const FLOW_PURPOSE_PLACEHOLDER =
  "What does this connection enable or carry?";

type PropertyLike = Pick<ComponentProperty, "key" | "label"> &
  Partial<ComponentProperty>;

/** True only for the generic architecture description property. */
export const isGenericPurposeProperty = (property: PropertyLike): boolean =>
  property.key === "purpose" ||
  (property.key === "description" && property.label === "Description");

/** Normalize catalog definitions without changing specialized Body/Content fields. */
export const normalizeComponentProperties = <T extends PropertyLike>(
  properties: T[],
): T[] =>
  properties.map((property) =>
    isGenericPurposeProperty(property)
      ? ({
          ...property,
          key: "purpose",
          label: "Purpose",
          placeholder: PURPOSE_PLACEHOLDER,
        } as T)
      : property,
  );

/** Read the canonical value while keeping old diagrams visible before migration. */
export const getPurposeValue = (data: Record<string, unknown>): unknown =>
  data.purpose ?? data.description;

/** Move a generic node's legacy value to purpose, preserving specialized descriptions. */
export const normalizeNodeDataPurpose = (
  data: Record<string, unknown>,
  properties: PropertyLike[],
): Record<string, unknown> => {
  const hasGenericPurpose = properties.some(isGenericPurposeProperty);
  if (!hasGenericPurpose) return data;

  const normalized = { ...data };
  if (normalized.purpose === undefined && normalized.description !== undefined) {
    normalized.purpose = normalized.description;
  }
  delete normalized.description;
  return normalized;
};

/** Normalize edge data independently because edges have no component schema. */
export const normalizeEdgeDataPurpose = (
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const normalized = { ...data };
  if (normalized.purpose === undefined && normalized.description !== undefined) {
    normalized.purpose = normalized.description;
  }
  delete normalized.description;
  return normalized;
};

