import { Position } from "@xyflow/react";
import type { SimSnapshot, Topology } from "@diagramwise/simulation-core";
import type { ScenarioGoalResult } from "@diagramwise/simulation-core/scenario";
import { nodeSimulationSignal } from "../components/simulation/presentation";

export function formatGoalActual(goal: ScenarioGoalResult): string {
  if (goal.actual === null) return "No samples";
  const scale = goal.metric === "completionFraction" ? 100 : 1;
  const actual = goal.actual * scale;
  const threshold = goal.threshold * scale;
  const initialPrecision = scale === 100 ? 3 : 2;
  let formatted = actual.toFixed(initialPrecision);
  if (!goal.met && Number(formatted) === threshold && actual !== threshold) {
    for (let precision = initialPrecision + 1; precision <= 12; precision++) {
      formatted = actual.toFixed(precision);
      if (Number(formatted) !== threshold) break;
    }
    if (Number(formatted) === threshold) formatted = String(actual);
  }
  return `${formatted}${scale === 100 ? "%" : ""}`;
}

export function formatGoalTarget(goal: ScenarioGoalResult): string {
  if (goal.metric === "completionFraction") return `${goal.threshold * 100}%`;
  const unit = goal.metric.startsWith("p") ? " ms" : "";
  return `${goal.threshold}${unit}`;
}

function nodeType(kind: string): string {
  if (kind === "client") return "input";
  if (kind === "db") return "output";
  return "default";
}

export function buildChallengeNodes(
  topology: Topology,
  snapshot: SimSnapshot | null,
  selected: string,
) {
  return topology.nodes.map((item) => {
    const stats = snapshot?.nodes[item.id];
    const signal = nodeSimulationSignal(stats, item.kind);
    return {
      id: item.id,
      position: { x: item.x, y: item.y },
      type: nodeType(item.kind),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      selected: selected === item.id,
      className: `challenge-node challenge-node--${signal.tone}`,
      data: {
        label: (
          <>
            <strong>{item.label}</strong>
            <span>{signal.label}</span>
            {stats && (
              <small>
                {stats.arrivalRate.toFixed(1)} in/s · {stats.queued} waiting
              </small>
            )}
          </>
        ),
      },
    };
  });
}

export function buildChallengeEdges(
  topology: Topology,
  snapshot: SimSnapshot | null,
) {
  return topology.edges.map((edge) => {
    const flow = snapshot?.edgeFlow[edge.id] ?? 0;
    const target = snapshot?.nodes[edge.to];
    const pressure = (target?.queued ?? 0) > 0;
    const pressureLabel = pressure ? " · waiting downstream" : "";
    const label = snapshot ? `${flow.toFixed(1)}/s${pressureLabel}` : undefined;
    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label,
      style: {
        stroke: pressure ? "var(--brand, #e99ba9)" : "var(--text-muted, #888)",
        strokeWidth: 2,
      },
    };
  });
}
