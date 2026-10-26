import { describe, expect, it } from "vitest";
import { COMPONENTS } from "../config/components";
import { applyGuidedStep, getAppliedGuidedSteps } from "./guidedWalkthrough";
import {
  buildProvidedReasoningContext,
  buildSystemDesignSolution,
} from "./designReviewContext";
import {
  buildAssessmentPayload,
  fingerprintAssessmentPayload,
} from "./assessor";
import type { GuidedStep, SystemDesignProblem } from "../types/systemDesign";
import type { GuidedWalkthrough } from "../types/systemDesign";
import { Engine } from "@diagramwise/simulation-core";
import { compileGraph } from "@diagramwise/simulation-core/compiler";
import documentCandidate from "../test-fixtures/document-walkthrough.json";
import documentWalkthroughCandidate from "../test-fixtures/walkthroughs/6901ef1b9420d83630aca871.json";

const step: GuidedStep = {
  id: "s1",
  stepNumber: 1,
  phase: "core",
  title: "API",
  type: "add_component",
  content: "Read the lesson",
  component: {
    nodeId: "n1",
    componentType: "api-gateway",
    label: "API Gateway",
    position: { x: 0, y: 0 },
    highlightReason: "Routes requests",
    properties: { description: "Validates authenticated requests" },
  },
};

