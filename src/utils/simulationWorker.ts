import type { SystemDesignSolution } from "../types/systemDesign";
import type {
  SimulationInput,
  SimulationPreparation,
  SimulationResult,
} from "../types/simulation";

/** Run the bounded model away from the editor thread. */
export function runCapacitySimulationInWorker(
  solution: SystemDesignSolution,
  preparation: SimulationPreparation,
  input: SimulationInput,
  signal?: AbortSignal,
): Promise<SimulationResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Capacity analysis cancelled", "AbortError"));
      return;
    }

    const worker = new Worker(
      new URL("./simulationEngine.worker.ts", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      worker.terminate();
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const abort = () =>
      fail(new DOMException("Capacity analysis cancelled", "AbortError"));
    const timeout = setTimeout(
      () =>
        fail(new Error("Capacity analysis took too long. Please try again.")),
      10000,
    );

    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onmessage = (
      event: MessageEvent<{ result?: SimulationResult; error?: string }>,
    ) => {
      cleanup();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? "Capacity analysis failed."));
    };
    worker.onerror = () =>
      fail(new Error("The capacity analysis worker could not run."));
    worker.onmessageerror = () =>
      fail(new Error("The capacity analysis result could not be read."));

    try {
      worker.postMessage({ solution, preparation, input });
    } catch (error) {
      fail(
        error instanceof Error ? error : new Error("Capacity analysis failed."),
      );
    }
  });
}
