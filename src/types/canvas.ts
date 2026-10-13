import React from "react";

export type PropertyValue =
  | string
  | number
  | boolean
  | unknown[]
  | Record<string, unknown>
  | React.ComponentType
  | undefined
  | null;

export type ComponentProperty = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "color";
  default?: string | number | boolean;
  placeholder?: string;
  hidden?: boolean; // If true, property won't be rendered in the UI but can still be set programmatically
  options?: string[];
};

export type NodeSection = {
  type: "header" | "attributes" | "methods" | "content";
  editable?: boolean; // Can user add/remove rows
  style?: Record<string, string>;
};

export type TableColumn = {
  key: string; // Unique identifier for the column (matches attribute property)
  label: string; // Display label in header
  width?: string; // CSS width (e.g., "w-6", "flex-1", "w-24")
  align?: "left" | "center" | "right";
  type?: "boolean" | "text" | "readonly"; // Input type for the column
  editable?: boolean; // Can the user edit this field inline
  icon?: {
    active: string; // Icon/text when true (e.g., "🔑", "✓")
    inactive: string; // Icon/text when false (e.g., "○", "")
  };
  color?: {
    active?: string; // CSS color when active (e.g., "text-yellow-600")
    inactive?: string; // CSS color when inactive
  };
};

export type NodeRenderConfig = {
  shape: "rectangle" | "diamond" | "ellipse" | "table" | "note";
  sections?: NodeSection[];
  columns?: TableColumn[]; // Column definitions for table nodes
  minWidth?: number;
  minHeight?: number;
  borderStyle?: "solid" | "dashed" | "double";
  borderWidth?: number;
};

export type DataModelParadigm =
  | "relational"
  | "document"
  | "key-value"
  | "wide-column"
  | "graph";

export type DataModelKind =
  | "entity"
  | "view"
  | "trigger"
  | "constraint"
  | "collection"
  | "document"
  | "nested-object"
  | "aggregation-stage"
  | "schema-validator"
  | "single-table"
  | "access-pattern"
  | "secondary-index"
  | "stream"
  | "wide-column-table"
  | "partition-key"
  | "clustering-key";

export type DataModelField = {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  indexed?: boolean;
  keyRole?: "partition" | "sort" | "secondary" | "none";
  parentId?: string;
};

export type DataModelMetadata = {
  paradigm: DataModelParadigm;
  kind: DataModelKind;
  version: 1;
};

export type DataModelNodeData = {
  label: string;
  componentId?: string;
  icon?: React.ComponentType;
  iconUrl?: string;
  subtitle?: string;
  componentName?: string;
  dataModel: DataModelMetadata;
  fields?: DataModelField[] | string;
  isCollapsed?: boolean;
  [key: string]: unknown;
};

export type CanvasComponent = {
  id: string;
  icon?: React.ComponentType;
  iconUrl?: string;
  label: string;
  description?: string;
  group?: string;
  platform?: string;
  tags?: string[];
  // Optional default dimensions when creating nodes from the palette
  width?: number;
  height?: number;
  properties?: ComponentProperty[];
  dataModel?: DataModelMetadata;
  nodeType?:
    | "custom"
    | "erNode"
    | "group"
    | "tableNode"
    | "dataModelNode"
    | "freeform"; // Specify which node component to use
  renderConfig?: NodeRenderConfig; // Visual configuration for the node
  data?: Record<string, unknown>; // Default data for the node (e.g., attributes for table nodes)
};
