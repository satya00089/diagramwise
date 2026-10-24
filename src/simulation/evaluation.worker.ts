import { runScenario } from "@diagramwise/simulation-core/scenario";
import { databaseBottleneckScenario } from "@diagramwise/simulation-core/scenarios";
import type { Topology } from "@diagramwise/simulation-core";

self.onmessage = (event: MessageEvent<{ topology: Topology }>) => {
  try { self.postMessage({ result: runScenario(event.data.topology, databaseBottleneckScenario) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "The solution could not be evaluated." }); }
};
