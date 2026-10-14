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
  loading: false,
  ready: true,
  saveStatus: "saved",
  message: null,
  onSelect: noop,
  onCreate: noop,
  onRename: noop,
  onDuplicate: noop,
  onMove: noop,
  onDelete: noop,
  ...overrides,
});

const render = (list: CanvasListMenuProps | null) =>
  renderToStaticMarkup(
    <CanvasActionControls
      {...baseProps}
      canvasList={list}
      background={BackgroundVariant.Dots}
      onBackgroundChange={noop}
    />,
  );

describe("CanvasActionControls Canvases menu", () => {
  it("lists canvases, marks the primary one, and offers management actions", () => {
    const html = render(canvasList());
    expect(html).toContain('aria-label="Canvases"');
    expect(html).toContain("Main");
    expect(html).toContain("Primary");
    expect(html).toContain("Flow");
    expect(html).toContain("+ New canvas");
    expect(html).toContain("Rename");
    expect(html).toContain("Duplicate");
    expect(html).toContain("Move left");
    expect(html).toContain("Delete");
    expect(html).toContain("2/10 canvases");
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
    expect(html).toContain('aria-label="Canvases"');
    expect(html).toContain("Sign in to use canvases.");
    expect(html).not.toContain("+ New canvas");
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
    expect(html).toContain("Save your design to add canvases.");
    expect(html).not.toContain("+ New canvas");
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
    expect(html).toContain("Loading canvases…");
    expect(html).not.toContain("Save your design to add canvases.");
  });

  it("does not offer the Canvases menu when multi-canvas is off", () => {
    expect(render(null)).not.toContain('aria-label="Canvases"');
  });

  it("keeps canvases usable: nothing is disabled because of collaboration", () => {
    const html = render(canvasList());
    expect(html).not.toContain("paused");
  });
});
