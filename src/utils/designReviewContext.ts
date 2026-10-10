import type { Edge, Node } from "@xyflow/react";
import type {
  ComponentType,
  ConnectionType,
  DesignReasoningContext,
  SystemDesignProblem,
  SystemDesignSolution,
} from "../types/systemDesign";
import { getPurposeValue } from "./purposeMigration";

export function buildProvidedReasoningContext(
  problem: SystemDesignProblem | null,
  nodes: Node[],
  edges: Edge[],
): DesignReasoningContext {
  const spec = problem?.requirementSpec;
  const entries = spec
    ? [...spec.functional, ...spec.nonFunctional].filter(
        (requirement) => requirement.scope === "core",
      )
    : [];
  const original = [
    ...(problem?.requirements ?? []),
    ...(problem?.constraints ?? []),
  ];
  const targets = (category: string, pattern: RegExp) => {
    const matches = spec
      ? spec.nonFunctional
          .filter(
            (requirement) =>
              requirement.scope === "core" &&
              (requirement.category === category ||
                pattern.test(requirement.text)),
          )
          .map((requirement) => requirement.text)
      : original.filter((text) => pattern.test(text));
    return matches.length
      ? `Provided by the problem: ${matches.join("; ")}`
      : `No explicit ${category} target is specified. Explain your assumption if it affects this design.`;
  };
  const roles = nodes.map((node) =>
    String(node.data?.componentId ?? node.data?.type ?? node.type ?? "custom"),
  );
  const connected = new Set(
    edges.flatMap((edge) => [edge.source, edge.target]),
  );
  const disconnected = nodes.filter((node) => !connected.has(node.id)).length;
  return {
    requirements: problem
      ? [
          problem.description,
          ...(spec
            ? entries.map((entry) => `${entry.id}: ${entry.text}`)
            : original),
          ...(spec?.assumptions.length
            ? [
                "Reference assumptions (replaceable, not mandatory):",
                ...spec.assumptions,
              ]
            : []),
        ].join("\n")
      : "No exercise brief is attached; review the declared design intent.",
    scaleAssumptions: targets(
      "scale",
      /scale|million|billion|\bDAU\b|concurrent|large documents/i,
    ),
    expectedTraffic: targets(
      "traffic",
      /requests|traffic|per (second|day|month)|\bDAU\b/i,
    ),
    readWriteRatio: targets(
      "readWriteRatio",
      /read.heavy|write.heavy|read.*write|\d+:\d+/i,
    ),
    latencyGoals: targets("latency", /latency|\d+\s*ms|response time/i),
    availabilityTarget: targets("availability", /availability|uptime|\bSLA\b/i),
    consistencyRequirements: targets(
      "consistency",
      /consisten|without conflicts|uniqueness|unique|synchroniz/i,
    ),
    technologyChoices: roles.length
      ? `Canvas roles: ${Array.from(new Set(roles)).join(", ")}. Explain the choices and alternatives.`
      : "No components yet.",
    tradeoffs:
      "Explain the trade-offs of your submitted design; reference choices are not the only correct choices.",
    unresolvedRisks: disconnected
      ? `${disconnected} components are disconnected; review their purpose and failure paths.`
      : "Review failure paths using the actual connections and accepted design decisions.",
  };
}

/** Shared by the editor and fixtures so presentation types do not replace architectural roles. */
export function buildSystemDesignSolution(
  nodes: Node[],
  edges: Edge[],
  reasoningContext: DesignReasoningContext,
): SystemDesignSolution {
  return {
    components: nodes.map((node) => {
      const properties = { ...node.data };
      for (const key of [
        "icon",
        "iconUrl",
        "subtitle",
        "_guidedAppliedSteps",
        "width",
        "height",
        "selected",
        "dragging",
        "onChange",
        "onDelete",
      ])
        delete properties[key];
      return {
        id: node.id,
        type: String(
          node.data?.componentId ?? node.data?.type ?? node.type ?? "custom",
        ) as ComponentType,
        label: String(node.data?.label ?? node.id),
        position: node.position,
        properties,
      };
    }),
    connections: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: String(edge.data?.type ?? "api-call") as ConnectionType,
      label: typeof edge.data?.label === "string" ? edge.data.label : undefined,
      description:
        typeof getPurposeValue(edge.data ?? {}) === "string"
          ? (getPurposeValue(edge.data ?? {}) as string)
          : undefined,
      properties: edge.data ?? {},
    })),
    explanation: "",
    keyPoints: [],
    reasoningContext,
  };
}
