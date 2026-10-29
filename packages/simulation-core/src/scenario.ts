import { LatencyHistogram } from "./histogram";
import { defaultConfig } from "./presets";
import { createSimulation, ENGINE_VERSION, PROFILE_VERSION } from "./runtime";
import type { NodeConfig, Topology, TrafficPattern } from "./types";

export type ScenarioStatus = "pass" | "fail" | "invalid" | "incomplete";

/** Versioned, declarative practice brief. Evaluation never consumes live UI metrics. */
export interface ScenarioDefinition {
  id: string;
  revision: string;
  name: string;
  brief: string;
  modelVersion: typeof ENGINE_VERSION;
  profileVersion: typeof PROFILE_VERSION;
  initialTopology: Topology;
  workload: { rps: number; pattern: TrafficPattern };
  seeds: readonly number[];
  warmupMs: number;
  measurementMs: number;
  completionDeadlineMs: number;
  constraints: {
    /** Every other model property is fixed. Presentation changes remain permitted. */
    allowedConfigFields: Readonly<
      Record<string, readonly (keyof NodeConfig)[]>
    >;
    /** The first release fixes topology; later briefs can supply a different validator. */
    allowTopologyChanges: false;
    requiredNodeIds: readonly string[];
    requiredEdgeIds: readonly string[];
    /** Each successful root request must actually complete these dependencies. */
    requiredCompletedNodeIds: readonly string[];
    /** Educational concurrency units, not money or vendor pricing. */
    resourceBudget: number;
  };
  goals: {
    minCompletionFraction: number;
    maxP95Ms: number;
    maxP99Ms: number;
    minSuccessfulSamples: number;
  };
  hints: readonly string[];
  lesson: string;
}

export interface ScenarioGoalResult {
  metric: "completionFraction" | "p95" | "p99" | "sampleCount";
  actual: number | null;
  threshold: number;
  comparison: ">=" | "<=";
  met: boolean;
}

export interface ScenarioSeedResult {
  seed: number;
  status: "pass" | "fail" | "incomplete";
  admitted: number;
  successful: number;
  failed: number;
  pending: number;
  missingDependencies: number;
  completionFraction: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  sampleCount: number;
  simulatedMs: number;
  processedEvents: number;
  goals: ScenarioGoalResult[];
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioRevision: string;
  modelVersion: typeof ENGINE_VERSION;
  profileVersion: typeof PROFILE_VERSION;
  status: ScenarioStatus;
  resourceUnits: number;
  seedResults: ScenarioSeedResult[];
  issues: string[];
  /** Worst observation across the required seeds, never an average of passing/failing runs. */
  goals: ScenarioGoalResult[];
}

export interface ScenarioRunOptions {
  /** Processing slice size; changing it must not change an otherwise complete result. */
  eventBudget?: number;
  /** A runner safety budget, distinct from the scenario's architecture budget. */
  maxEventsPerSeed?: number;
}

const MODEL_VERSION = ENGINE_VERSION;
const WORKLOAD_FIELDS = new Set(["rps", "traffic", "trafficPeriodS"]);
const INTEGER_FIELDS = new Set([
  "capacity",
  "instances",
  "queueLimit",
  "retries",
]);
const DEFAULT_MAX_EVENTS = 2_000_000;

function sameScalar(left: unknown, right: unknown): boolean {
  return left === right || (left === undefined && right === undefined);
}

/** Capacity units have one meaning here: concurrent slots, including each instance. */
export function scenarioResourceUnits(topology: Topology): number {
  return topology.nodes.reduce((total, node) => {
    if (
      node.kind === "client" ||
      node.kind === "autoscaler" ||
      node.kind === "cron"
    )
      return total;
    const config = node.config;
    if (node.kind === "shard") {
      return total + (config.shardCount ?? 1) * (config.shardCapacity ?? 1);
    }
    if (node.kind === "replica")
      return total + config.capacity * (config.replicaCount ?? 1);
    return total + config.capacity * (config.instances ?? 1);
  }, 0);
}

