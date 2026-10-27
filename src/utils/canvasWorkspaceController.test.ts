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
import { normalizeEdgeDataPurpose } from "./purposeMigration";
import { persistProblemAttempt } from "./persistProblemAttempt";

const WS = "design-1";

function summary(
  id: string,
  order: number,
  version = 1,
  name = id,
): CanvasSummary {
  return {
    id,
    title: "System Design",
    name,
    kind: "other",
    order,
    nodeCount: 0,
    edgeCount: 0,
    version,
    updatedAt: "2026-10-14T00:00:00Z",
  };
}

function detail(
  id: string,
  version: number,
  nodes: unknown[] = [],
  edges: unknown[] = [],
): CanvasDetail {
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
    createCanvas: vi.fn(
      async (
        _ws: string,
        body: { name: string; kind: CanvasSummary["kind"] },
      ) => {
        const id = `new-${state.canvases.length}`;
        const created = {
          ...summary(id, state.canvases.length, 1, body.name),
          kind: body.kind,
        };
        state.canvases.push(created);
        state.content[id] = {
          ...detail(id, 1),
          name: body.name,
          kind: body.kind,
        };
        return structuredClone(state.content[id]);
      },
    ),
    saveCanvasContent: vi.fn(
      async (
        _ws: string,
        id: string,
        body: { nodes: unknown[]; edges: unknown[]; version: number },
      ) => {
        calls.saves.push({ canvasId: id, version: body.version });
        const current = state.content[id];
        if (current.version !== body.version) {
          throw new CanvasVersionConflictError(current.version);
        }
        const next = {
          ...current,
          nodes: body.nodes,
          edges: body.edges,
          version: current.version + 1,
        };
        state.content[id] = next;
        state.canvases = state.canvases.map((c) =>
          c.id === id ? { ...c, version: next.version } : c,
        );
        return structuredClone(next);
      },
    ),
    updateCanvas: vi.fn(
      async (_ws: string, id: string, body: { name?: string }) => {
        state.content[id] = {
          ...state.content[id],
          name: body.name ?? state.content[id].name,
        };
        return structuredClone(state.content[id]);
      },
    ),
    reorderCanvases: vi.fn(async (_ws: string, orderedIds: string[]) => {
      state.canvases = orderedIds.map((id, index) => ({
        ...state.canvases.find((c) => c.id === id)!,
        order: index,
      }));
      return list();
    }),
    duplicateCanvas: vi.fn(async (_ws: string, id: string) => {
      const source = state.content[id];
      const copyId = `copy-${state.canvases.length}`;
      const copy = {
        ...source,
        id: copyId,
        name: `${source.name} copy`,
        order: state.canvases.length,
      };
      state.content[copyId] = copy;
      state.canvases.push({
        ...summary(copyId, copy.order, copy.version, copy.name),
        kind: copy.kind,
      });
      return structuredClone(copy);
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

  it("uses bootstrap summaries and fetches only the selected canvas content", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    const bootstrap: CanvasListResponse = {
      workspaceId: WS,
      primaryCanvasId: "main",
      maxCanvases: 10,
      canvases: TWO_TABS.canvases,
    };

    const opened = await controller.load(WS, "flow", bootstrap);

    expect(opened.id).toBe("flow");
    expect(api.listCanvases).not.toHaveBeenCalled();
    expect(api.getCanvas).toHaveBeenCalledTimes(1);
    expect(api.getCanvas).toHaveBeenCalledWith(WS, "flow");
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

  it("does not save renderer-only changes made while opening a page", async () => {
    const initialState: FakeState = {
      ...TWO_TABS,
      content: {
        ...TWO_TABS.content,
        main: detail("main", 1, [{ id: "m", position: { x: 20, y: 30 } }]),
      },
    };
    const { api, state } = fakeApi(initialState);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    // A renderer can measure/select a node on mount; neither is a user edit.
    state.content.main = {
      ...state.content.main,
      version: 2,
      nodes: [{ id: "remote" }],
    };

    expect(
      await controller.saveActive(
        [
          {
            id: "m",
            position: { x: 20, y: 30 },
            measured: { width: 200, height: 80 },
            selected: true,
            dragging: false,
          },
        ],
        [],
      ),
    ).toBe("unchanged");
    expect(api.saveCanvasContent).not.toHaveBeenCalled();
    expect(controller.getSnapshot().saveStatus).not.toBe("conflict");
    expect(state.content.main.nodes).toEqual([{ id: "remote" }]);
  });

  it("keeps load-time edge normalization from triggering an autosave", async () => {
    const legacyEdge = {
      id: "edge-a-b",
      source: "a",
      target: "b",
      data: { description: "Carries the request" },
    };
    const initialState: FakeState = {
      ...TWO_TABS,
      content: {
        ...TWO_TABS.content,
        main: detail("main", 1, [{ id: "a" }, { id: "b" }], [legacyEdge]),
      },
    };
    const { api } = fakeApi(initialState);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");

    const hydratedEdges = [
      {
        ...legacyEdge,
        data: normalizeEdgeDataPurpose(legacyEdge.data),
      },
    ];
    controller.markActiveContentClean(
      "main",
      [{ id: "a" }, { id: "b" }],
      hydratedEdges,
    );

    expect(
      await controller.saveActive([{ id: "a" }, { id: "b" }], hydratedEdges),
    ).toBe("unchanged");
    expect(api.saveCanvasContent).not.toHaveBeenCalled();
  });

  it("reports a conflict instead of overwriting another session's changes", async () => {
    const { api, state } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    // Another device saves first.
    state.content.main = {
      ...state.content.main,
      version: 2,
      nodes: [{ id: "other" }],
    };

    expect(await controller.saveActive([{ id: "mine" }], [])).toBe("conflict");
    expect(controller.getSnapshot().saveStatus).toBe("conflict");
    expect(controller.getSnapshot().message).toMatch(/saved page changed/);
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

    const opened = await controller.switchTo(
      "flow",
      [{ id: "unsaved-edit" }],
      [],
    );
    expect(opened?.id).toBe("flow");
    expect(calls.saves).toEqual([{ canvasId: "main", version: 1 }]);
    expect(controller.getSnapshot().activeCanvasId).toBe("flow");
  });

  it("does not switch away when the outgoing save fails", async () => {
    const { api, state } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    // Another session changed the content, not just the version.
    state.content.main = {
      ...state.content.main,
      version: 9,
      nodes: [{ id: "other" }],
    };

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

    const created = await controller.create(
      "ER",
      "er",
      [{ id: "pending" }],
      [],
    );
    expect(created?.nodes).toEqual([]);
    expect(calls.saves).toEqual([{ canvasId: "main", version: 1 }]);
    expect(controller.getSnapshot().activeCanvasId).toBe(created?.id);
    expect(controller.getSnapshot().canvases.map((c) => c.name)).toContain(
      "ER",
    );
  });

  it("does not post a new page when the current page cannot be saved", async () => {
    const { api, state } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    state.content.main = {
      ...state.content.main,
      version: 2,
      nodes: [{ id: "elsewhere" }],
    };

    const created = await controller.create(
      "ER",
      "other",
      [{ id: "pending" }],
      [],
    );

    expect(created).toBeNull();
    expect(api.createCanvas).not.toHaveBeenCalled();
    expect(controller.getSnapshot().message).toContain(
      "saved page changed while this page was open",
    );
    expect(controller.getSnapshot().canvases).toHaveLength(2);
  });

  it("shows a created page without a potentially stale follow-up list request", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");

    const created = await controller.create("ER", "other", [{ id: "m" }], []);

    expect(created?.name).toBe("ER");
    expect(controller.getSnapshot().activeCanvasId).toBe(created?.id);
    expect(
      controller.getSnapshot().canvases.map((canvas) => canvas.name),
    ).toContain("ER");
    expect(controller.getSnapshot().message).toBeNull();
    expect(api.listCanvases).toHaveBeenCalledTimes(1);
  });

  it("shows renamed and duplicated pages from mutation responses", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");

    await controller.rename("main", "Overview");
    await controller.duplicate("main", [{ id: "m" }], []);

    expect(
      controller.getSnapshot().canvases.map((canvas) => canvas.name),
    ).toEqual(["Overview", "Flow", "Overview copy"]);
    expect(api.listCanvases).toHaveBeenCalledTimes(1);
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
    expect(controller.getSnapshot().canvases.map((c) => c.id)).toEqual([
      "main",
    ]);
  });

  it("reorder replaces the tab list with the server's order", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    await controller.reorder(["flow", "main"]);
    expect(controller.getSnapshot().canvases.map((c) => c.id)).toEqual([
      "flow",
      "main",
    ]);
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
    expect(listener.mock.calls).toHaveLength(count);
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
  it("detects a remote edit before saving attempt metadata for an unchanged canvas", async () => {
    const { api, state } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    state.content.main = {
      ...state.content.main,
      version: 2,
      nodes: [{ id: "remote" }],
    };
    const writeAttempt = vi.fn(async () => undefined);
    await expect(
      persistProblemAttempt(async () => {
        const result = await controller.saveActive([{ id: "m" }], [], true);
        if (result === "conflict" || result === "error")
          throw new Error("canvas failed");
      }, writeAttempt),
    ).rejects.toThrow("canvas failed");
    expect(writeAttempt).not.toHaveBeenCalled();
  });
  it("does not update an attempt when the canvas has a genuine conflict", async () => {
    const { api, state } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    state.content.main = {
      ...state.content.main,
      version: 2,
      nodes: [{ id: "remote" }],
    };
    const writeAttempt = vi.fn(async () => undefined);
    await expect(
      persistProblemAttempt(async () => {
        const result = await controller.saveActive([{ id: "mine" }], []);
        if (result === "conflict" || result === "error")
          throw new Error("canvas failed");
      }, writeAttempt),
    ).rejects.toThrow("canvas failed");
    expect(writeAttempt).not.toHaveBeenCalled();
    expect(
      (await new CanvasWorkspaceController(api).load(WS, "main")).nodes,
    ).toEqual([{ id: "remote" }]);
  });

  it("can retry the attempt after its canvas was saved but the attempt write failed", async () => {
    const { api } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    const saveCanvas = async () => {
      const result = await controller.saveActive([{ id: "edited" }], []);
      if (result === "conflict" || result === "error")
        throw new Error("canvas failed");
    };
    const writeAttempt = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("saved");
    await expect(
      persistProblemAttempt(saveCanvas, writeAttempt),
    ).rejects.toThrow("offline");
    await expect(persistProblemAttempt(saveCanvas, writeAttempt)).resolves.toBe(
      "saved",
    );
    expect(
      (await new CanvasWorkspaceController(api).load(WS, "main")).nodes,
    ).toEqual([{ id: "edited" }]);
  });
  it("recovers a version change when the loaded canvas was hydrated with an icon", async () => {
    const initial = structuredClone(TWO_TABS);
    initial.content.main.nodes = [
      { id: "m", data: { componentId: "web-app" } },
    ];
    const { api, state } = fakeApi(initial);
    const save = api.saveCanvasContent;
    api.saveCanvasContent = (workspaceId, canvasId, body) =>
      save(workspaceId, canvasId, JSON.parse(JSON.stringify(body)));
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    const hydrated = [
      {
        id: "m",
        data: { componentId: "web-app", icon: () => null, iconUrl: undefined },
      },
    ];
    controller.markActiveContentClean("main", hydrated, []);

    // The server has the same original content, but another write advanced its version.
    state.content.main = { ...state.content.main, version: 2 };
    const edited = [...hydrated, { id: "gateway" }];
    expect(await controller.saveActive(edited, [])).toBe("saved");
    const reloaded = new CanvasWorkspaceController(api);
    expect((await reloaded.load(WS, "main")).nodes).toEqual(
      JSON.parse(JSON.stringify(edited)),
    );
  });
  it("adopts the latest version without writing when the server already has this content", async () => {
    const { api, state, calls } = fakeApi(TWO_TABS);
    const controller = new CanvasWorkspaceController(api);
    await controller.load(WS, "main");
    state.content.main = {
      ...state.content.main,
      version: 2,
      nodes: [{ id: "mine" }],
    };

    expect(await controller.saveActive([{ id: "mine" }], [])).toBe("saved");
    expect(calls.saves).toEqual([{ canvasId: "main", version: 1 }]);
    expect(controller.getSnapshot().message).toBeNull();
    expect(await controller.saveActive([{ id: "mine" }], [])).toBe("unchanged");
  });
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
    expect(
      await controller.saveActive([{ id: "a", label: "x", kind: "box" }], []),
    ).toBe("saved");

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
