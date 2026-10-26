import type { SystemDesignSolution } from "../types/systemDesign";
import type {
  SimulationInput,
  SimulationPreparation,
} from "../types/simulation";
import { runCapacitySimulation } from "./simulationEngine";

self.onmessage = (
  event: MessageEvent<{
    solution: SystemDesignSolution;
    preparation: SimulationPreparation;
    input: SimulationInput;
  }>,
) => {
  try {
    self.postMessage({
      result: runCapacitySimulation(
        event.data.solution,
        event.data.preparation,
        event.data.input,
      ),
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Capacity analysis failed.",
    });
  }
};
