import { useEffect } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { Topology } from "@diagramwise/simulation-core";
import { simulationSession } from "./session";
import type { SimulationScope } from "./protocol";

export function useSimulationDocument(
  scope: SimulationScope,
  nodes: Node[],
  edges: Edge[],
) {
  const { designId, canvasId, exerciseId } = scope;
  useEffect(() => {
    simulationSession.bindDocument(
      { designId, canvasId, exerciseId },
      { nodes, edges },
    );
  }, [designId, canvasId, exerciseId, nodes, edges]);
  useEffect(() => () => simulationSession.dispose(), []);
}

export function topologyToCanvas(topology: Topology): {
  nodes: Node[];
  edges: Edge[];
} {
  return {
    nodes: topology.nodes.map((n) => ({
      id: n.id,
      type: "custom",
      position: { x: n.x, y: n.y },
      data: {
        label: n.label,
        componentId:
          n.kind === "client"
            ? "client"
            : n.kind === "db"
              ? "database"
              : n.kind === "service"
                ? "microservice"
                : n.kind,
        simulation: { kind: n.kind, config: n.config },
      },
    })),
    edges: topology.edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: "custom",
      data: {
        simulation: {
          mode: e.control ? "control" : "request",
          weight: e.weight,
          latencyMs: e.latencyMs,
        },
      },
    })),
  };
}
