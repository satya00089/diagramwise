import {
  CanvasVersionConflictError,
  type CanvasDetail,
  type CanvasKind,
  type CanvasListResponse,
  type CanvasSummary,
} from "../types/multiCanvas";

/** The subset of the API client the controller needs. Easy to fake in tests. */
export interface CanvasWorkspaceApi {
  listCanvases(workspaceId: string): Promise<CanvasListResponse>;
  getCanvas(workspaceId: string, canvasId: string): Promise<CanvasDetail>;
  createCanvas(
    workspaceId: string,
    body: { name: string; kind: CanvasKind },
  ): Promise<CanvasDetail>;
  saveCanvasContent(
    workspaceId: string,
    canvasId: string,
    body: { nodes: unknown[]; edges: unknown[]; version: number },
  ): Promise<CanvasDetail>;
  updateCanvas(
    workspaceId: string,
    canvasId: string,
    body: { name?: string; kind?: CanvasKind },
  ): Promise<CanvasDetail>;
  reorderCanvases(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<CanvasListResponse>;
  duplicateCanvas(workspaceId: string, canvasId: string): Promise<CanvasDetail>;
  deleteCanvas(workspaceId: string, canvasId: string): Promise<void>;
}

export type CanvasSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "conflict"
  | "error";

/** Outcome of persisting the active canvas. */
export type CanvasPersistResult = "saved" | "unchanged" | "conflict" | "error";

export interface CanvasWorkspaceSnapshot {
  workspaceId: string | null;
  canvases: CanvasSummary[];
  primaryCanvasId: string | null;
  activeCanvasId: string | null;
  saveStatus: CanvasSaveStatus;
  lastSavedAt: number | null;
  message: string | null;
}

const INITIAL_SNAPSHOT: CanvasWorkspaceSnapshot = {
  workspaceId: null,
  canvases: [],
  primaryCanvasId: null,
  activeCanvasId: null,
  saveStatus: "idle",
  lastSavedAt: null,
  message: null,
};

/** Stable content fingerprint: key order does not matter, since stored maps do not keep it. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort((a, b) => a.localeCompare(b))
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
      );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function contentKey(nodes: unknown[], edges: unknown[]): string {
  // React Flow adds these view-only fields while mounting/selecting a graph.
  // They must not turn an unchanged page into a write (or a version conflict).
  const viewOnlyFields = new Set([
    "selected",
    "dragging",
    "resizing",
    "measured",
    "internals",
    "positionAbsolute",
  ]);
  const persistentPart = (item: unknown): unknown => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(
      Object.entries(item).filter(([field]) => !viewOnlyFields.has(field)),
    );
  };
  return stableStringify({
    nodes: nodes.map(persistentPart),
    edges: edges.map(persistentPart),
  });
}

function summaryFromDetail(detail: CanvasDetail): CanvasSummary {
  return {
    id: detail.id,
    title: detail.title,
    name: detail.name,
    kind: detail.kind,
    order: detail.order,
    nodeCount: detail.nodeCount,
    edgeCount: detail.edgeCount,
    version: detail.version,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

const CONFLICT_MESSAGE =
  "The saved page changed while this page was open. Your edits were not overwritten; copy anything you need before reloading.";

/**
 * Owns the multi-canvas state for one workspace: which tab is active, the version
 * each canvas was last saved at, and whether the active canvas has unsaved edits.
 *
 * Saves are serialized so each one sends the version the previous one produced.
 * Switching tabs saves the outgoing canvas first and refuses to switch if that
 * save fails, so edits are never dropped silently.
 */
export class CanvasWorkspaceController {
  private snapshot: CanvasWorkspaceSnapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private readonly versions = new Map<string, number>();
  private readonly lastSavedKey = new Map<string, string>();
  private queue: Promise<unknown> = Promise.resolve();
  /** Last known content of the open canvas: what was loaded or last saved. */
  private activeContent: { nodes: unknown[]; edges: unknown[] } | null = null;

  private readonly api: CanvasWorkspaceApi;

  constructor(api: CanvasWorkspaceApi) {
    this.api = api;
  }

  getSnapshot(): CanvasWorkspaceSnapshot {
    return this.snapshot;
  }

  /** Content of the open canvas as last loaded or saved. Used to seed its live room. */
  getActiveContent(): { nodes: unknown[]; edges: unknown[] } | null {
    return this.activeContent;
  }

