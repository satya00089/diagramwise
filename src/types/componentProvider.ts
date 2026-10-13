/**
 * Generic Component Provider Types
 * Supports cloud providers, design patterns, frameworks, etc.
 */

import type { DataModelMetadata } from "./canvas";

export type ComponentProvider =
  | "aws"
  | "azure"
  | "gcp"
  | "kubernetes"
  | "docker"
  | "terraform"
  | "generic"
  | string; // Allow custom providers

export type ComponentCategory =
  | "storage"
  | "compute"
  | "database"
  | "network"
  | "security"
  | "analytics"
  | "ml"
  | "container"
  | "serverless"
  | "messaging"
  | "monitoring"
  | "integration"
  | "orchestration"
  | "ci-cd"
  | "pattern"
  | "other"
  | string; // Allow custom categories

export interface ComponentProperty {
  key: string; // Added key field to identify the property
  type:
    | "string"
    | "number"
    | "boolean"
    | "select"
    | "multiselect"
    | "textarea"
    | "text";
  label: string;
  required?: boolean;
  default?: string | number | boolean | string[];
  options?: string[]; // For select/multiselect
  placeholder?: string;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

export interface ComponentMetadata {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  shape?: "rectangle" | "cylinder" | "circle" | "hexagon" | "diamond";
  width?: number;
  height?: number;
  iconSize?: number;
  nodeType?: "custom" | "group" | "tableNode" | "erNode" | "dataModelNode";
}

export interface ComponentDB {
  // Primary Key
  id: string;

  // Core Information
  provider: ComponentProvider;
  category: ComponentCategory;
  label: string;
  description: string;

  nodeType?: "custom" | "erNode" | "group" | "tableNode" | "dataModelNode"; // Specify which node component to use

  dataModel?: DataModelMetadata;

  // Visual
  icon?: string; // React icon name like "SiAmazons3"
  iconUrl?: string; // URL to custom icon
  iconEmoji?: string; // Emoji fallback like "🪣"

  // Organization
  group: string; // Display group in palette
  tags: string[];

  // Custom Properties for this component type
  properties?: ComponentProperty[]; // Changed from Record to Array

  // Visual Metadata
  metadata?: ComponentMetadata;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  // Status
  isActive: boolean;
  usageCount?: number;

  // Search Optimization
  searchKeywords?: string[];
}

export interface ComponentsResponse {
  items: ComponentDB[];
  count: number;
  lastEvaluatedKey?: Record<string, string>;
}

export interface QueryParams {
  provider?: ComponentProvider;
  category?: ComponentCategory;
  group?: string;
  search?: string;
  tags?: string[];
  limit?: number;
  lastEvaluatedKey?: Record<string, string>;
}
