import {
  computeAutoArrange,
  type LayoutGraph,
  type AutoArrangeOptions,
} from "./autoArrangeGraph";

self.onmessage = (
  event: MessageEvent<{ graph: LayoutGraph; options: AutoArrangeOptions }>,
) => {
  try {
    self.postMessage({
      placements: computeAutoArrange(event.data.graph, event.data.options),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Arrangement failed.",
    });
  }
};
