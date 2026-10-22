/**
 * Diagram Persistence Service
 * Handles saving and loading diagrams to/from backend
 *
 * Responsibilities (Single Responsibility Principle):
 * - Save diagram state to backend
 * - Load diagram state from backend
 * - Auto-save functionality
 * - Error handling and retry logic
 *
 * Open/Closed Principle:
 * - Open for extension (new save strategies)
 * - Closed for modification (core save/load logic)
 */

import type { Node, Edge } from "@xyflow/react";
import { apiService } from "./api";

export interface DiagramData {
  id: string;
  nodes: Node[];
  edges: Edge[];
  metadata?: {
    name?: string;
    description?: string;
    lastModified?: string;
    version?: number;
  };
}

export interface SaveDiagramParams {
  diagramId: string;
  nodes: Node[];
  edges: Edge[];
  metadata?: DiagramData["metadata"];
}

export interface LoadDiagramParams {
  diagramId: string;
}

/**
 * Interface for persistence operations (Interface Segregation Principle)
 */
export interface IDiagramPersistence {
  save(params: SaveDiagramParams): Promise<void>;
  load(params: LoadDiagramParams): Promise<DiagramData | null>;
}

/**
 * Backend-based persistence implementation
 */
class BackendPersistence implements IDiagramPersistence {
  /**
   * Save diagram to backend
   */
  async save({
    diagramId,
    nodes,
    edges,
    metadata,
  }: SaveDiagramParams): Promise<void> {
    try {
      const payload = {
        title: metadata?.name || "Untitled",
        description: metadata?.description || "",
        nodes,
        edges,
      };

      // Update existing diagram or create new one
      if (diagramId) {
        await apiService.updateDiagram(diagramId, payload);
      } else {
        await apiService.saveDiagram(payload);
      }
    } catch (error) {
      console.error("Failed to save diagram:", error);
      throw new Error("Failed to save diagram to server");
    }
  }

  /**
   * Load diagram from backend
   */
  async load({ diagramId }: LoadDiagramParams): Promise<DiagramData | null> {
    try {
      const diagram = await apiService.getDiagram(diagramId);
      return {
        id: diagram.id,
        nodes: diagram.nodes as Node[],
        edges: diagram.edges as Edge[],
        metadata: {
          name: diagram.title,
          description: diagram.description,
          lastModified: diagram.updatedAt,
          version: 1,
        },
      };
    } catch (error) {
      console.error("Failed to load diagram:", error);
      return null;
    }
  }
}

/**
 * Auto-save manager
 * Handles debounced auto-saving
 */
export class AutoSaveManager {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private readonly persistence: IDiagramPersistence;
  private readonly interval: number;

  constructor(persistence: IDiagramPersistence, intervalMs: number = 30000) {
    this.persistence = persistence;
    this.interval = intervalMs;
  }

  /**
   * Schedule an auto-save
   */
  scheduleSave(params: SaveDiagramParams): void {
    // Clear existing timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    // Schedule new save
    this.timeout = setTimeout(async () => {
      try {
        await this.persistence.save(params);
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
    }, this.interval);
  }

  /**
   * Force immediate save
   */
  async forceSave(params: SaveDiagramParams): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    await this.persistence.save(params);
  }

  /**
   * Cancel pending saves
   */
  cancel(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}

// Export singleton instance
export const diagramPersistence = new BackendPersistence();

// Export factory for auto-save manager
export const createAutoSaveManager = (intervalMs?: number) => {
  return new AutoSaveManager(diagramPersistence, intervalMs);
};
