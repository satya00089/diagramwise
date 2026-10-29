import { describe, expect, it } from "vitest";
import type { EventRunArtifact } from "./protocol";
import { compareRuns, describeRunOutcome } from "./runComparison";

let designCounter = 0;
function run(
  result: Partial<NonNullable<EventRunArtifact["result"]>>,
  workload: Partial<EventRunArtifact["workload"]> = {},
): EventRunArtifact {
  return {
    // Each call gets its own fingerprint unless a test pins one: by default
    // two runs are different designs.
    graphFingerprint: `design-${++designCounter}`,
    workload: { rps: 1000, pattern: "steady", seed: 1, ...workload },
    result: {
      timeMs: 30_000,
      offeredRps: 1000,
      goodputRps: 1000,
      errorRate: 0,
      p50: 20,
      p95: 100,
      p99: 200,
      totalRequests: 30_000,
      totalFailed: 0,
      status: "complete",
      ...result,
    },
  } as EventRunArtifact;
}

describe("compareRuns", () => {
  it("reports an improvement after a fix", () => {
    const before = run({ errorRate: 0.08, goodputRps: 920, p95: 420 });
    const after = run({ errorRate: 0.002, goodputRps: 998, p95: 90 });
    const result = compareRuns(after, before);
    expect(result.comparable).toBe(true);
    if (!result.comparable) return;
    expect(result.deltas.map((d) => [d.label, d.tone])).toEqual([
      ["Failed", "better"],
      ["Served", "better"],
      ["p95", "better"],
    ]);
  });

  it("flags a regression", () => {
    const result = compareRuns(run({ errorRate: 0.1 }), run({ errorRate: 0 }));
    expect(result.comparable && result.deltas[0]).toMatchObject({
      label: "Failed",
      tone: "worse",
    });
  });

  it("ignores changes inside the noise", () => {
    const result = compareRuns(
      run({ errorRate: 0.001, goodputRps: 1010, p95: 102 }),
      run({ errorRate: 0, goodputRps: 1000, p95: 100 }),
    );
    expect(result).toEqual({ comparable: true, deltas: [] });
  });

  it("does not compare runs under a different load", () => {
    expect(compareRuns(run({}, { rps: 5000 }), run({}, { rps: 1000 }))).toEqual(
      { comparable: false, reason: "load" },
    );
    expect(compareRuns(run({}, { pattern: "spike" }), run({}))).toEqual({
      comparable: false,
      reason: "load",
    });
  });

  it("does not compare two runs of the same design", () => {
    const a = run({ goodputRps: 850 });
    const b = {
      ...run({ goodputRps: 1000 }),
      graphFingerprint: a.graphFingerprint,
    };
    expect(compareRuns(b, a)).toEqual({
      comparable: false,
      reason: "same-design",
    });
  });
});

describe("describeRunOutcome", () => {
  it("summarises served rate, failures and latency", () => {
    expect(describeRunOutcome(run({ errorRate: 0.08, goodputRps: 920 }))).toBe(
      "920/s served · 8% failed · p95 100 ms",
    );
  });
});
