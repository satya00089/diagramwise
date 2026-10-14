import { describe, expect, it, vi } from "vitest";
import {
  CanvasVersionConflictError,
  type CanvasDetail,
  type CanvasListResponse,
  type CanvasSummary,
} from "../types/multiCanvas";
import {
  CanvasWorkspaceController,
  type CanvasWorkspaceApi,
} from "./canvasWorkspaceController";

const WS = "design-1";

function summary(id: string, order: number, version = 1, name = id): CanvasSummary {
  return {
    id,
    name,
    kind: "other",
    order,
    nodeCount: 0,
    edgeCount: 0,
    version,
    updatedAt: "2026-10-14T00:00:00Z",
  };
}

function detail(id: string, version: number, nodes: unknown[] = [], edges: unknown[] = []): CanvasDetail {
  return {
    ...summary(id, 0, version),
    workspaceId: WS,
    nodes,
    edges,
    createdAt: "2026-10-14T00:00:00Z",
  };
}

interface FakeState {
  canvases: CanvasSummary[];
  primaryCanvasId: string | null;
  content: Record<string, CanvasDetail>;
}

/** An in-memory API with server-side version checks, so tests exercise real conflict paths. */
function fakeApi(initial: FakeState) {
  const state: FakeState = structuredClone(initial);
  const calls = { saves: [] as Array<{ canvasId: string; version: number }> };

  const list = (): CanvasListResponse => ({
    workspaceId: WS,
    primaryCanvasId: state.primaryCanvasId,
    maxCanvases: 10,
    canvases: state.canvases,
  });

  const api: CanvasWorkspaceApi = {
    listCanvases: vi.fn(async () => list()),
    getCanvas: vi.fn(async (_ws: string, id: string) => {
      const found = state.content[id];
      if (!found) throw new Error("not found");
      return structuredClone(found);
    }),
    createCanvas: vi.fn(async (_ws: string, body: { name: string; kind: CanvasSummary["kind"] }) => {
      const id = `new-${state.canvases.length}`;
      const created = { ...summary(id, state.canvases.length, 1, body.name), kind: body.kind };
      state.canvases.push(created);
      state.content[id] = detail(id, 1);
      return structuredClone(state.content[id]);
    }),
    saveCanvasContent: vi.fn(async (_ws: string, id: string, body: { nodes: unknown[]; edges: unknown[]; version: number }) => {
      calls.saves.push({ canvasId: id, version: body.version });
      const current = state.content[id];
      if (current.version !== body.version) {
        throw new CanvasVersionConflictError(current.version);
      }
      const next = { ...current, nodes: body.nodes, edges: body.edges, version: current.version + 1 };
      state.content[id] = next;
      state.canvases = state.canvases.map((c) => (c.id === id ? { ...c, version: next.version } : c));
      return structuredClone(next);
    }),
    updateCanvas: vi.fn(async () => {
      throw new Error("unused");
    }),
    reorderCanvases: vi.fn(async (_ws: string, orderedIds: string[]) => {
      state.canvases = orderedIds.map((id, index) => ({
        ...state.canvases.find((c) => c.id === id)!,
        order: index,
      }));
      return list();
    }),
    duplicateCanvas: vi.fn(async () => {
      throw new Error("unused");
    }),
    deleteCanvas: vi.fn(async (_ws: string, id: string) => {
      state.canvases = state.canvases.filter((c) => c.id !== id);
    }),
  };

  return { api, state, calls };
}

const TWO_TABS: FakeState = {
  canvases: [summary("main", 0, 1, "Main"), summary("flow", 1, 3, "Flow")],
  primaryCanvasId: "main",
  content: {
    main: detail("main", 1, [{ id: "m" }]),
    flow: detail("flow", 3, [{ id: "f" }]),
  },
};

describe("CanvasWorkspaceController.load", () => {
  it("opens the preferred canvas when it exists", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    const opened = await controller.load(WS, "flow");
    expect(opened.id).toBe("flow");
    expect(controller.getSnapshot().activeCanvasId).toBe("flow");
  });

  it("falls back to the primary canvas when the preference is gone", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    const opened = await controller.load(WS, "deleted-tab");
    expect(opened.id).toBe("main");
  });

  it("records each canvas's server version", async () => {
    const { api, calls } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "flow");
    await controller.saveActive([{ id: "f2" }], []);
    expect(calls.saves).toEqual([{ canvasId: "flow", version: 3 }]);
  });
});

describe("CanvasWorkspaceController.saveActive", () => {
  it("sends the current version and advances it after each save", async () => {
    const { api, calls } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");

    expect(await controller.saveActive([{ id: "a" }], [])).toBe("saved");
    expect(await controller.saveActive([{ id: "b" }], [])).toBe("saved");

    expect(calls.saves.map((s) => s.version)).toEqual([1, 2]);
    expect(controller.getSnapshot().saveStatus).toBe("saved");
  });

  it("skips the request when content is unchanged", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    expect(await controller.saveActive([{ id: "m" }], [])).toBe("unchanged");
    expect(api.saveCanvasContent).not.toHaveBeenCalled();
  });

  it("reports a conflict instead of overwriting another session's changes", async () => {
    const { api, state } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    // Another device saves first.
    state.content.main = { ...state.content.main, version: 2, nodes: [{ id: "other" }] };

    expect(await controller.saveActive([{ id: "mine" }], [])).toBe("conflict");
    expect(controller.getSnapshot().saveStatus).toBe("conflict");
    expect(controller.getSnapshot().message).toMatch(/another session/);
    expect(state.content.main.nodes).toEqual([{ id: "other" }]);
  });

  it("serializes overlapping saves so the second uses the first one's version", async () => {
    const { api, calls } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");

    const [first, second] = await Promise.all([
      controller.saveActive([{ id: "a" }], []),
      controller.saveActive([{ id: "b" }], []),
    ]);
    expect([first, second]).toEqual(["saved", "saved"]);
    expect(calls.saves.map((s) => s.version)).toEqual([1, 2]);
  });
});

