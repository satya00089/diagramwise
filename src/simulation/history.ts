import type {
  EventRunArtifact,
  RecordedCommand,
  SimulationScope,
} from "./protocol";
import { assertReplayTopology } from "@diagramwise/simulation-core";

export type SavedEventRun = {
  runId: string;
  createdAt: string;
  expiresAt: number;
  snapshot: EventRunArtifact;
};
const DATABASE = "diagramwise-simulation";
const STORE = "runs";
const MAX_BYTES = 240 * 1024;

export function parseEventRun(
  value: unknown,
  options: { allowLegacyExport?: boolean } = {},
): EventRunArtifact {
  const serialized = JSON.stringify(value);
  if (
    typeof serialized !== "string" ||
    new TextEncoder().encode(serialized).length > MAX_BYTES
  )
    throw new Error("Run files must be smaller than 240 KiB.");
  const artifact = JSON.parse(serialized) as EventRunArtifact;
  validateContract(artifact, options);
  validateDesign(artifact);
  const { ids, clientIds, edgeIds } = validateTopology(artifact);
  validateWorkload(artifact);
  validateCommands(artifact, ids, clientIds, edgeIds);
  validateResult(artifact);
  return artifact;
}

function validateContract(
  artifact: EventRunArtifact,
  options: { allowLegacyExport?: boolean },
) {
  const supportedEngine =
    artifact?.engineVersion === "event-v2" ||
    (options.allowLegacyExport && artifact?.engineVersion === "event-v1");
  if (
    artifact?.contractVersion !== "2" ||
    !supportedEngine ||
    artifact.profileVersion !== "profiles-v1"
  )
    throw new Error(
      "This file uses an unsupported simulation model. Exported runs from event-v1 can no longer be replayed with this engine.",
    );
}

function validateDesign(artifact: EventRunArtifact) {
  if (
    !artifact.scope ||
    typeof artifact.scope.designId !== "string" ||
    typeof artifact.scope.canvasId !== "string" ||
    typeof artifact.graphFingerprint !== "string"
  )
    throw new Error("This run is missing its design information.");
  try {
    assertReplayTopology(artifact.topology);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "This run has an invalid graph.",
    );
  }
}

function validateTopology(artifact: EventRunArtifact) {
  const ids = new Set<string>();
  const clientIds = new Set<string>();
  for (const node of artifact.topology.nodes) {
    if (!node || typeof node.id !== "string" || ids.has(node.id))
      throw new Error("This run contains an invalid component.");
    ids.add(node.id);
    if (node.kind === "client") clientIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of artifact.topology.edges) {
    if (
      !edge ||
      typeof edge.id !== "string" ||
      edgeIds.has(edge.id) ||
      !ids.has(edge.from) ||
      !ids.has(edge.to) ||
      !Number.isFinite(edge.weight) ||
      edge.weight <= 0
    )
      throw new Error("This run contains an invalid connection.");
    edgeIds.add(edge.id);
  }
  return { ids, clientIds, edgeIds };
}

function validateWorkload(artifact: EventRunArtifact) {
  if (
    !artifact.workload ||
    !Number.isFinite(artifact.workload.rps) ||
    artifact.workload.rps < 0 ||
    artifact.workload.rps > 100000 ||
    !Number.isInteger(artifact.workload.seed) ||
    artifact.workload.seed < 0 ||
    artifact.workload.seed > 0xffffffff ||
    !["steady", "ramp", "spike", "diurnal"].includes(artifact.workload.pattern)
  )
    throw new Error("This run contains an invalid workload.");
}

function validateCommands(
  artifact: EventRunArtifact,
  ids: Set<string>,
  clientIds: Set<string>,
  edgeIds: Set<string>,
) {
  if (!Array.isArray(artifact.commands) || artifact.commands.length > 1000)
    throw new Error("This run has too many recorded changes.");
  let previous = 0;
  for (const entry of artifact.commands) {
    if (
      !entry ||
      !Number.isFinite(entry.atMs) ||
      entry.atMs < previous ||
      entry.atMs > 86_400_000 ||
      !entry.command ||
      !["workload", "replicas", "fault", "clearFault"].includes(
        entry.command.type,
      )
    )
      throw new Error("This run contains an invalid command timeline.");
    previous = entry.atMs;
    validateCommand(entry.command, ids, clientIds, edgeIds);
  }
}

function validateCommand(
  command: RecordedCommand["command"],
  ids: Set<string>,
  clientIds: Set<string>,
  edgeIds: Set<string>,
) {
  if (command.type === "workload") {
    validateWorkloadCommand(command, clientIds);
    return;
  }
  if (!ids.has(command.nodeId))
    throw new Error("A recorded change refers to a missing component.");
  if (
    command.type === "replicas" &&
    (!Number.isInteger(command.instances) ||
      command.instances < 1 ||
      command.instances > 512)
  )
    throw new Error("Invalid replica count.");
  if (command.type === "fault") validateFaultCommand(command, edgeIds);
}