describe("walkthrough application and review serialization", () => {
  const candidateFixtures = import.meta.glob(
    "../test-fixtures/walkthroughs/*.json",
    { eager: true, import: "default" },
  );
  it.each(Object.entries(candidateFixtures))(
    "applies every candidate through the editor helper and save/reload: %s",
    (_path, raw) => {
      const candidate = raw as GuidedWalkthrough;
      const canvas = candidate.steps.reduce(
        (current, action) => applyGuidedStep(current, action),
        { nodes: [], edges: [] } as Parameters<typeof applyGuidedStep>[0],
      );
      const reloaded = JSON.parse(JSON.stringify(canvas));
      const payload = buildAssessmentPayload(
        buildSystemDesignSolution(reloaded.nodes, reloaded.edges, {}),
      );
      const componentSteps = candidate.steps.filter(
        (action) => action.component,
      );
      const connectionSteps = candidate.steps.filter(
        (action) => action.connection,
      );
      expect(payload.components).toHaveLength(componentSteps.length);
      expect(payload.connections).toHaveLength(connectionSteps.length);
      for (const action of connectionSteps)
        expect(
          payload.connections.find(
            (edge) => edge.id === action.connection!.edgeId,
          )?.type,
        ).toBe(action.connection!.connectionType);
      for (const action of candidate.steps.filter(
        (action) => action.componentUpdate,
      )) {
        const node = payload.components.find(
          (component) => component.id === action.componentUpdate!.nodeId,
        );
        expect(node?.properties).toMatchObject(
          action.componentUpdate!.properties,
        );
      }
      expect(getAppliedGuidedSteps(reloaded)).toHaveLength(
        candidate.steps.length,
      );
    },
  );
  it("builds the document candidate through the real apply path, retaining hardening decisions", () => {
    const guide = documentCandidate as unknown as GuidedWalkthrough;
    const canvas = guide.steps.reduce(
      (current, guidedStep) => applyGuidedStep(current, guidedStep),
      { nodes: [], edges: [] } as Parameters<typeof applyGuidedStep>[0],
    );
    const reloaded = JSON.parse(JSON.stringify(canvas));
    const payload = buildAssessmentPayload(
      buildSystemDesignSolution(reloaded.nodes, reloaded.edges, {}),
    );
    expect(canvas.nodes).toHaveLength(11);
    expect(canvas.edges).toHaveLength(10);
    const store = payload.components.find(
      (component) => component.id === "guided_file_storage",
    );
    expect(store?.properties.componentId).toBe("object-storage");
    expect(store?.properties.provider).toBe("S3");
    expect(store?.properties.encryption).toContain("encryption at rest");
    const collaboration = payload.components.find(
      (component) => component.id === "guided_collab_server",
    );
    expect(collaboration?.type).toBe("backend");
    expect(collaboration?.properties.reconnectProtocol).toContain(
      "deduplicate",
    );
    expect(
      payload.connections.find((edge) => edge.target === "guided_collab_server")
        ?.type,
    ).toBe("websocket");
    expect(getAppliedGuidedSteps(reloaded)).toContain(
      guide.steps.find((guidedStep) => guidedStep.stepNumber === 41)!.id,
    );
    const compiled = compileGraph(canvas);
    expect(compiled.diagnostics).toContainEqual(expect.objectContaining({
      code: "queue-without-consumer",
      nodeId: "guided_message_broker",
      severity: "warning",
    }));
    for (const nodeId of ["guided_database", "guided_file_storage", "guided_search", "guided_cache_response"])
      expect(compiled.diagnostics).toContainEqual(expect.objectContaining({
        code: "unreachable-component",
        nodeId,
        severity: "warning",
      }));
  });
  it("applies the Kafka guide's explicit stream broker model through the editor node factory", () => {
    const guide = documentWalkthroughCandidate as unknown as GuidedWalkthrough;
    const kafkaStep = guide.steps.find(step => step.component?.nodeId === "guided_message_broker")!;
    const canvas = applyGuidedStep(
      { nodes: [], edges: [] },
      kafkaStep,
      () => ({
        id: kafkaStep.component!.nodeId,
        type: "custom",
        position: kafkaStep.component!.position,
        data: { componentId: kafkaStep.component!.componentType, label: kafkaStep.component!.label },
      }),
    );
    expect(canvas.nodes[0].data.simulation).toEqual({ kind: "streambroker", config: { partitions: 24 } });
    const compiled = compileGraph(canvas);
    const broker = compiled.topology?.nodes.find(node => node.id === "guided_message_broker");
    expect(broker?.kind).toBe("streambroker");
    expect(broker?.config.partitions).toBe(24);
  });
  it.each([1, 42, 1337])("delivers Kafka guide traffic to every direct consumer at seed %i", (seed) => {
    const guide = documentWalkthroughCandidate as unknown as GuidedWalkthrough;
    const canvas = guide.steps.reduce(
      (current, guidedStep) => applyGuidedStep(current, guidedStep),
      { nodes: [], edges: [] } as Parameters<typeof applyGuidedStep>[0],
    );
    const topology = compileGraph(canvas).topology;
    expect(topology).not.toBeNull();
    const engine = new Engine(topology!, seed);
    for (let frame = 0; frame < 44 * 60; frame += 1) engine.advance(1000 / 60);
    const snapshot = engine.snapshot();

    for (const nodeId of ["guided_database", "guided_file_storage", "guided_search", "guided_cache_response"])
      expect(snapshot.nodes[nodeId].arrivalRate, `${nodeId} at seed ${seed}`).toBeGreaterThan(0);
    expect(snapshot.nodes.guided_message_broker.consumerLag).toBeGreaterThanOrEqual(0);
  });
  it("is idempotent and persists explicit application without credit for reading", () => {
    const empty = { nodes: [], edges: [] };
    expect(applyGuidedStep(empty, { ...step, type: "explanation" })).toBe(
      empty,
    );
    const result = applyGuidedStep(empty, step);
    expect(applyGuidedStep(result, step)).toBe(result);
    expect(getAppliedGuidedSteps(JSON.parse(JSON.stringify(result)))).toEqual([
      "s1",
    ]);
  });
  it("persists accepted properties and preserves the catalog role", () => {
    const initial = applyGuidedStep({ nodes: [], edges: [] }, step);
    const updated = applyGuidedStep(initial, {
      ...step,
      id: "s2",
      type: "update_component",
      component: undefined,
      componentUpdate: {
        nodeId: "n1",
        properties: { rateLimiting: "Per-user token bucket" },
      },
    });
    const payload = buildAssessmentPayload(
      buildSystemDesignSolution(updated.nodes, updated.edges, {}),
    );
    expect(payload.components[0].type).toBe("api-gateway");
    expect(payload.components[0].properties.rateLimiting).toBe(
      "Per-user token bucket",
    );
    expect(
      payload.components[0].properties._guidedAppliedSteps,
    ).toBeUndefined();
  });
  it("preserves connection protocol and rejects missing prerequisites", () => {
    const edgeStep: GuidedStep = {
      ...step,
      id: "e",
      type: "add_connection",
      component: undefined,
      connection: {
        edgeId: "e1",
        sourceNodeId: "n1",
        targetNodeId: "n2",
        connectionType: "websocket",
        label: "Edits",
        description: "Bidirectional edit session",
      },
    };
    const initial = applyGuidedStep({ nodes: [], edges: [] }, step);
    expect(applyGuidedStep(initial, edgeStep)).toBe(initial);
    const ready = applyGuidedStep(initial, {
      ...step,
      id: "n2-step",
      component: {
        ...step.component!,
        nodeId: "n2",
        componentType: "backend-server",
      },
    });
    const result = applyGuidedStep(ready, edgeStep);
    const solution = buildSystemDesignSolution(result.nodes, result.edges, {});
    expect(solution.connections[0].type).toBe("websocket");
    expect(applyGuidedStep(result, edgeStep)).toBe(result);
    expect(fingerprintAssessmentPayload(buildAssessmentPayload(solution))).toBe(
      fingerprintAssessmentPayload(
        buildAssessmentPayload({
          ...solution,
          components: solution.components.map((component) => ({
            ...component,
            position: { x: 500, y: 300 },
          })),
        }),
      ),
    );
  });
  it("uses known problem targets instead of claiming they are unspecified", () => {
    const problem = {
      description: "URL service",
      requirements: ["99.9% availability"],
      constraints: ["Redirect latency <100ms"],
    } as SystemDesignProblem;
    const context = buildProvidedReasoningContext(problem, [], []);
    expect(context.availabilityTarget).toContain("99.9%");
    expect(context.latencyGoals).toContain("<100ms");
    expect(context.expectedTraffic).toContain("No explicit");
  });
});

describe("cloud provider choices on existing components", () => {
  const optionsFor = (componentId: string, propertyKey: string) => {
    const component = COMPONENTS.find((candidate) => candidate.id === componentId);
    return component?.properties?.find((property) => property.key === propertyKey)
      ?.options;
  };

  it.each([
    ["cdn", "provider", "Google Cloud CDN"],
    ["search", "engine", "Azure Cognitive Search"],
    ["search-engine", "engine", "Azure Cognitive Search"],
    ["service-mesh", "provider", "Google Cloud Anthos Service Mesh"],
    ["stream-processor", "engine", "Google Cloud Dataflow"],
    ["monitoring", "stack", "Google Cloud Monitoring"],
    ["monitoring", "stack", "Azure Monitor"],
    ["monitoring", "stack", "Azure Application Insights"],
    ["configuration-management", "tool", "Google Config Sync"],
    ["configuration-management", "tool", "Anthos Config Management"],
  ])("%s.%s supports %s", (componentId, propertyKey, option) => {
    expect(optionsFor(componentId, propertyKey)).toContain(option);
  });
});
