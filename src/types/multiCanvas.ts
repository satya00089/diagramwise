/** Multi-canvas (tab) types. Mirrors diagrammatic-api canvas_models. */

import type { DiagramOwner, SavedDiagramSummary } from "./auth";

export const CANVAS_KINDS = [
  "high_level",
  "flow",
  "er",
  "uml",
  "low_level",
  "other",
] as const;

export type CanvasKind = (typeof CANVAS_KINDS)[number];

export const CANVAS_KIND_LABELS: Record<CanvasKind, string> = {
  high_level: "High-level",
  flow: "Flow",
  er: "ER",
  uml: "UML",
  low_level: "Low-level",
  other: "Other",
};

/** Keep in sync with MAX_CANVASES_PER_WORKSPACE in diagrammatic-api canvas_models. */
export const MAX_CANVASES_PER_DESIGN = 10;

export interface CanvasSummary {
  id: string;
  /** Overall title of the parent design or problem workspace. */
  title: string;
  name: string;
  kind: CanvasKind;
  order: number;
  nodeCount: number;
  edgeCount: number;
  version: number;
  updatedAt: string;
}

export interface CanvasListResponse {
  workspaceId: string;
  primaryCanvasId: string | null;
  maxCanvases: number;
  canvases: CanvasSummary[];
}

export interface CanvasWorkspaceBootstrapResponse extends CanvasListResponse {
  /** Design metadata only; graph data is fetched from the selected canvas. */
  design: Omit<SavedDiagramSummary, "owner"> & {
    owner?: DiagramOwner | null;
  };
}

export interface CanvasDetail extends CanvasSummary {
  workspaceId: string;
  nodes: unknown[];
  edges: unknown[];
  createdAt: string;
  deletedAt?: string | null;
}

/** Raised when a content save is rejected because another session changed the canvas. */
export class CanvasVersionConflictError extends Error {
  readonly currentVersion: number | null;

  constructor(currentVersion: number | null) {
    super("Canvas was modified elsewhere. Reload before saving again.");
    this.name = "CanvasVersionConflictError";
    this.currentVersion = currentVersion;
  }
}