function validateWorkloadCommand(
  command: Extract<RecordedCommand["command"], { type: "workload" }>,
  clientIds: Set<string>,
) {
  if (
    !Number.isFinite(command.rps) ||
    command.rps < 0 ||
    command.rps > 100000 ||
    (command.pattern !== undefined &&
      !["steady", "ramp", "spike", "diurnal"].includes(command.pattern)) ||
    (command.clientIds !== undefined &&
      (!Array.isArray(command.clientIds) ||
        command.clientIds.length === 0 ||
        command.clientIds.length > clientIds.size ||
        new Set(command.clientIds).size !== command.clientIds.length ||
        command.clientIds.some(
          (id) => typeof id !== "string" || !clientIds.has(id),
        )))
  )
    throw new Error("Invalid recorded workload.");
}

function validateFaultCommand(
  command: Extract<RecordedCommand["command"], { type: "fault" }>,
  edgeIds: Set<string>,
) {
  if (!["crash", "slow", "errors", "partition"].includes(command.kind))
    throw new Error("Invalid fault type.");
  const opts = command.opts;
  if (opts === undefined) return;
  if (
    !opts ||
    typeof opts !== "object" ||
    Array.isArray(opts) ||
    Object.keys(opts).some(
      (key) => !["factor", "rate", "edgeIds"].includes(key),
    )
  )
    throw new Error("Invalid fault settings.");
  if (
    opts.factor !== undefined &&
    (!Number.isFinite(opts.factor) || opts.factor < 1 || opts.factor > 1000)
  )
    throw new Error("Invalid fault delay factor.");
  if (
    opts.rate !== undefined &&
    (!Number.isFinite(opts.rate) || opts.rate < 0 || opts.rate > 1)
  )
    throw new Error("Invalid fault error rate.");
  if (
    opts.edgeIds !== undefined &&
    (!Array.isArray(opts.edgeIds) ||
      opts.edgeIds.some((id) => typeof id !== "string" || !edgeIds.has(id)))
  )
    throw new Error("Invalid fault connections.");
}

function validateResult(artifact: EventRunArtifact) {
  if (artifact.result === undefined) return;
  const result = artifact.result;
  const numbers = [
    result.timeMs,
    result.offeredRps,
    result.goodputRps,
    result.errorRate,
    result.p50,
    result.p95,
    result.p99,
    result.totalRequests,
    result.totalFailed,
  ];
  if (
    numbers.some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isInteger(result.totalRequests) ||
    !Number.isInteger(result.totalFailed) ||
    result.errorRate > 1 ||
    result.p50 > result.p95 ||
    result.p95 > result.p99 ||
    result.totalFailed > result.totalRequests ||
    !["complete", "incomplete"].includes(result.status)
  )
    throw new Error("This run has an invalid result summary.");
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "runId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Local history is unavailable. You can still simulate and export runs.",
        ),
      );
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(
            "Local history could not be updated. Export the run to keep a copy.",
          ),
        );
    });
  } finally {
    db.close();
  }
}

export async function listLocalRuns(
  scope: SimulationScope,
): Promise<SavedEventRun[]> {
  const rows = (await transaction("readonly", (store) =>
    store.getAll(),
  )) as SavedEventRun[];
  return [
    ...rows.filter(
      (row) =>
        row.snapshot.scope.designId === scope.designId &&
        row.snapshot.scope.canvasId === scope.canvasId,
    ),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Save a run. Pass `runId` to keep one row per run: saving again with the same
 * id updates that row (a run that was paused, resumed and paused again) instead
 * of adding a near-identical copy.
 */
export async function saveLocalRun(
  snapshot: EventRunArtifact,
  runId?: string,
): Promise<SavedEventRun> {
  const validated = parseEventRun(snapshot);
  const db = await openDatabase();
  const row: SavedEventRun = {
    runId: runId || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    expiresAt: 0,
    snapshot: validated,
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let full = false;
      const addIfRoom = () => {
        const count = store.count();
        count.onsuccess = () => {
          if (count.result >= 50) {
            full = true;
            tx.abort();
          } else store.put(row);
        };
      };
      // Updating an existing run never needs more room.
      const existing = runId ? store.getKey(runId) : undefined;
      if (existing) {
        existing.onsuccess = () => {
          if (existing.result === undefined) addIfRoom();
          else store.put(row);
        };
      } else addIfRoom();
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(
            full
              ? "Local history is full (50 runs). Delete a run or export this one."
              : "Could not save locally. Export the run to keep a copy.",
          ),
        );
    });
    return row;
  } finally {
    db.close();
  }
}
export async function deleteLocalRun(id: string) {
  await transaction("readwrite", (store) => store.delete(id));
}

export function downloadRun(snapshot: EventRunArtifact) {
  const blob = new Blob(
    [
      JSON.stringify(
        parseEventRun(snapshot, { allowLegacyExport: true }),
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `diagramwise-run-${Date.now()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
