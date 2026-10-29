import { describe, expect, it } from "vitest";
import { runScenario } from "./scenario";
import { repairDemoScenario } from "./scenarios";

describe("repair scenarios", () => {
  it("fails the supplied bottleneck and accepts two bounded capacity repairs", () => {
    const initial = repairDemoScenario();
    expect(runScenario(initial.initialTopology, initial).status).toBe("fail");

    const widerDatabase = structuredClone(initial.initialTopology);
    widerDatabase.nodes.find(
      (node) => node.id === "database",
    )!.config.capacity = 8;
    expect(runScenario(widerDatabase, initial).status).toBe("pass");

    const moreDatabaseInstances = structuredClone(initial.initialTopology);
    const database = moreDatabaseInstances.nodes.find(
      (node) => node.id === "database",
    )!;
    database.config.capacity = 2;
    database.config.instances = 4;
    expect(runScenario(moreDatabaseInstances, initial).status).toBe("pass");
  }, 30_000);

  it("rejects attempts that remove required work or exceed the resource budget", () => {
    const scenario = repairDemoScenario();
    const missingDependency = structuredClone(scenario.initialTopology);
    missingDependency.edges = [missingDependency.edges[0]];
    expect(runScenario(missingDependency, scenario).status).toBe("invalid");

    const oversized = structuredClone(scenario.initialTopology);
    oversized.nodes.find((node) => node.id === "database")!.config.capacity =
      100;
    expect(runScenario(oversized, scenario).status).toBe("invalid");
  });
});
