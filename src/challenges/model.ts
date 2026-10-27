import { databaseBottleneckScenario } from "@diagramwise/simulation-core/scenarios";
import { validateScenarioSubmission } from "@diagramwise/simulation-core/scenario";
import {
  assertReplayTopology,
  type Topology,
} from "@diagramwise/simulation-core";

export const scenario = databaseBottleneckScenario;
export const challengeUrl = `/challenges/${scenario.id}`;
export const fields = [
  { key: "capacity", label: "Concurrent slots per instance", min: 1, max: 512 },
  { key: "instances", label: "Instances", min: 1, max: 512 },
  { key: "queueLimit", label: "Maximum waiting requests", min: 0, max: 50000 },
] as const;
export type RepairField = (typeof fields)[number]["key"];
export type Draft = {
  version: 1;
  revision: string;
  topology: Topology;
  hints: number;
};
export function initialDraft(): Draft {
  return {
    version: 1,
    revision: scenario.revision,
    topology: structuredClone(scenario.initialTopology),
    hints: 0,
  };
}
export function validateDraft(value: unknown): Draft {
  const draft = value as Draft;
  if (
    draft?.version !== 1 ||
    draft.revision !== scenario.revision ||
    !Number.isInteger(draft.hints) ||
    draft.hints < 0 ||
    draft.hints > scenario.hints.length
  )
    throw new Error(
      "This draft uses an unsupported challenge version. Export it before starting a new attempt.",
    );
  assertReplayTopology(draft.topology);
  if (
    draft.topology.nodes.some(
      (node) =>
        !Number.isFinite(node.x) ||
        !Number.isFinite(node.y) ||
        typeof node.label !== "string",
    )
  )
    throw new Error("The draft has invalid component presentation settings.");
  // Over-budget drafts remain editable. All other scenario constraints apply.
  const issues = validateScenarioSubmission(draft.topology, scenario).filter(
    (issue) => !issue.includes("concurrency-unit budget"),
  );
  if (issues.length) throw new Error(issues.join(" "));
  return structuredClone(draft);
}
export function repair(
  topology: Topology,
  nodeId: string,
  key: RepairField,
  value: number,
): Topology {
  const field = fields.find((item) => item.key === key);
  if (
    !field ||
    !scenario.constraints.allowedConfigFields[nodeId]?.includes(key) ||
    !Number.isInteger(value) ||
    value < field.min ||
    value > field.max
  )
    throw new Error("Enter a whole number within the allowed range.");
  const next = structuredClone(topology);
  const node = next.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error("Component not found.");
  node.config[key] = value;
  return next;
}
