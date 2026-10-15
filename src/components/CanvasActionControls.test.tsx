import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BackgroundVariant } from "@xyflow/react";
import CanvasActionControls, {
  type CanvasListMenuProps,
} from "./CanvasActionControls";
import type { CanvasSummary } from "../types/multiCanvas";

const noop = () => undefined;

const canvases: CanvasSummary[] = [
  {
    id: "main",
    title: "System Design",
    name: "Main",
    kind: "other",
    order: 0,
    nodeCount: 3,
    edgeCount: 1,
    version: 2,
    updatedAt: "",
  },
  {
    id: "flow",
    title: "System Design",
    name: "Flow",
    kind: "flow",
    order: 1,
    nodeCount: 0,
    edgeCount: 0,
    version: 1,
    updatedAt: "",
  },
];

const baseProps = {
  canUndo: false,
  canRedo: false,
  clearDisabled: true,
  layoutDisabled: true,
  onUndo: noop,
  onRedo: noop,
  onClearCanvas: noop,
  onArrange: noop,
  arranging: false,
  onCancelArrange: noop,
};

const canvasList = (
  overrides: Partial<CanvasListMenuProps> = {},
): CanvasListMenuProps => ({
  canvases,
  activeCanvasId: "main",
  primaryCanvasId: "main",
  maxCanvases: 10,
  signedIn: true,
  onSignIn: noop,
  loading: false,
  ready: true,
  saveStatus: "saved",
  message: null,
  onSelect: noop,
  onCreate: async () => ({ ok: true }),
  onRename: async () => ({ ok: true }),
  onDuplicate: noop,
  onReorder: noop,
  onDelete: noop,
  ...overrides,
});

const render = (list: CanvasListMenuProps) =>
  renderToStaticMarkup(
    <CanvasActionControls
      {...baseProps}
      canvasList={list}
      background={BackgroundVariant.Dots}
      onBackgroundChange={noop}
    />,
  );

describe("CanvasActionControls Canvases menu", () => {
  it("lists pages with inline controls and no type selector or separate move actions", () => {
    const html = render(canvasList());
    expect(html).toContain('aria-label="Pages"');
    expect(html).toContain("Main");
    expect(html).toContain("Default");
    expect(html).toContain("Flow");
    expect(html).toContain("+ New page");
    expect(html).toContain(
      'aria-label="Reorder Main. Use Alt+Arrow keys to move it."',
    );
    expect(html).toContain("Drag to reorder · Double-click a name to rename");
    expect(html).toContain('aria-label="More options for Main"');
    expect(html).toContain("Pages · 2 of 10");
    expect(html).not.toContain("Canvas type");
    expect(html).not.toContain("Move left");
  });

  it("tells signed-out users to sign in, with no canvas actions", () => {
    const html = render(
      canvasList({
        signedIn: false,
        ready: false,
        canvases: [],
        activeCanvasId: null,
        primaryCanvasId: null,
      }),
    );
    expect(html).toContain('aria-label="Pages"');
    expect(html).toContain("Sign in to create and manage pages.");
    expect(html).not.toContain("+ New page");
  });

  it("asks a signed-in user to save first when the design has no canvas workspace yet", () => {
    const html = render(
      canvasList({
        ready: false,
        canvases: [],
        activeCanvasId: null,
        primaryCanvasId: null,
      }),
    );
    expect(html).toContain("Save your design to add pages.");
    expect(html).not.toContain("+ New page");
  });

  it("shows a loading message for an existing design whose canvases are still opening", () => {
    const html = render(
      canvasList({
        loading: true,
        ready: false,
        canvases: [],
        activeCanvasId: null,
        primaryCanvasId: null,
      }),
    );
    expect(html).toContain("Loading pages…");
    expect(html).not.toContain("Save your design to add pages.");
  });

  it("shows a sign-in action for signed-out users", () => {
    const html = render(
      canvasList({
        signedIn: false,
        ready: false,
        canvases: [],
        activeCanvasId: null,
        primaryCanvasId: null,
      }),
    );
    expect(html).toContain('aria-label="Pages"');
    expect(html).toContain("Sign in to create and manage pages.");
    expect(html).toContain(">Sign in</button>");
  });

  it("uses context-specific copy when a workspace is not ready", () => {
    const html = render(
      canvasList({
        ready: false,
        emptyStateMessage: "Save your problem attempt to start another canvas.",
      }),
    );
    expect(html).toContain(
      "Save your problem attempt to start another canvas.",
    );
  });

  it("keeps canvases usable: nothing is disabled because of collaboration", () => {
    const html = render(canvasList());
    expect(html).not.toContain("paused");
  });
});