function validateDefinition(scenario: ScenarioDefinition): string[] {
  const issues: string[] = [];
  if (
    scenario.modelVersion !== MODEL_VERSION ||
    scenario.profileVersion !== PROFILE_VERSION
  ) {
    issues.push(
      "This scenario requires a different simulation model or profile version.",
    );
  }
  if (!scenario.id || !scenario.revision)
    issues.push("The scenario must have an ID and revision.");
  if (
    !Array.isArray(scenario.seeds) ||
    scenario.seeds.length < 1 ||
    scenario.seeds.length > 8 ||
    scenario.seeds.some(
      (seed) => !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff,
    ) ||
    new Set(scenario.seeds).size !== scenario.seeds.length
  ) {
    issues.push(
      "The scenario must define one to eight distinct unsigned integer seeds.",
    );
  }
  for (const [name, value, min, max] of [
    ["request rate", scenario.workload.rps, 1, 5_000],
    ["warmup duration", scenario.warmupMs, 0, 60_000],
    ["measurement duration", scenario.measurementMs, 1_000, 300_000],
    ["completion deadline", scenario.completionDeadlineMs, 1, 60_000],
    ["resource budget", scenario.constraints.resourceBudget, 1, 100_000],
    ["completion fraction", scenario.goals.minCompletionFraction, 0.001, 1],
    ["p95 objective", scenario.goals.maxP95Ms, 0.001, 60_000],
    ["p99 objective", scenario.goals.maxP99Ms, 0.001, 60_000],
    ["minimum samples", scenario.goals.minSuccessfulSamples, 1, 1_000_000],
  ] as const) {
    if (!Number.isFinite(value) || value < min || value > max)
      issues.push(`Invalid scenario ${name}.`);
  }
  if (
    !["steady", "ramp", "spike", "diurnal"].includes(scenario.workload.pattern)
  ) {
    issues.push("The scenario workload pattern is not supported.");
  }
  if (scenario.constraints.allowTopologyChanges !== false)
    issues.push("This evaluator requires fixed scenario topology.");
  return issues;
}

/** Reject missing work and forbidden edits before spending time simulating. */
export function validateScenarioSubmission(
  topology: Topology,
  scenario: ScenarioDefinition,
): string[] {
  const issues = validateDefinition(scenario);
  if (
    !topology ||
    !Array.isArray(topology.nodes) ||
    !Array.isArray(topology.edges)
  ) {
    return [...issues, "The submitted design is not a simulation graph."];
  }
  const original = scenario.initialTopology;
  if (
    topology.nodes.length !== original.nodes.length ||
    topology.edges.length !== original.edges.length
  ) {
    issues.push(
      "Keep the components and connections supplied in this challenge.",
    );
  }
  const nodes = new Map(topology.nodes.map((node) => [node.id, node]));
  const edges = new Map(topology.edges.map((edge) => [edge.id, edge]));
  if (
    nodes.size !== topology.nodes.length ||
    edges.size !== topology.edges.length
  )
    issues.push("Component and connection IDs must be unique.");
  for (const id of scenario.constraints.requiredNodeIds) {
    if (!nodes.has(id)) issues.push(`Required component ${id} is missing.`);
  }
  for (const id of scenario.constraints.requiredEdgeIds) {
    if (!edges.has(id)) issues.push(`Required connection ${id} is missing.`);
  }
  for (const baseline of original.nodes) {
    const candidate = nodes.get(baseline.id);
    if (!candidate) continue;
    if (
      candidate.kind !== baseline.kind ||
      !candidate.config ||
      typeof candidate.config !== "object"
    ) {
      issues.push(`Keep the behavior model of ${baseline.id}.`);
      continue;
    }
    const before = { ...defaultConfig(baseline.kind), ...baseline.config };
    const after = { ...defaultConfig(baseline.kind), ...candidate.config };
    const editable = new Set<string>(
      scenario.constraints.allowedConfigFields[baseline.id] ?? [],
    );
    for (const key of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      const oldValue = before[key as keyof NodeConfig];
      const newValue = after[key as keyof NodeConfig];
      // The evaluator supplies the workload itself; sandbox slider values never score.
      if (baseline.kind === "client" && WORKLOAD_FIELDS.has(key)) continue;
      if (!editable.has(key) && !sameScalar(oldValue, newValue)) {
        issues.push(
          `${baseline.id}: ${key} is a fixed assumption in this challenge.`,
        );
      }
      if (
        typeof newValue === "number" &&
        (!Number.isFinite(newValue) || newValue < 0)
      ) {
        issues.push(
          `${baseline.id}: ${key} must be a finite nonnegative number.`,
        );
      }
      if (editable.has(key)) {
        if (
          typeof newValue !== "number" ||
          !Number.isFinite(newValue) ||
          newValue < 0
        ) {
          issues.push(
            `${baseline.id}: ${key} must be a finite nonnegative number.`,
          );
        } else if (INTEGER_FIELDS.has(key) && !Number.isSafeInteger(newValue)) {
          issues.push(`${baseline.id}: ${key} must be a whole number.`);
        }
      }
    }
    if (!(after.capacity >= 1) || !((after.instances ?? 1) >= 1)) {
      issues.push(
        `${baseline.id}: capacity and instances must be at least one.`,
      );
    }
    if (
      after.capacity > 512 ||
      (after.instances ?? 1) > 512 ||
      after.queueLimit > 50_000 ||
      after.retries > 10
    ) {
      issues.push(
        `${baseline.id}: configuration exceeds this evaluator's supported bounds.`,
      );
    }
  }
  for (const baseline of original.edges) {
    const candidate = edges.get(baseline.id);
    if (!candidate) continue;
    if (
      candidate.from !== baseline.from ||
      candidate.to !== baseline.to ||
      candidate.weight !== baseline.weight ||
      Boolean(candidate.control) !== Boolean(baseline.control) ||
      (candidate.latencyMs ?? 0) !== (baseline.latencyMs ?? 0) ||
      (candidate.bandwidthRps ?? 0) !== (baseline.bandwidthRps ?? 0) ||
      (candidate.lossRate ?? 0) !== (baseline.lossRate ?? 0)
    ) {
      issues.push(`Keep the required behavior of connection ${baseline.id}.`);
    }
  }
  if (!topology.nodes.some((node) => node.kind === "client"))
    issues.push("The required traffic source is missing.");
  const units = scenarioResourceUnits(topology);
  if (!Number.isFinite(units) || units > scenario.constraints.resourceBudget) {
    issues.push(
      `The design exceeds the ${scenario.constraints.resourceBudget} concurrency-unit budget.`,
    );
  }
  return [...new Set(issues)];
}

