import type { NodeKind } from "./types";
import providerCatalog from "./provider-catalog.json";

export const PROFILE_VERSION = "profiles-v1";
export const NODE_KINDS: readonly NodeKind[] = [
  "client",
  "lb",
  "service",
  "cache",
  "db",
  "queue",
  "worker",
  "autoscaler",
  "region",
  "cdn",
  "ratelimiter",
  "breaker",
  "replica",
  "shard",
  "objectstore",
  "searchindex",
  "timeseriesdb",
  "graphdb",
  "coldstorage",
  "vectordb",
  "streambroker",
  "pubsub",
  "websocket",
  "apigateway",
  "sidecar",
  "lambda",
  "cron",
  "bulkhead",
  "retryqueue",
  "transcoder",
  "edgecompute",
  "writebehind",
  "loadshedder",
];
export type ModelClassification =
  | "dedicated"
  | "generic"
  | "structural"
  | "requires-model";
export interface CatalogProfile {
  componentId: string;
  kind?: NodeKind;
  classification: ModelClassification;
  assumption: string;
}

const localGroups: Partial<Record<NodeKind, readonly string[]>> = {
  client: [
    "web-app",
    "admin-console",
    "mobile-app",
    "desktop-app",
    "mcp-client",
    "client",
    "frontend",
  ],
  service: [
    "webserver",
    "frontend-server",
    "backend-server",
    "docker",
    "web-server",
    "application-server",
    "microservice",
    "backend",
    "server",
  ],
  lb: ["loadbalancer", "load-balancer", "reverse-proxy"],
  db: ["database", "data-warehouse", "feature-store"],
  cache: ["cache", "redis"],
  queue: ["queue", "message-broker"],
  pubsub: ["pubsub", "message-dispatcher"],
  worker: ["processing-worker", "stream-processor", "log-processing"],
  apigateway: ["api-gateway", "ai-gateway"],
  cdn: ["cdn"],
  searchindex: ["search", "search-engine"],
  coldstorage: ["cold-storage"],
  objectstore: ["object-storage", "file-storage", "prompt-store"],
  sidecar: ["service-mesh"],
  lambda: ["serverless-function"],
  edgecompute: ["edge-server"],
  ratelimiter: ["rate-limiter"],
  breaker: ["circuit-breaker"],
  vectordb: ["vector-database"],
};

const genericIds = [
  "auth-service",
  "id-generator",
  "notification-service",
  "recommendation-service",
  "payment-service",
  "analytics",
  "email-service",
  "sms-service",
  "secrets-manager",
  "ml-model",
  "model-serving",
  "llm-api",
  "mcp-server",
  "embedding-service",
  "ai-guardrails",
];
const structuralIds = [
  "shape-rectangle",
  "shape-square",
  "shape-ellipse",
  "shape-circle",
  "shape-diamond",
  "shape-triangle",
  "shape-hexagon",
  "shape-parallelogram",
  "shape-text",
  "shape-textbox",
  "shape-note",
  "group-cluster",
  "availability-zone",
  "vpc-network",
  "microservice-group",
  "security-boundary",
  "custom-group",
  "entity",
  "weak-entity",
  "er-trigger",
  "er-note",
  "er-use-case",
  "er-view",
  "uml-class",
  "uml-interface",
  "uml-abstract-class",
  "uml-enum",
  "uml-use-case",
  "uml-note",
  "data-collection",
  "data-document",
  "data-nested-object",
  "data-aggregation-stage",
  "data-schema-validator",
  "data-single-table",
  "data-access-pattern",
  "data-secondary-index",
  "data-stream",
  "data-wide-column-table",
  "data-partition-key",
  "data-clustering-key",
  "monitoring",
  "tracing",
  "ci-cd-pipeline",
  "build-server",
  "deployment-pipeline",
  "infrastructure-as-code",
  "artifact-repository",
  "configuration-management",
  "automated-testing",
  "code-quality",
  "security-scanning",
  "release-management",
  "environment-management",
  "github",
  "gitlab",
  "model-registry",
  "experiment-tracking",
];
const requiresModelIds = [
  "root-nameserver",
  "tld-nameserver",
  "authoritative-nameserver",
  "isp",
  "distributed-lock",
  "container-orchestrator",
  "kubernetes",
  "vpn-gateway",
  "firewall",
  "custom-component",
  "model-training",
  "data-labeling",
  "mlops-pipeline",
  "gpu-cluster",
  "ai-agent",
  "rag-pipeline",
  "ai-orchestrator",
  "fine-tuning",
];

const assumptions = {
  dedicated:
    "Educational behavior profile. Service time, concurrency and failures are model inputs, not provider measurements.",
  generic:
    "Generic service model: service time, concurrency, error rate and queueing only. Provider-specific internals and pricing are not modeled.",
  structural:
    "Documentation or control-plane context; this symbol does not carry application requests in this model.",
  "requires-model":
    "No executable model is assigned. Choose a behavior before placing this component on a request path.",
} satisfies Record<ModelClassification, string>;

function profile(
  componentId: string,
  classification: ModelClassification,
  kind?: NodeKind,
): CatalogProfile {
  return {
    componentId,
    classification,
    ...(kind ? { kind } : {}),
    assumption: assumptions[classification],
  };
}

/** Explicit, versioned identifiers only. Runtime labels never select behavior. */
export const CATALOG_PROFILES: Readonly<Record<string, CatalogProfile>> =
  Object.freeze({
    ...Object.fromEntries(
      Object.entries(providerCatalog.entries).map(([id, entry]) => [
        id,
        profile(
          id,
          entry.classification as ModelClassification,
          "kind" in entry ? (entry.kind as NodeKind) : undefined,
        ),
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(localGroups).flatMap(([kind, ids]) =>
        ids.map((id) => [id, profile(id, "dedicated", kind as NodeKind)]),
      ),
    ),
    ...Object.fromEntries(
      genericIds.map((id) => [id, profile(id, "generic", "service")]),
    ),
    ...Object.fromEntries(
      structuralIds.map((id) => [id, profile(id, "structural")]),
    ),
    ...Object.fromEntries(
      requiresModelIds.map((id) => [id, profile(id, "requires-model")]),
    ),
  });

export function isNodeKind(value: unknown): value is NodeKind {
  return typeof value === "string" && NODE_KINDS.includes(value as NodeKind);
}

export function resolveCatalogProfile(componentId: string): CatalogProfile {
  return (
    CATALOG_PROFILES[componentId] ?? profile(componentId, "requires-model")
  );
}
