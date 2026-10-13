type ERTableNodeData = {
  componentId?: unknown;
  nodeType?: unknown;
  dataModel?: {
    kind?: unknown;
    paradigm?: unknown;
  };
};

const ER_TABLE_IDENTIFIERS = new Set([
  "entity",
  "weak-entity",
  "er-view",
  "view",
]);

const CONTENT_SIZED_TABLE_IDENTIFIERS = new Set([
  ...ER_TABLE_IDENTIFIERS,
  "uml-class",
  "uml-interface",
  "uml-abstract-class",
  "uml-enum",
]);

const getNodeIdentifiers = (data: ERTableNodeData | null | undefined) => {
  const componentId =
    typeof data?.componentId === "string" ? data.componentId : undefined;
  const nodeType =
    typeof data?.nodeType === "string" ? data.nodeType : undefined;

  return [componentId, nodeType].filter((identifier): identifier is string =>
    Boolean(identifier),
  );
};

/** Table-like nodes that should grow to their content instead of scrolling. */
export const isContentSizedTableNode = (
  data: ERTableNodeData | null | undefined,
): boolean => {
  if (data?.dataModel?.kind && data?.dataModel?.paradigm) return true;
  return getNodeIdentifiers(data).some((identifier) =>
    CONTENT_SIZED_TABLE_IDENTIFIERS.has(identifier),
  );
};

/**
 * ER tables share field-level handles and content-sized rendering, regardless
 * of whether the source component is an entity, weak entity, or view.
 */
export const isFieldAddressableERTable = (
  data: ERTableNodeData | null | undefined,
): boolean =>
  getNodeIdentifiers(data).some((identifier) =>
    ER_TABLE_IDENTIFIERS.has(identifier),
  );