function goalResults(
  values: Pick<
    ScenarioSeedResult,
    "completionFraction" | "p95" | "p99" | "sampleCount"
  >,
  scenario: ScenarioDefinition,
): ScenarioGoalResult[] {
  return [
    {
      metric: "completionFraction",
      actual: values.completionFraction,
      threshold: scenario.goals.minCompletionFraction,
      comparison: ">=",
      met: values.completionFraction >= scenario.goals.minCompletionFraction,
    },
    {
      metric: "p95",
      actual: values.p95,
      threshold: scenario.goals.maxP95Ms,
      comparison: "<=",
      met: values.p95 !== null && values.p95 <= scenario.goals.maxP95Ms,
    },
    {
      metric: "p99",
      actual: values.p99,
      threshold: scenario.goals.maxP99Ms,
      comparison: "<=",
      met: values.p99 !== null && values.p99 <= scenario.goals.maxP99Ms,
    },
    {
      metric: "sampleCount",
      actual: values.sampleCount,
      threshold: scenario.goals.minSuccessfulSamples,
      comparison: ">=",
      met: values.sampleCount >= scenario.goals.minSuccessfulSamples,
    },
  ];
}

/** Recompute objective status from complete cohort evidence; not an authoritative public score. */
export function evaluateScenario(
  result: ScenarioResult,
  scenario: ScenarioDefinition,
): ScenarioResult {
  if (result.status === "invalid") return result;
  const seedResults = result.seedResults.map((seed) => {
    const goals = goalResults(seed, scenario);
    return {
      ...seed,
      goals,
      status:
        seed.status === "incomplete"
          ? ("incomplete" as const)
          : goals.every((goal) => goal.met)
            ? ("pass" as const)
            : ("fail" as const),
    };
  });
  const completeSeeds =
    seedResults.length === scenario.seeds.length &&
    scenario.seeds.every((seed) =>
      seedResults.some((item) => item.seed === seed),
    );
  const positiveSamples =
    seedResults.length > 0 && seedResults.every((seed) => seed.sampleCount > 0);
  const goals = goalResults(
    {
      completionFraction: seedResults.length
        ? Math.min(...seedResults.map((seed) => seed.completionFraction))
        : 0,
      p95: positiveSamples
        ? Math.max(...seedResults.map((seed) => seed.p95 ?? 0))
        : null,
      p99: positiveSamples
        ? Math.max(...seedResults.map((seed) => seed.p99 ?? 0))
        : null,
      sampleCount: seedResults.length
        ? Math.min(...seedResults.map((seed) => seed.sampleCount))
        : 0,
    },
    scenario,
  );
  return {
    ...result,
    seedResults,
    goals,
    status:
      !completeSeeds || seedResults.some((seed) => seed.status === "incomplete")
        ? "incomplete"
        : seedResults.every((seed) => seed.status === "pass")
          ? "pass"
          : "fail",
  };
}

