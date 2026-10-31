import { describe, expect, it } from "vitest";
import { compileGraph } from "./compiler";

describe("compileGraph", () => {
  it("explains why a scheduled-job-only design cannot use request-rate controls", () => {
    const result = compileGraph({
      nodes: [
        { id: "schedule", data: { simulation: { kind: "cron" } } },
        { id: "worker", data: { simulation: { kind: "worker" } } },
      ],
      edges: [{ id: "scheduled-work", source: "schedule", target: "worker" }],
    });
    expect(result.topology).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "scheduled-source-needs-client",
        severity: "error",
      }),
    );
  });

  it("adds a visible virtual source for one unambiguous ingress", () => {
    const result = compileGraph({
      nodes: [
        {
          id: "api",
          data: { componentId: "microservice", label: "API" },
          position: { x: 100, y: 40 },
        },
        {
          id: "database",
          data: { componentId: "database", label: "Database" },
          position: { x: 350, y: 40 },
        },
      ],
      edges: [{ id: "api-db", source: "api", target: "database" }],
    });
    expect(result.topology?.nodes.map((node) => node.id)).toContain(
      "__simulation_source__",
    );
    expect(result.virtualSourceId).toBe("__simulation_source__");
    expect(result.trafficSource).toMatchObject({
      mode: "ingress",
      inferredNodeId: "api",
      requiresSelection: false,
      options: expect.arrayContaining([
        expect.objectContaining({ id: "api", label: "API" }),
        expect.objectContaining({ id: "database", label: "Database" }),
      ]),
    });
    expect(result.diagnostics.some((item) => item.severity === "error")).toBe(
      false,
    );
  });

  it("exposes ingress choices when automatic entrypoint inference is ambiguous", () => {
    const result = compileGraph({
      nodes: [
        { id: "api", data: { simulation: { kind: "service" }, label: "API" } },
        {
          id: "worker",
          data: { simulation: { kind: "worker" }, label: "Worker" },
        },
      ],
      edges: [],
    });
    expect(result.topology).toBeNull();
    expect(result.trafficSource).toMatchObject({
      mode: "ingress",
      requiresSelection: true,
      options: expect.arrayContaining([
        expect.objectContaining({ id: "api" }),
        expect.objectContaining({ id: "worker" }),
      ]),
    });
  });

  it("uses the selected component as the virtual traffic entrypoint", () => {
    const result = compileGraph({
      nodes: [
        { id: "api", data: { simulation: { kind: "service" }, label: "API" } },
        {
          id: "database",
          data: {
            simulation: { kind: "db", entrypoint: true },
            label: "Database",
          },
        },
      ],
      edges: [{ id: "api-db", source: "api", target: "database" }],
    });
    expect(result.trafficSource).toMatchObject({
      mode: "ingress",
      selectedNodeId: "database",
      requiresSelection: false,
    });
    expect(result.topology?.edges).toContainEqual(
      expect.objectContaining({
        from: "__simulation_source__",
        to: "database",
      }),
    );
  });

  it("distributes traffic across physical clients unless one is selected", () => {
    const document = {
      nodes: [
        {
          id: "client-a",
          data: { simulation: { kind: "client" }, label: "Browser A" },
        },
        {
          id: "client-b",
          data: { simulation: { kind: "client" }, label: "Browser B" },
        },
        { id: "api", data: { simulation: { kind: "service" }, label: "API" } },
      ],
      edges: [
        { id: "a-api", source: "client-a", target: "api" },
        { id: "b-api", source: "client-b", target: "api" },
      ],
    };
    const distributed = compileGraph(document, { requestRate: 100 });
    expect(distributed.trafficSource).toMatchObject({
      mode: "clients",
      requiresSelection: false,
      options: expect.arrayContaining([
        expect.objectContaining({ id: "client-a" }),
        expect.objectContaining({ id: "client-b" }),
      ]),
    });
    expect(
      distributed.topology?.nodes.find((node) => node.id === "client-a")?.config
        .rps,
    ).toBe(50);
    expect(
      distributed.topology?.nodes.find((node) => node.id === "client-b")?.config
        .rps,
    ).toBe(50);

    const selected = compileGraph(
      {
        ...document,
        nodes: document.nodes.map((node) =>
          node.id === "client-b"
            ? {
                ...node,
                data: {
                  ...node.data,
                  simulation: { ...node.data.simulation, entrypoint: true },
                },
              }
            : node,
        ),
      },
      { requestRate: 100 },
    );
    expect(selected.trafficSource).toMatchObject({
      mode: "clients",
      selectedNodeId: "client-b",
      requiresSelection: false,
    });
    expect(
      selected.topology?.nodes.find((node) => node.id === "client-a")?.config
        .rps,
    ).toBe(0);
    expect(
      selected.topology?.nodes.find((node) => node.id === "client-b")?.config
        .rps,
    ).toBe(100);

    const selectedWithDisconnectedClient = compileGraph(
      {
        ...document,
        nodes: document.nodes.map((node) =>
          node.id === "client-b"
            ? {
                ...node,
                data: {
                  ...node.data,
                  simulation: { ...node.data.simulation, entrypoint: true },
                },
              }
            : node,
        ),
        edges: [{ id: "b-api", source: "client-b", target: "api" }],
      },
      { requestRate: 100 },
    );
    expect(selectedWithDisconnectedClient.topology).not.toBeNull();
    expect(selectedWithDisconnectedClient.diagnostics).not.toContainEqual(
      expect.objectContaining({
        code: "disconnected-source",
        nodeId: "client-a",
      }),
    );
  });

  it("explains a reachable work queue without a pull consumer and its idle destinations", () => {
    const result = compileGraph({
      nodes: [
        {
          id: "client",
          data: { simulation: { kind: "client" }, label: "Browser" },
        },
        {
          id: "events",
          data: { simulation: { kind: "queue" }, label: "Operation Event Bus" },
        },
        {
          id: "database",
          data: { simulation: { kind: "db" }, label: "Document Database" },
        },
        {
          id: "search",
          data: { simulation: { kind: "searchindex" }, label: "Search Index" },
        },
        {
          id: "optional",
          data: { simulation: { kind: "cache" }, label: "Optional cache" },
        },
      ],
      edges: [
        { id: "publish", source: "client", target: "events" },
        { id: "database-write", source: "events", target: "database" },
        { id: "index-write", source: "events", target: "search" },
      ],
    });
    expect(result.topology).not.toBeNull();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "queue-without-consumer",
          nodeId: "events",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "unreachable-component",
          nodeId: "database",
          severity: "warning",
          message: expect.stringContaining(
            "No delivery from Operation Event Bus",
          ),
        }),
        expect.objectContaining({
          code: "unreachable-component",
          nodeId: "search",
          severity: "warning",
          message: expect.stringContaining(
            "No delivery from Operation Event Bus",
          ),
        }),
        expect.objectContaining({
          code: "unreachable-component",
          nodeId: "optional",
          severity: "info",
        }),
      ]),
    );
  });

  it.each([
    ["queue to worker", { id: "consume", source: "events", target: "worker" }],
    ["worker to queue", { id: "consume", source: "worker", target: "events" }],
  ])(
    "treats a %s link as a pull relationship, not a pushed request route",
    (_name, consumerEdge) => {
      const result = compileGraph({
        nodes: [
          { id: "client", data: { simulation: { kind: "client" } } },
          { id: "events", data: { simulation: { kind: "queue" } } },
          { id: "worker", data: { simulation: { kind: "worker" } } },
          { id: "database", data: { simulation: { kind: "db" } } },
        ],
        edges: [
          { id: "publish", source: "client", target: "events" },
          consumerEdge,
          { id: "persist", source: "worker", target: "database" },
        ],
      });
      expect(result.topology).not.toBeNull();
      expect(
        result.diagnostics.some(
          (item) => item.code === "queue-without-consumer",
        ),
      ).toBe(false);
      expect(
        result.diagnostics.some(
          (item) =>
            item.code === "unreachable-component" && item.nodeId === "database",
        ),
      ).toBe(false);
      expect(
        result.diagnostics.some((item) => item.code === "request-cycle"),
      ).toBe(false);
    },
  );

  it("does not treat control edges as traffic reachability or mistake cache hits for a broken path", () => {
    const result = compileGraph({
      nodes: [
        { id: "client", data: { simulation: { kind: "client" } } },
        {
          id: "cache",
          data: { simulation: { kind: "cache", config: { hitRate: 1 } } },
        },
        { id: "database", data: { simulation: { kind: "db" } } },
        { id: "autoscaler", data: { simulation: { kind: "autoscaler" } } },
        { id: "unreachable", data: { simulation: { kind: "service" } } },
      ],
      edges: [
        { id: "client-cache", source: "client", target: "cache" },
        { id: "cache-db", source: "cache", target: "database" },
        {
          id: "scale-db",
          source: "autoscaler",
          target: "unreachable",
          data: { simulation: { mode: "control" } },
        },
      ],
    });
    expect(
      result.diagnostics.some(
        (item) =>
          item.code === "unreachable-component" && item.nodeId === "database",
      ),
    ).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "unreachable-component",
        nodeId: "unreachable",
        severity: "info",
      }),
    );
  });

  it("requires a chosen model for an unknown component on a request path", () => {
    const result = compileGraph({
      nodes: [
        { id: "client", data: { componentId: "client", label: "Client" } },
        {
          id: "unknown",
          data: { componentId: "future-vendor-service", label: "Unknown" },
        },
      ],
      edges: [{ id: "client-unknown", source: "client", target: "unknown" }],
    });
    expect(result.topology).toBeNull();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unmodeled-component",
          nodeId: "unknown",
          severity: "error",
        }),
      ]),
    );
  });

  it("keeps cosmetic edits out of its semantic fingerprint", () => {
    const base = {
      nodes: [
        {
          id: "client",
          data: {
            componentId: "client",
            label: "Client",
            backgroundColor: "#000",
          },
          position: { x: 0, y: 0 },
        },
        {
          id: "api",
          data: { componentId: "microservice", label: "API" },
          position: { x: 200, y: 0 },
        },
      ],
      edges: [
        {
          id: "client-api",
          source: "client",
          target: "api",
          data: { color: "#fff" },
        },
      ],
    };
    const moved = structuredClone(base);
    moved.nodes[0].data.label = "Renamed client";
    moved.nodes[0].position = { x: 900, y: 800 };
    moved.nodes[1].data.backgroundColor = "#f0f";
    expect(compileGraph(base).fingerprint).toBe(
      compileGraph(moved).fingerprint,
    );
  });
});

