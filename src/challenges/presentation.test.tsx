import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScenarioResult } from "@diagramwise/simulation-core/scenario";
import {
  ENGINE_VERSION,
  PROFILE_VERSION,
} from "@diagramwise/simulation-core/runtime";
import { ChallengeResults } from "./ChallengeResults";
import { formatGoalActual, formatGoalTarget } from "./presentation";
import { scenario } from "./model";

const passingResult: ScenarioResult = {
  scenarioId: scenario.id,
  scenarioRevision: scenario.revision,
  modelVersion: ENGINE_VERSION,
  profileVersion: PROFILE_VERSION,
  status: "pass",
  resourceUnits: 24,
  seedResults: [],
  issues: [],
  goals: [
    {
      metric: "completionFraction",
      actual: 0.999,
      threshold: 0.99,
      comparison: ">=",
      met: true,
    },
  ],
};

describe("challenge result presentation", () => {
  it("announces a stale check without displaying its pass or measurements as current", () => {
    const html = renderToStaticMarkup(
      <ChallengeResults result={passingResult} changed />,
    );
    expect(html).toContain("<output>Changed since last check</output>");
    expect(html).not.toContain("Repair passed");
    expect(html).not.toContain("99.900%");
    const current = renderToStaticMarkup(
      <ChallengeResults result={passingResult} changed={false} />,
    );
    expect(current).toContain("<output>Repair passed all three runs</output>");
    expect(current).toContain("99.900%");
  });

  it("keeps missing latency distinct from zero and formats the authored percentage target", () => {
    expect(
      formatGoalActual({
        metric: "p95",
        actual: null,
        threshold: 200,
        comparison: "<=",
        met: false,
      }),
    ).toBe("No samples");
    expect(
      formatGoalActual({
        metric: "p95",
        actual: 0,
        threshold: 200,
        comparison: "<=",
        met: true,
      }),
    ).toBe("0.00");
    expect(
      formatGoalTarget({
        metric: "completionFraction",
        actual: 1,
        threshold: 0.95,
        comparison: ">=",
        met: true,
      }),
    ).toBe("95%");
  });

  it("does not round a missed target to its passing boundary", () => {
    expect(formatGoalActual({ metric: "p95", actual: 200.004, threshold: 200, comparison: "<=", met: false })).toBe("200.004");
    expect(formatGoalActual({ metric: "completionFraction", actual: 0.9899999, threshold: 0.99, comparison: ">=", met: false })).toBe("98.99999%");
  });
});