describe("CanvasWorkspaceController.switchTo", () => {
  it("saves the outgoing canvas before opening the next one", async () => {
    const { api, calls } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");

    const opened = await controller.switchTo("flow", [{ id: "unsaved-edit" }], []);
    expect(opened?.id).toBe("flow");
    expect(calls.saves).toEqual([{ canvasId: "main", version: 1 }]);
    expect(controller.getSnapshot().activeCanvasId).toBe("flow");
  });

  it("does not switch away when the outgoing save fails", async () => {
    const { api, state } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    // Another session changed the content, not just the version.
    state.content.main = { ...state.content.main, version: 9, nodes: [{ id: "other" }] };

    const opened = await controller.switchTo("flow", [{ id: "mine" }], []);
    expect(opened).toBeNull();
    expect(controller.getSnapshot().activeCanvasId).toBe("main");
  });

  it("is a no-op for the tab that is already open", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    expect(await controller.switchTo("main", [], [])).toBeNull();
    expect(api.getCanvas).toHaveBeenCalledTimes(1);
  });
});

describe("CanvasWorkspaceController create, delete and reorder", () => {
  it("flushes the current canvas, then opens an empty new one", async () => {
    const { api, calls } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");

    const created = await controller.create("ER", "er", [{ id: "pending" }], []);
    expect(created?.nodes).toEqual([]);
    expect(calls.saves).toEqual([{ canvasId: "main", version: 1 }]);
    expect(controller.getSnapshot().activeCanvasId).toBe(created?.id);
    expect(controller.getSnapshot().canvases.map((c) => c.name)).toContain("ER");
  });

  it("deleting the active canvas opens the first remaining tab and returns its content", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "flow");

    const fallback = await controller.remove("flow");
    expect(fallback?.id).toBe("main");
    expect(fallback?.nodes).toEqual([{ id: "m" }]);
    expect(controller.getSnapshot().activeCanvasId).toBe("main");
  });

  it("deleting a background canvas keeps the active one open", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");

    expect(await controller.remove("flow")).toBeNull();
    expect(controller.getSnapshot().activeCanvasId).toBe("main");
    expect(controller.getSnapshot().canvases.map((c) => c.id)).toEqual(["main"]);
  });

  it("reorder replaces the tab list with the server's order", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    await controller.reorder(["flow", "main"]);
    expect(controller.getSnapshot().canvases.map((c) => c.id)).toEqual(["flow", "main"]);
  });
});

describe("CanvasWorkspaceController subscriptions", () => {
  it("notifies listeners on state change and stops after unsubscribe", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    await controller.load(WS, "main");
    expect(listener).toHaveBeenCalled();

    const count = listener.mock.calls.length;
    unsubscribe();
    await controller.saveActive([{ id: "x" }], []);
    expect(listener.mock.calls.length).toBe(count);
  });
});

describe("CanvasWorkspaceController.getActiveContent", () => {
  it("returns the open canvas's content, not the previous tab's", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    expect(controller.getActiveContent()).toBeNull();

    await controller.load(WS, "main");
    expect(controller.getActiveContent()?.nodes).toEqual([{ id: "m" }]);

    await controller.switchTo("flow", [{ id: "m" }], []);
    expect(controller.getActiveContent()?.nodes).toEqual([{ id: "f" }]);
  });

  it("tracks what was last saved", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    await controller.saveActive([{ id: "new" }], []);
    expect(controller.getActiveContent()?.nodes).toEqual([{ id: "new" }]);
  });
});

describe("CanvasWorkspaceController stale versions", () => {
  it("recovers silently when the version moved but the stored content is what this tab last saved", async () => {
    const { api, state, calls } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    expect(await controller.saveActive([{ id: "a" }], [])).toBe("saved");

    // The version moved without the content changing (the drift this guards against).
    state.content.main = { ...state.content.main, version: 5 };

    expect(await controller.saveActive([{ id: "b" }], [])).toBe("saved");
    expect(controller.getSnapshot().saveStatus).toBe("saved");
    expect(controller.getSnapshot().message).toBeNull();
    expect(calls.saves.map((s) => s.version)).toEqual([1, 2, 5]);
    expect(state.content.main.nodes).toEqual([{ id: "b" }]);
  });

  it("does not report a conflict when the stored keys are in a different order", async () => {
    const { api, state } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    expect(await controller.saveActive([{ id: "a", label: "x", kind: "box" }], [])).toBe("saved");

    // Same content, keys stored in another order, and the version moved on.
    state.content.main = {
      ...state.content.main,
      version: 4,
      nodes: [{ kind: "box", label: "x", id: "a" }],
    };

    expect(await controller.saveActive([{ id: "b" }], [])).toBe("saved");
    expect(controller.getSnapshot().saveStatus).toBe("saved");
  });
});