describe("direct data access from a client", () => {
  const node = (id: string, componentId: string, label: string) => ({
    id,
    data: { componentId, label },
  });

  it("refuses a web client wired straight to a database", () => {
    const result = compileGraph({
      nodes: [
        node("web", "web-app", "Web Client"),
        node("db", "database", "Postgres"),
      ],
      edges: [{ id: "web-db", source: "web", target: "db" }],
    });
    expect(result.topology).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "client-to-datastore",
        severity: "error",
        edgeId: "web-db",
        action: "fix-connection",
        message: expect.stringContaining(
          "Web Client connects straight to Postgres",
        ),
      }),
    );
  });

  it("accepts the same store behind a backend service", () => {
    const result = compileGraph({
      nodes: [
        node("web", "web-app", "Web Client"),
        node("api", "backend-server", "API"),
        node("db", "database", "Postgres"),
      ],
      edges: [
        { id: "web-api", source: "web", target: "api" },
        { id: "api-db", source: "api", target: "db" },
      ],
    });
    expect(result.topology).not.toBeNull();
    expect(result.diagnostics.map((item) => item.code)).not.toContain(
      "client-to-datastore",
    );
  });

  it.each([
    ["object storage, for pre-signed transfers", "object-storage"],
    ["a warehouse, which BI tools query directly", "data-warehouse"],
  ])("allows a client to reach %s", (_, componentId) => {
    const result = compileGraph({
      nodes: [
        node("web", "web-app", "Web Client"),
        node("store", componentId, "Store"),
      ],
      edges: [{ id: "web-store", source: "web", target: "store" }],
    });
    expect(result.diagnostics.map((item) => item.code)).not.toContain(
      "client-to-datastore",
    );
  });

  it("leaves a documentation arrow to a database alone", () => {
    const result = compileGraph({
      nodes: [
        node("web", "web-app", "Web Client"),
        node("api", "backend-server", "API"),
        node("db", "database", "Postgres"),
      ],
      edges: [
        { id: "web-api", source: "web", target: "api" },
        { id: "api-db", source: "api", target: "db" },
        {
          id: "web-db-note",
          source: "web",
          target: "db",
          data: { simulation: { mode: "annotation" } },
        },
      ],
    });
    expect(result.diagnostics.map((item) => item.code)).not.toContain(
      "client-to-datastore",
    );
  });
});

