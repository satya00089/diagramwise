import {
  parseMermaidEdge,
  scanMermaidLine,
  splitSqlDefinitions,
} from "./sourceScanning";
import type { Edge, Node } from "@xyflow/react";
import type { ExtensionImportResult, ExtensionKind } from "../types/extensions";
import { COMPONENTS } from "../config/components";

type TableAttribute = {
  id: string;
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isUnique?: boolean;
  isNullable?: boolean;
};

type SchemaRelationship = {
  childId: string;
  parentTableName: string;
  childColumns: string[];
  parentColumns: string[];
};

const makeFieldHandleId = (attributeId: string, side: "left" | "right") =>
  `field:${attributeId}:${side}`;

const getRelationshipHandle = (
  fieldIds: string[],
  side: "left" | "right",
): string => (fieldIds[0] ? makeFieldHandleId(fieldIds[0], side) : side);

const getFieldRelationshipData = (
  fieldIds: string[],
  prefix: "source" | "target",
): Record<string, unknown> => {
  const fieldId = fieldIds[0];
  return fieldId
    ? {
        [`${prefix}FieldId`]: fieldId,
        [`${prefix}FieldIds`]: fieldIds,
      }
    : {};
};

const normalizeColumnList = (value?: string): string[] =>
  value
    ? value
        .split(",")
        .map((column) => normalizeSqlIdentifier(column))
        .filter(Boolean)
    : [];

const cleanLabel = (value: string): string =>
  value
    .replaceAll(/^['"]|['"]$/g, "")
    .replaceAll(/<br\s*\/?>(\s*)/gi, " ")
    .trim();

const makeId = (prefix: string, value: string, index: number): string =>
  `${prefix}-${value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-") || index}`;

const layoutNodes = (nodes: Node[]): Node[] => {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % columns) * 280,
      y: Math.floor(index / columns) * 190,
    },
  }));
};

const normalizeComponentName = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeSqlIdentifier = (value: string): string =>
  value
    .trim()
    .replaceAll(/["`[\]]/g, "")
    .split(".")
    .map((part) => part.trim())
    .join(".")
    .toLowerCase();

const sqlIdentifierPart = '"(?:[^"]|"")+"|`[^`]+`|\\[[^\\]]+\\]|[\\w$#-]+';
const sqlIdentifier = String.raw`(?:${sqlIdentifierPart})(?:\s*\.\s*(?:${sqlIdentifierPart}))*`;
const sqlReferenceClause = String.raw`references\s+(${sqlIdentifier})\s*(?:\(([^)]+)\))?`;
const createTablePattern = new RegExp(
  String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?(${sqlIdentifier})\s*\(([^;]*)\)\s*(?:[^;]*)?;?`,
  "gis",
);
const tablePrimaryKeyPattern = /primary\s+key\s*\(([^)]+)\)/i;
const foreignKeyPattern = new RegExp(
  String.raw`foreign\s+key\s*\(([^)]+)\)\s*${sqlReferenceClause}`,
  "i",
);
const columnPattern = new RegExp(
  String.raw`^(${sqlIdentifierPart})\s+([\w]+(?:\s*\([^)]*\))?)`,
  "i",
);
const inlineReferencePattern = new RegExp(sqlReferenceClause, "i");
const deferredForeignKeyPattern = new RegExp(
  String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${sqlIdentifier})\s+add\s+(?:constraint\s+(?:${sqlIdentifierPart})\s+)?foreign\s+key\s*\(([^)]+)\)\s*${sqlReferenceClause}`,
  "gis",
);

const resolveLocalComponent = (key: string, label: string) => {
  const candidates = [key, label].map(normalizeComponentName);
  const exactMatch = COMPONENTS.find((component) =>
    candidates.some(
      (candidate) =>
        candidate === normalizeComponentName(component.id) ||
        candidate === normalizeComponentName(component.label),
    ),
  );
  if (exactMatch) return exactMatch;

  const haystack = candidates.join(" ");
  let preferredId: "api-gateway" | "database" | undefined;
  if (/\b(api gateway|gateway)\b/.test(haystack)) {
    preferredId = "api-gateway";
  } else if (
    /\b(database|db|postgres|postgresql|mysql|mongodb|redis)\b/.test(haystack)
  ) {
    preferredId = "database";
  }

  return preferredId
    ? COMPONENTS.find((component) => component.id === preferredId)
    : undefined;
};

