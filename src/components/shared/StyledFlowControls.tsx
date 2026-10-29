import React, { useEffect, useRef } from "react";
import { Controls } from "@xyflow/react";

/**
 * React Flow adds native `title` attributes to its built-in controls. Move
 * those labels to the app tooltip system so canvas controls match the rest of
 * the product without losing their accessible names.
 */
const StyledFlowControls: React.FC<React.ComponentProps<typeof Controls>> = (
  props,
) => {
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = controlsRef.current;
    if (!root) return;

    const syncTooltips = () => {
      root.querySelectorAll<HTMLElement>("[title]").forEach((element) => {
        const title = element.getAttribute("title");
        if (!title) return;
        element.dataset.tooltip = title;
        element.removeAttribute("title");
      });
    };

    syncTooltips();

    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(syncTooltips);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["title"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={controlsRef} style={{ display: "contents" }}>
      <Controls {...props} />
    </div>
  );
};

export default StyledFlowControls;