describe("documentation-only components", () => {
  const node = (id: string, componentId: string, simulation?: object) => ({
    id,
    data: { componentId, label: id, ...(simulation ? { simulation } : {}) },
  });
  const graph = (secretsSimulation?: object) => ({
    nodes: [
      node("web", "web-app"),
      node("api", "backend-server"),
      node("secrets", "secrets-manager", secretsSimulation),
    ],
    edges: [
      { id: "web-api", source: "web", target: "api" },
      { id: "secrets-api", source: "secrets", target: "api" },
    ],
  });

  it("simulates an unmarked secrets manager as a generic service", () => {
    const result = compileGraph(graph());
    expect(result.topology?.nodes.map((n) => n.id)).toContain("secrets");
  });

  it("keeps a documentation component out of the run without any warning", () => {
    const result = compileGraph(graph({ mode: "documentation" }));
    expect(result.topology).not.toBeNull();
    expect(result.topology?.nodes.map((n) => n.id)).not.toContain("secrets");
    expect(result.topology?.edges.map((e) => e.id)).toEqual(["web-api"]);
    expect(
      result.diagnostics.filter((item) => item.severity !== "info"),
    ).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "documentation-connection",
        edgeId: "secrets-api",
      }),
    );
  });
});

describe("direct data access guard scope", () => {
  const node = (id: string, componentId: string, simulation?: object) => ({
    id,
    data: { componentId, label: id, ...(simulation ? { simulation } : {}) },
  });

  it("does not fault a backend service that is modelled as where traffic starts", () => {
    const result = compileGraph({
      nodes: [
        node("job", "backend-server", { kind: "client" }),
        node("db", "database"),
      ],
      edges: [{ id: "job-db", source: "job", target: "db" }],
    });
    expect(result.diagnostics.map((item) => item.code)).not.toContain(
      "client-to-datastore",
    );
  });

  it("still faults an end-user client even when it is given an explicit client model", () => {
    const result = compileGraph({
      nodes: [
        node("web", "web-app", { kind: "client" }),
        node("db", "database"),
      ],
      edges: [{ id: "web-db", source: "web", target: "db" }],
    });
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "client-to-datastore",
    );
  });
});