const entityRenderConfig = COMPONENTS.find(
  (component) => component.id === "entity",
)?.renderConfig;

const parseMermaid = (source: string): ExtensionImportResult => {
  const nodesByKey = new Map<string, Node>();
  const edges: Edge[] = [];
  const warnings: string[] = [];
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.split("%%", 1)[0].trim())
    .filter(Boolean);

  if (
    !lines.some((line) =>
      /^(flowchart|graph|sequenceDiagram|erDiagram)\b/i.test(line),
    )
  ) {
    warnings.push("Add a Mermaid diagram declaration such as `flowchart LR`.");
  }

  const ensureNode = (key: string, label?: string) => {
    const normalizedKey = key.trim();
    if (
      !normalizedKey ||
      /^(subgraph|end|flowchart|graph)$/i.test(normalizedKey)
    ) {
      return;
    }
    const resolvedLabel = cleanLabel(label || normalizedKey);
    const localComponent = resolveLocalComponent(normalizedKey, resolvedLabel);
    const subtitle = localComponent?.description ?? "Microservice";
    const existingNode = nodesByKey.get(normalizedKey);
    if (existingNode) {
      if (label) {
        const existingData = { ...existingNode.data };
        delete existingData.componentId;
        delete existingData.architectureType;
        existingNode.data = {
          ...existingData,
          label: resolvedLabel,
          subtitle,
          ...(localComponent
            ? { componentId: localComponent.id }
            : { architectureType: "microservice" }),
        };
      }
      return;
    }

    nodesByKey.set(normalizedKey, {
      id: makeId("mermaid", normalizedKey, nodesByKey.size),
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        label: resolvedLabel,
        subtitle,
        ...(localComponent
          ? { componentId: localComponent.id }
          : { architectureType: "microservice" }),
        extensionSource: "mermaid",
        extensionSourceKey: normalizedKey,
      },
    });
  };

  const addEdge = (edge: ReturnType<typeof parseMermaidEdge>) => {
    if (edge && edge.source !== edge.target) {
      ensureNode(edge.source);
      ensureNode(edge.target);
      const sourceNode = nodesByKey.get(edge.source);
      const targetNode = nodesByKey.get(edge.target);
      if (sourceNode && targetNode) {
        edges.push({
          id: `mermaid-edge-${edges.length}`,
          source: sourceNode.id,
          sourceHandle: "right",
          target: targetNode.id,
          targetHandle: "left",
          type: "customEdge",
          label: edge.label ? cleanLabel(edge.label) : undefined,
          data: {
            extensionSource: "mermaid",
            extensionSourceKey: `${edge.source}-${edge.target}`,
          },
        });
      }
    }
  };
  for (const line of lines) {
    const { declarations, edgeSource } = scanMermaidLine(line);
    for (const declaration of declarations)
      ensureNode(declaration.key, declaration.label);
    addEdge(parseMermaidEdge(edgeSource));
  }

  if (nodesByKey.size === 0) {
    throw new Error(
      "No Mermaid nodes were recognized. Check the syntax and try again.",
    );
  }

  const nodes = layoutNodes(Array.from(nodesByKey.values()));
  const catalogMatches = nodes.filter(
    (node) => typeof node.data.componentId === "string",
  ).length;
  return {
    nodes,
    edges,
    warnings,
    summary: `${nodes.length} nodes and ${edges.length} connections recognized`,
    catalogMatches,
    fallbackNodes: nodes.length - catalogMatches,
  };
};