/** Run in a worker or Node runner. No browser clock, API calls, or live-session state. */
export function runScenario(
  topology: Topology,
  scenario: ScenarioDefinition,
  options: ScenarioRunOptions = {},
): ScenarioResult {
  const issues = validateScenarioSubmission(topology, scenario);
  const result: ScenarioResult = {
    scenarioId: scenario.id,
    scenarioRevision: scenario.revision,
    modelVersion: MODEL_VERSION,
    profileVersion: PROFILE_VERSION,
    status: issues.length ? "invalid" : "incomplete",
    resourceUnits: issues.length ? 0 : scenarioResourceUnits(topology),
    seedResults: [],
    issues,
    goals: [],
  };
  if (issues.length) return result;
  const eventBudget = Math.min(
    100_000,
    Math.max(1, Math.floor(options.eventBudget ?? 20_000)),
  );
  const maxEvents = Math.min(
    20_000_000,
    Math.max(1, Math.floor(options.maxEventsPerSeed ?? DEFAULT_MAX_EVENTS)),
  );
  if (!Number.isFinite(eventBudget) || !Number.isFinite(maxEvents)) {
    return {
      ...result,
      status: "invalid",
      issues: ["Runner budgets must be finite numbers."],
    };
  }
  const cohortStart = scenario.warmupMs;
  const cohortEnd = cohortStart + scenario.measurementMs;
  const finish = cohortEnd + scenario.completionDeadlineMs;
  for (const seed of scenario.seeds) {
    const graph: Topology = {
      nodes: topology.nodes.map((node) => ({
        ...node,
        config: { ...node.config },
      })),
      edges: topology.edges.map((edge) => ({ ...edge })),
    };
    const sources = graph.nodes.filter((node) => node.kind === "client");
    for (const source of sources) {
      source.config.rps = scenario.workload.rps / sources.length;
      source.config.traffic = scenario.workload.pattern;
      source.config.trafficPeriodS = 60;
    }
    const runtime = createSimulation(graph, seed);
    let admitted = 0;
    let resolved = 0;
    let successful = 0;
    let missingDependencies = 0;
    let processedEvents = 0;
    let timeMs = 0;
    let stoppedArrivals = false;
    let limited = false;
    const latency = new LatencyHistogram();
    runtime.engine.setObserver({
      onRootOffered(event) {
        if (event.startedAtMs >= cohortStart && event.startedAtMs < cohortEnd)
          admitted += 1;
      },
      onRootCompleted(event) {
        if (event.startedAtMs < cohortStart || event.startedAtMs >= cohortEnd)
          return;
        resolved += 1;
        const completedRequired =
          scenario.constraints.requiredCompletedNodeIds.every((id) =>
            event.completedNodeIds.includes(id),
          );
        if (!completedRequired) missingDependencies += 1;
        const duration = event.completedAtMs - event.startedAtMs;
        if (
          event.ok &&
          completedRequired &&
          duration <= scenario.completionDeadlineMs
        ) {
          successful += 1;
          latency.record(duration);
        }
      },
    });
    while (timeMs < finish) {
      if (processedEvents >= maxEvents) {
        limited = true;
        break;
      }
      const target = !stoppedArrivals ? cohortEnd : finish;
      const progress = runtime.advanceTo(
        target,
        Math.min(eventBudget, maxEvents - processedEvents),
      );
      processedEvents += progress.processedEvents;
      const previousTime = timeMs;
      timeMs = progress.timeMs;
      if (progress.status === "resource-limited") {
        limited = true;
        break;
      }
      if (!stoppedArrivals && timeMs >= cohortEnd) {
        runtime.applyCommand({
          type: "workload",
          rps: 0,
          pattern: scenario.workload.pattern,
        });
        stoppedArrivals = true;
      }
      if (timeMs === previousTime && progress.processedEvents === 0) {
        limited = true;
        break;
      }
    }
    runtime.engine.setObserver(null);
    const seedResult: ScenarioSeedResult = {
      seed,
      status: limited ? "incomplete" : "fail",
      admitted,
      successful,
      failed: resolved - successful,
      pending: Math.max(0, admitted - resolved),
      missingDependencies,
      completionFraction: admitted ? successful / admitted : 0,
      p50: latency.count ? latency.quantile(0.5) : null,
      p95: latency.count ? latency.quantile(0.95) : null,
      p99: latency.count ? latency.quantile(0.99) : null,
      sampleCount: latency.count,
      simulatedMs: timeMs,
      processedEvents,
      goals: [],
    };
    result.seedResults.push(seedResult);
    if (limited) {
      result.issues.push(
        `Seed ${seed}: the evaluator reached its processing limit. This is an incomplete result, not a design failure.`,
      );
      break;
    }
  }
  return evaluateScenario(result, scenario);
}