  /** Treat client-only hydration/normalization of the open canvas as its clean baseline. */
  markActiveContentClean(
    canvasId: string,
    nodes: unknown[],
    edges: unknown[],
  ): void {
    if (this.snapshot.activeCanvasId !== canvasId) return;
    this.lastSavedKey.set(canvasId, contentKey(nodes, edges));
    this.activeContent = { nodes, edges };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Record that canvases could not be loaded, so the UI stops waiting. */
  markUnavailable(message: string): void {
    this.update({ message });
  }

  reset(): void {
    this.versions.clear();
    this.lastSavedKey.clear();
    this.activeContent = null;
    this.update(INITIAL_SNAPSHOT);
  }

  /**
   * Load a workspace and open one canvas. Prefers `preferredCanvasId`, then the
   * primary canvas, then the first tab.
   */
  async load(
    workspaceId: string,
    preferredCanvasId?: string | null,
    bootstrap?: CanvasListResponse,
  ): Promise<CanvasDetail> {
    const list = bootstrap ?? (await this.api.listCanvases(workspaceId));
    if (list.workspaceId !== workspaceId) {
      throw new Error(
        "Canvas workspace response does not match the requested design",
      );
    }
    this.acceptList(workspaceId, list);
    const target =
      list.canvases.find((c) => c.id === preferredCanvasId) ??
      list.canvases.find((c) => c.id === list.primaryCanvasId) ??
      list.canvases[0];
    if (!target) {
      throw new Error("Workspace has no canvases");
    }
    const detail = await this.api.getCanvas(workspaceId, target.id);
    this.openCanvas(detail);
    this.update({
      activeCanvasId: detail.id,
      saveStatus: "idle",
      message: null,
    });
    return detail;
  }

  /** Persist the active canvas's nodes and edges. Unchanged content is not sent. */
  saveActive(nodes: unknown[], edges: unknown[]): Promise<CanvasPersistResult> {
    const { workspaceId, activeCanvasId } = this.snapshot;
    if (!workspaceId || !activeCanvasId) return Promise.resolve("error");
    return this.persist(workspaceId, activeCanvasId, nodes, edges);
  }

  /**
   * Switch to another canvas. Returns the loaded canvas, or null if the switch was
   * skipped (same tab, or the outgoing canvas could not be saved).
   */
  async switchTo(
    targetId: string,
    nodes: unknown[],
    edges: unknown[],
  ): Promise<CanvasDetail | null> {
    const { workspaceId, activeCanvasId } = this.snapshot;
    if (!workspaceId || targetId === activeCanvasId) return null;

    if (activeCanvasId) {
      const outcome = await this.persist(
        workspaceId,
        activeCanvasId,
        nodes,
        edges,
      );
      if (outcome === "conflict" || outcome === "error") return null;
    }

    const detail = await this.api.getCanvas(workspaceId, targetId);
    this.openCanvas(detail);
    this.update({ activeCanvasId: detail.id, message: null });
    return detail;
  }

  /** Create a canvas after saving the current one, then open it empty. */
  async create(
    name: string,
    kind: CanvasKind,
    nodes: unknown[],
    edges: unknown[],
  ): Promise<CanvasDetail | null> {
    const { workspaceId, activeCanvasId } = this.snapshot;
    if (!workspaceId) return null;
    if (activeCanvasId) {
      const outcome = await this.persist(
        workspaceId,
        activeCanvasId,
        nodes,
        edges,
      );
      if (outcome === "conflict" || outcome === "error") return null;
    }
    const created = await this.api.createCanvas(workspaceId, { name, kind });
    // The POST is authoritative. A follow-up query could briefly omit this new page.
    const createdSummary = summaryFromDetail(created);
    this.update({
      canvases: [...this.snapshot.canvases, createdSummary].sort(
        (a, b) => a.order - b.order,
      ),
    });
    this.openCanvas(created);
    this.update({ activeCanvasId: created.id, message: null });
    return created;
  }

  async rename(
    canvasId: string,
    name: string,
    kind?: CanvasKind,
  ): Promise<void> {
    const { workspaceId } = this.snapshot;
    if (!workspaceId) return;
    const updated = await this.api.updateCanvas(workspaceId, canvasId, {
      name,
      ...(kind ? { kind } : {}),
    });
    this.update({
      canvases: this.snapshot.canvases.map((canvas) =>
        canvas.id === canvasId
          ? {
              ...canvas,
              name: updated.name,
              kind: updated.kind,
              updatedAt: updated.updatedAt,
            }
          : canvas,
      ),
    });
  }

  async duplicate(
    canvasId: string,
    nodes: unknown[],
    edges: unknown[],
  ): Promise<void> {
    const { workspaceId, activeCanvasId } = this.snapshot;
    if (!workspaceId) return;
    if (activeCanvasId) {
      const outcome = await this.persist(
        workspaceId,
        activeCanvasId,
        nodes,
        edges,
      );
      if (outcome === "conflict" || outcome === "error") return;
    }
    const copy = await this.api.duplicateCanvas(workspaceId, canvasId);
    this.update({
      canvases: [...this.snapshot.canvases, summaryFromDetail(copy)].sort(
        (a, b) => a.order - b.order,
      ),
    });
  }

  /**
   * Delete a canvas. If it was the active one, opens the first remaining tab and
   * returns its content so the caller can display it.
   */
  async remove(canvasId: string): Promise<CanvasDetail | null> {
    const { workspaceId, activeCanvasId } = this.snapshot;
    if (!workspaceId) return null;

    let fallback: CanvasDetail | null = null;
    if (canvasId === activeCanvasId) {
      const next = this.snapshot.canvases.find((c) => c.id !== canvasId);
      if (!next) return null;
      // Leaving the deleted tab: nothing to flush, its content is going away.
      fallback = await this.api.getCanvas(workspaceId, next.id);
    }

    await this.api.deleteCanvas(workspaceId, canvasId);
    this.versions.delete(canvasId);
    this.lastSavedKey.delete(canvasId);
    await this.refreshList(workspaceId);

    if (fallback) {
      this.openCanvas(fallback);
      this.update({ activeCanvasId: fallback.id, message: null });
    }
    return fallback;
  }

  async reorder(orderedIds: string[]): Promise<void> {
    const { workspaceId } = this.snapshot;
    if (!workspaceId) return;
    const list = await this.api.reorderCanvases(workspaceId, orderedIds);
    this.acceptList(workspaceId, list);
  }

  // --- internals -------------------------------------------------------------

  private persist(
    workspaceId: string,
    canvasId: string,
    nodes: unknown[],
    edges: unknown[],
  ): Promise<CanvasPersistResult> {
    return this.enqueue(async () => {
      const key = contentKey(nodes, edges);
      if (this.lastSavedKey.get(canvasId) === key) return "unchanged";

      this.update({ saveStatus: "saving" });
      try {
        return await this.sendSave(
          workspaceId,
          canvasId,
          nodes,
          edges,
          key,
          true,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Save failed";
        this.update({ saveStatus: "error", message });
        return "error";
      }
    });
  }

  /**
   * Save with the version this tab last saw. A stale version is not a conflict when the
   * stored content is still what this tab last saved: the version moved without the
   * content changing, so adopt the server version and retry once. Only different content
   * from elsewhere is reported as a conflict.
   */
  private async sendSave(
    workspaceId: string,
    canvasId: string,
    nodes: unknown[],
    edges: unknown[],
    key: string,
    canRecover: boolean,
  ): Promise<CanvasPersistResult> {
    const version = this.versions.get(canvasId);
    if (version === undefined) return "error";

    try {
      const saved = await this.api.saveCanvasContent(workspaceId, canvasId, {
        nodes,
        edges,
        version,
      });
      this.recordSavedContent(canvasId, nodes, edges, key, saved.version);
      return "saved";
    } catch (error) {
      if (!(error instanceof CanvasVersionConflictError)) throw error;
      return this.recoverVersionConflict(
        workspaceId,
        canvasId,
        nodes,
        edges,
        key,
        canRecover,
      );
    }
  }

  private async recoverVersionConflict(
    workspaceId: string,
    canvasId: string,
    nodes: unknown[],
    edges: unknown[],
    key: string,
    canRecover: boolean,
  ): Promise<CanvasPersistResult> {
    if (!canRecover) return this.reportConflict();

    const stored = await this.api.getCanvas(workspaceId, canvasId);
    const storedKey = contentKey(stored.nodes, stored.edges);
    if (storedKey === key) {
      // The requested content is already saved. A second PUT would only
      // advance its version and make other open tabs stale again.
      this.recordSavedContent(canvasId, nodes, edges, key, stored.version);
      return "saved";
    }
    if (storedKey === this.lastSavedKey.get(canvasId)) {
      this.versions.set(canvasId, stored.version);
      return this.sendSave(workspaceId, canvasId, nodes, edges, key, false);
    }

    return this.reportConflict();
  }

  private recordSavedContent(
    canvasId: string,
    nodes: unknown[],
    edges: unknown[],
    key: string,
    version: number,
  ): void {
    this.versions.set(canvasId, version);
    this.lastSavedKey.set(canvasId, key);
    if (this.snapshot.activeCanvasId === canvasId) {
      this.activeContent = { nodes, edges };
    }
    this.update({ saveStatus: "saved", lastSavedAt: Date.now(), message: null });
  }

  private reportConflict(): CanvasPersistResult {
    this.update({ saveStatus: "conflict", message: CONFLICT_MESSAGE });
    return "conflict";
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private openCanvas(detail: CanvasDetail): void {
    this.versions.set(detail.id, detail.version);
    this.lastSavedKey.set(detail.id, contentKey(detail.nodes, detail.edges));
    this.activeContent = { nodes: detail.nodes, edges: detail.edges };
  }

  private acceptList(workspaceId: string, list: CanvasListResponse): void {
    for (const canvas of list.canvases) {
      // Never overwrite the active canvas's version: it reflects saves we made locally.
      if (
        canvas.id !== this.snapshot.activeCanvasId ||
        !this.versions.has(canvas.id)
      ) {
        this.versions.set(canvas.id, canvas.version);
      }
    }
    const liveIds = new Set(list.canvases.map((c) => c.id));
    for (const id of this.versions.keys()) {
      if (!liveIds.has(id)) {
        this.versions.delete(id);
        this.lastSavedKey.delete(id);
      }
    }
    this.update({
      workspaceId,
      canvases: list.canvases,
      primaryCanvasId: list.primaryCanvasId,
    });
  }

  private async refreshList(workspaceId: string): Promise<void> {
    const list = await this.api.listCanvases(workspaceId);
    this.acceptList(workspaceId, list);
  }

  private update(patch: Partial<CanvasWorkspaceSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}