const parseTableBody = (
  tableName: string,
  body: string,
  warnings: string[],
) => {
  const attributes: TableAttribute[] = [];
  const primaryColumns = new Set<string>();
  const foreignKeyColumns = new Set<string>();
  const uniqueColumns = new Set<string>();
  const inlineForeignKeys: Array<{
    columns: string[];
    parentColumns: string[];
    target: string;
  }> = [];

  const parseDefinition = (rawLine: string) => {
    const line = rawLine.trim().replaceAll(/[\r\n]+/g, " ");
    if (!line) return;
    const tablePrimaryKey = tablePrimaryKeyPattern.exec(line);
    if (tablePrimaryKey) {
      tablePrimaryKey[1]
        .split(",")
        .forEach((column) =>
          primaryColumns.add(normalizeSqlIdentifier(column)),
        );
      return;
    }
    const tableUnique = /\bunique\s*\(([^)]+)\)/i.exec(line);
    if (tableUnique) {
      normalizeColumnList(tableUnique[1]).forEach((column) =>
        uniqueColumns.add(column),
      );
      return;
    }
    const foreignKey = foreignKeyPattern.exec(line);
    if (foreignKey) {
      const columns = normalizeColumnList(foreignKey[1]);
      columns.forEach((name) => {
        foreignKeyColumns.add(name);
      });
      inlineForeignKeys.push({
        columns,
        parentColumns: normalizeColumnList(foreignKey[3]),
        target: foreignKey[2],
      });
      return;
    }
    if (/^(constraint|unique|check|primary\s+key)/i.test(line)) return;
    const column = columnPattern.exec(line);
    if (!column) {
      warnings.push(`Skipped an unrecognized definition in ${tableName}.`);
      return;
    }
    const name = normalizeSqlIdentifier(column[1]);
    attributes.push({
      id: `${tableName}-${name}`,
      name,
      type: column[2].toUpperCase(),
      isPrimaryKey: /primary\s+key/i.test(line),
      isUnique: /\bunique\b/i.test(line),
      isNullable: !/not\s+null/i.test(line),
    });
    if (/primary\s+key/i.test(line)) {
      primaryColumns.add(name);
    }
    if (/\bunique\b/i.test(line)) uniqueColumns.add(name);
    const inlineReference = inlineReferencePattern.exec(line);
    if (inlineReference) {
      foreignKeyColumns.add(name);
      inlineForeignKeys.push({
        columns: [name],
        parentColumns: normalizeColumnList(inlineReference[2]),
        target: inlineReference[1],
      });
    }
  };
  splitSqlDefinitions(body).forEach(parseDefinition);

  attributes.forEach((attribute) => {
    if (primaryColumns.has(attribute.name)) {
      attribute.isPrimaryKey = true;
      // SQL primary keys are inherently NOT NULL, even when the DDL omits it.
      attribute.isNullable = false;
    }
    if (foreignKeyColumns.has(attribute.name)) attribute.isForeignKey = true;
    if (uniqueColumns.has(attribute.name)) attribute.isUnique = true;
  });

  return { attributes, inlineForeignKeys };
};

