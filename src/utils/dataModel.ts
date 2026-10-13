import type {
  DataModelField,
  DataModelKind,
  DataModelNodeData,
  DataModelParadigm,
} from "../types/canvas";

export const DATA_MODEL_PARADIGM_LABELS: Record<DataModelParadigm, string> = {
  relational: "Relational",
  document: "Document",
  "key-value": "Key-Value",
  "wide-column": "Wide-Column",
  graph: "Graph",
};

export const DATA_MODEL_PARADIGM_ORDER: DataModelParadigm[] = [
  "relational",
  "document",
  "key-value",
  "wide-column",
  "graph",
];

export const isDataModelNodeData = (
  data: unknown,
): data is DataModelNodeData => {
  if (!data || typeof data !== "object") return false;
  const metadata = (data as { dataModel?: unknown }).dataModel;
  if (!metadata || typeof metadata !== "object") return false;
  return (
    typeof (metadata as { paradigm?: unknown }).paradigm === "string" &&
    typeof (metadata as { kind?: unknown }).kind === "string"
  );
};

export const parseDataModelFields = (
  fields: DataModelField[] | string | undefined,
): DataModelField[] => {
  if (Array.isArray(fields)) return fields;
  if (typeof fields !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(fields);
    return Array.isArray(parsed) ? (parsed as DataModelField[]) : [];
  } catch {
    return [];
  }
};

export const getDefaultDataModelFields = (
  kind: DataModelKind,
): DataModelField[] => {
  switch (kind) {
    case "access-pattern":
      return [
        {
          id: "field-1",
          name: "partition_key",
          type: "String",
          keyRole: "partition",
          required: true,
        },
        {
          id: "field-2",
          name: "sort_key",
          type: "String",
          keyRole: "sort",
          required: false,
        },
        {
          id: "field-3",
          name: "secondary_index",
          type: "Index",
          keyRole: "secondary",
          indexed: true,
        },
      ];
    case "wide-column-table":
      return [
        {
          id: "field-1",
          name: "partition_key",
          type: "String",
          keyRole: "partition",
          required: true,
        },
        {
          id: "field-2",
          name: "clustering_key",
          type: "Timestamp",
          keyRole: "sort",
          required: true,
        },
        { id: "field-3", name: "value", type: "Text" },
      ];
    case "nested-object":
      return [
        { id: "field-1", name: "address.city", type: "String" },
        { id: "field-2", name: "address.country", type: "String" },
      ];
    case "aggregation-stage":
      return [
        { id: "field-1", name: "stage", type: "$match", required: true },
        { id: "field-2", name: "expression", type: "JSON" },
      ];
    case "schema-validator":
      return [
        { id: "field-1", name: "required", type: "Field list" },
        { id: "field-2", name: "validation", type: "JSON Schema" },
      ];
    case "secondary-index":
      return [
        { id: "field-1", name: "index_name", type: "String", required: true },
        {
          id: "field-2",
          name: "indexed_field",
          type: "String",
          required: true,
        },
      ];
    case "stream":
      return [
        { id: "field-1", name: "event", type: "Change" },
        { id: "field-2", name: "consumer", type: "Service" },
      ];
    case "single-table":
      return [
        {
          id: "field-1",
          name: "PK",
          type: "String",
          keyRole: "partition",
          required: true,
        },
        { id: "field-2", name: "SK", type: "String", keyRole: "sort" },
        { id: "field-3", name: "entity_type", type: "String" },
      ];
    case "collection":
    case "document":
    default:
      return [
        {
          id: "field-1",
          name: "_id",
          type: "Identifier",
          required: true,
        },
        { id: "field-2", name: "name", type: "String", required: true },
        { id: "field-3", name: "created_at", type: "Date" },
      ];
  }
};
