import { afterEach, expect, it, vi } from "vitest";
import { runScenario } from "@diagramwise/simulation-core/scenario";
import { initialDraft, repair, scenario } from "./model";

afterEach(() => vi.unstubAllGlobals());

it("aggregates the worker's seed runs into the same result as the core evaluator", async () => {
  const postMessage = vi.fn();
  const worker = {
    postMessage,
    onmessage: undefined as unknown as (event: MessageEvent) => void,
  };
  vi.stubGlobal("self", worker);
  await import("./evaluate.worker");
  const baseline = initialDraft().topology;
  const repaired = repair(baseline, "database", "capacity", 8);
  const invalid = repair(baseline, "database", "capacity", 30);
  for (const topology of [baseline, repaired, invalid]) {
    postMessage.mockClear();
    worker.onmessage({ data: { id: "submission", topology } } as MessageEvent);
    const last = postMessage.mock.calls.at(-1)?.[0];
    expect(last).toEqual({
      id: "submission",
      result: runScenario(topology, scenario),
    });
  }
});
