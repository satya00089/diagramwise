import { renderToStaticMarkup } from "react-dom/server";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { CanvasInset } from "./CanvasInset";

function render(props: Parameters<typeof CanvasInset>[0]) {
  return renderToStaticMarkup(
    <ReactFlowProvider>
      <CanvasInset {...props} />
    </ReactFlowProvider>,
  );
}

describe("CanvasInset", () => {
  it("opens on Traffic with the tabs under the body and the panel unfolded", () => {
    const html = render({ traffic: <p>run traffic</p> });
    expect(html).toContain("run traffic");
    expect(html).toContain('aria-selected="true"');
    expect(html.indexOf("canvas-inset__body")).toBeLessThan(
      html.indexOf("canvas-inset__tabs"),
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Hide panel"');
    expect(html).not.toContain("canvas-inset--collapsed");
  });

  it("offers a Map tab only where the page has a minimap", () => {
    expect(render({ traffic: <p>t</p> })).toContain(">Map<");
    const trafficOnly = render({ traffic: <p>t</p>, map: false });
    expect(trafficOnly).toContain(">Traffic<");
    expect(trafficOnly).not.toContain(">Map<");
  });
});