const parseDatabaseSchema = (source: string): ExtensionImportResult => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const warnings: string[] = [];
  const tableIds = new Map<string, string>();
  const relationships: SchemaRelationship[] = [];
  const attributesByTableId = new Map<string, TableAttribute[]>();
  const tableBlocks = source.matchAll(createTablePattern);

  for (const [index, match] of Array.from(tableBlocks).entries()) {
    const tableName = match[1];
    const body = match[2];
    const { attributes, inlineForeignKeys } = parseTableBody(
      tableName,
      body,
      warnings,
    );
    const id = makeId("table", tableName, index);
    tableIds.set(normalizeSqlIdentifier(tableName), id);
    attributesByTableId.set(id, attributes);
    nodes.push({
      id,
      type: "tableNode",
      position: { x: 0, y: 0 },
      data: {
        label: tableName,
        componentName: tableName,
        attributes,
        nodeType: "entity",
        componentId: "entity",
        renderConfig: entityRenderConfig,
        extensionSource: "database-schema",
      },
    });

    inlineForeignKeys.forEach((relation) => {
      relationships.push({
        childId: id,
        parentTableName: relation.target,
        childColumns: relation.columns,
        parentColumns: relation.parentColumns,
      });
    });
  }

  // pgAdmin exports relationships separately, after all CREATE TABLE blocks:
  // ALTER TABLE IF EXISTS public.orders ADD CONSTRAINT ... FOREIGN KEY (...)
  // REFERENCES public.users (...). Parse those constraints in a second pass so
  // forward references and schema-qualified names both resolve correctly.
  const deferredForeignKeys = source.matchAll(deferredForeignKeyPattern);
  for (const foreignKey of deferredForeignKeys) {
    const childTable = foreignKey[1];
    const parentTable = foreignKey[3];
    const childId = tableIds.get(normalizeSqlIdentifier(childTable));
    if (!childId) {
      warnings.push(`Could not find table ${childTable} for a foreign key.`);
      continue;
    }

    const attributes = attributesByTableId.get(childId) ?? [];
    const columns = normalizeColumnList(foreignKey[2]);
    columns.forEach((column) => {
      const attribute = attributes.find(
        (candidate) => normalizeSqlIdentifier(candidate.name) === column,
      );
      if (attribute) attribute.isForeignKey = true;
    });
    relationships.push({
      childId,
      parentTableName: parentTable,
      childColumns: columns,
      parentColumns: normalizeColumnList(foreignKey[4]),
    });
  }

  if (nodes.length === 0) {
    throw new Error(
      "No CREATE TABLE statements were recognized. Paste a supported SQL schema.",
    );
  }
  const childIdsByParent = new Map<string, string[]>();
  const inDegree = new Map(nodes.map((node) => [node.id, 0]));

  const findRelationshipAttributes = (
    tableId: string,
    columns: string[],
    fallbackToPrimary: boolean,
  ): TableAttribute[] => {
    const attributes = attributesByTableId.get(tableId) ?? [];
    const matches = columns.flatMap((column) => {
      const attribute = attributes.find(
        (candidate) => normalizeSqlIdentifier(candidate.name) === column,
      );
      return attribute ? [attribute] : [];
    });
    if (matches.length > 0 || !fallbackToPrimary) return matches;

    const primaryAttributes = attributes.filter(
      (attribute) => attribute.isPrimaryKey,
    );
    return (
      primaryAttributes.length > 0 ? primaryAttributes : attributes
    ).slice(0, 1);
  };

  relationships.forEach((relationship) => {
    const parentId = tableIds.get(
      normalizeSqlIdentifier(relationship.parentTableName),
    );
    if (!parentId) {
      warnings.push(
        `Could not link ${relationship.childColumns.join(", ")}: table ${relationship.parentTableName} was not found.`,
      );
      return;
    }

    const sourceAttributes = findRelationshipAttributes(
      parentId,
      relationship.parentColumns,
      true,
    );
    const targetAttributes = findRelationshipAttributes(
      relationship.childId,
      relationship.childColumns,
      false,
    );
    const sourceFieldIds = sourceAttributes.map((attribute) => attribute.id);
    const targetFieldIds = targetAttributes.map((attribute) => attribute.id);
    const relationshipLabel = relationship.childColumns.join(", ");

    edges.push({
      id: `schema-edge-${edges.length}`,
      source: parentId,
      sourceHandle: getRelationshipHandle(sourceFieldIds, "right"),
      target: relationship.childId,
      targetHandle: getRelationshipHandle(targetFieldIds, "left"),
      type: "erRelationship",
      label: relationshipLabel,
      data: {
        extensionSource: "database-schema",
        label: relationshipLabel,
        hasLabel: true,
        cardinality: "one-to-many",
        pathType: "step",
        ...getFieldRelationshipData(sourceFieldIds, "source"),
        ...getFieldRelationshipData(targetFieldIds, "target"),
      },
    });
    childIdsByParent.set(parentId, [
      ...(childIdsByParent.get(parentId) ?? []),
      relationship.childId,
    ]);
    inDegree.set(
      relationship.childId,
      (inDegree.get(relationship.childId) ?? 0) + 1,
    );
  });

  const ready = nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  const orderedNodeIds: string[] = [];
  while (ready.length > 0) {
    const nodeId = ready.shift();
    if (!nodeId) continue;
    orderedNodeIds.push(nodeId);
    (childIdsByParent.get(nodeId) ?? []).forEach((childId) => {
      const remaining = (inDegree.get(childId) ?? 1) - 1;
      inDegree.set(childId, remaining);
      if (remaining === 0) ready.push(childId);
    });
  }
  nodes.forEach((node) => {
    if (!orderedNodeIds.includes(node.id)) orderedNodeIds.push(node.id);
  });
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const orderedNodes = orderedNodeIds.flatMap((nodeId) => {
    const node = nodesById.get(nodeId);
    return node ? [node] : [];
  });

  if (relationships.length > 0 && edges.length === 0) {
    warnings.push(
      "Foreign keys were found, but no referenced tables could be linked.",
    );
  }

  return {
    nodes: layoutNodes(orderedNodes),
    edges,
    warnings,
    summary: `${nodes.length} tables and ${edges.length} relationships recognized`,
    fallbackNodes: nodes.length,
  };
};

export const parseExtensionSource = (
  kind: ExtensionKind,
  source: string,
): ExtensionImportResult => {
  if (!source.trim()) throw new Error("Paste source code before importing.");
  return kind === "mermaid"
    ? parseMermaid(source)
    : parseDatabaseSchema(source);
};