describe("choosing a model for a documentation component", () => {
  it("brings the component back into the run", () => {
    const result = compileGraph({
      nodes: [
        { id: "web", data: { componentId: "web-app", label: "web" } },
        { id: "api", data: { componentId: "backend-server", label: "api" } },
        {
          id: "audit",
          data: {
            componentId: "custom-component",
            label: "audit",
            simulation: { mode: "documentation", kind: "service" },
          },
        },
      ],
      edges: [
        { id: "web-api", source: "web", target: "api" },
        { id: "api-audit", source: "api", target: "audit" },
      ],
    });
    expect(result.topology?.nodes.map((n) => n.id)).toContain("audit");
    expect(result.topology?.edges.map((e) => e.id)).toContain("api-audit");
  });
});

describe("a documentation component placed inline on a path", () => {
  it("cuts the path and says so, instead of silently simulating nothing", () => {
    const node = (id: string, componentId: string, simulation?: object) => ({
      id,
      data: { componentId, label: id, ...(simulation ? { simulation } : {}) },
    });
    const result = compileGraph({
      nodes: [
        node("web", "web-app"),
        node("gate", "custom-component", { mode: "documentation" }),
        node("api", "backend-server"),
      ],
      edges: [
        { id: "web-gate", source: "web", target: "gate" },
        { id: "gate-api", source: "gate", target: "api" },
      ],
    });
    expect(result.topology).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "disconnected-source",
        severity: "error",
        nodeId: "web",
      }),
    );
  });
});
