import type { EventRunArtifact, SimulationScope } from "./protocol";
import { assertReplayTopology } from "@diagramwise/simulation-core";

export type SavedEventRun = { runId: string; createdAt: string; expiresAt: number; snapshot: EventRunArtifact };
const DATABASE = "diagramwise-simulation";
const STORE = "runs";
const MAX_BYTES = 240 * 1024;

export function parseEventRun(value: unknown, options: { allowLegacyExport?: boolean } = {}): EventRunArtifact {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string" || new TextEncoder().encode(serialized).length > MAX_BYTES) throw new Error("Run files must be smaller than 240 KiB.");
  const artifact = JSON.parse(serialized) as EventRunArtifact;
  const supportedEngine = artifact?.engineVersion === "event-v2" || (options.allowLegacyExport && artifact?.engineVersion === "event-v1");
  if (artifact?.contractVersion !== "2" || !supportedEngine || artifact.profileVersion !== "profiles-v1") throw new Error("This file uses an unsupported simulation model. Exported runs from event-v1 can no longer be replayed with this engine.");
  if (!artifact.scope || typeof artifact.scope.designId !== "string" || typeof artifact.scope.canvasId !== "string" || typeof artifact.graphFingerprint !== "string") throw new Error("This run is missing its design information.");
  try { assertReplayTopology(artifact.topology); }
  catch (error) { throw new Error(error instanceof Error ? error.message : "This run has an invalid graph."); }
  const ids = new Set<string>();
  for (const node of artifact.topology.nodes) {
    if (!node || typeof node.id !== "string" || ids.has(node.id)) throw new Error("This run contains an invalid component.");
    ids.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of artifact.topology.edges) {
    if (!edge || typeof edge.id !== "string" || edgeIds.has(edge.id) || !ids.has(edge.from) || !ids.has(edge.to) || !Number.isFinite(edge.weight) || edge.weight <= 0) throw new Error("This run contains an invalid connection.");
    edgeIds.add(edge.id);
  }
  if (!artifact.workload || !Number.isFinite(artifact.workload.rps) || artifact.workload.rps < 0 || artifact.workload.rps > 100000 || !Number.isInteger(artifact.workload.seed) || artifact.workload.seed < 0 || artifact.workload.seed > 0xffffffff || !["steady", "ramp", "spike", "diurnal"].includes(artifact.workload.pattern)) throw new Error("This run contains an invalid workload.");
  if (!Array.isArray(artifact.commands) || artifact.commands.length > 1000) throw new Error("This run has too many recorded changes.");
  let previous = 0;
  for (const entry of artifact.commands) {
    if (!entry || !Number.isFinite(entry.atMs) || entry.atMs < previous || entry.atMs > 86_400_000 || !entry.command || !["workload", "replicas", "fault", "clearFault"].includes(entry.command.type)) throw new Error("This run contains an invalid command timeline.");
    previous = entry.atMs;
    const c = entry.command;
    if (c.type === "workload" && (!Number.isFinite(c.rps) || c.rps < 0 || c.rps > 100000 || (c.pattern !== undefined && !["steady", "ramp", "spike", "diurnal"].includes(c.pattern)))) throw new Error("Invalid recorded workload.");
    if (c.type !== "workload" && !ids.has(c.nodeId)) throw new Error("A recorded change refers to a missing component.");
    if (c.type === "replicas" && (!Number.isInteger(c.instances) || c.instances < 1 || c.instances > 512)) throw new Error("Invalid replica count.");
    if (c.type === "fault") {
      if (!["crash", "slow", "errors", "partition"].includes(c.kind)) throw new Error("Invalid fault type.");
      if (c.opts !== undefined) {
        if (!c.opts || typeof c.opts !== "object" || Array.isArray(c.opts) || Object.keys(c.opts).some(key => !["factor", "rate", "edgeIds"].includes(key))) throw new Error("Invalid fault settings.");
        if (c.opts.factor !== undefined && (!Number.isFinite(c.opts.factor) || c.opts.factor < 1 || c.opts.factor > 1000)) throw new Error("Invalid fault delay factor.");
        if (c.opts.rate !== undefined && (!Number.isFinite(c.opts.rate) || c.opts.rate < 0 || c.opts.rate > 1)) throw new Error("Invalid fault error rate.");
        if (c.opts.edgeIds !== undefined && (!Array.isArray(c.opts.edgeIds) || c.opts.edgeIds.some(id => typeof id !== "string" || !edgeIds.has(id)))) throw new Error("Invalid fault connections.");
      }
    }
  }
  if (artifact.result !== undefined) {
    const result = artifact.result;
    const numbers = [result.timeMs, result.offeredRps, result.goodputRps, result.errorRate, result.p50, result.p95, result.p99, result.totalRequests, result.totalFailed];
    if (numbers.some(value => !Number.isFinite(value) || value < 0) || !Number.isInteger(result.totalRequests) || !Number.isInteger(result.totalFailed) || result.errorRate > 1 || result.p50 > result.p95 || result.p95 > result.p99 || result.totalFailed > result.totalRequests || !["complete", "incomplete"].includes(result.status)) throw new Error("This run has an invalid result summary.");
  }
  return artifact;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "runId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Local history is unavailable. You can still simulate and export runs."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error("Local history could not be updated. Export the run to keep a copy."));
    });
  } finally { db.close(); }
}

export async function listLocalRuns(scope: SimulationScope): Promise<SavedEventRun[]> {
  const rows = await transaction("readonly", store => store.getAll()) as SavedEventRun[];
  return rows.filter(row => row.snapshot.scope.designId === scope.designId && row.snapshot.scope.canvasId === scope.canvasId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveLocalRun(snapshot: EventRunArtifact): Promise<SavedEventRun> {
  const validated = parseEventRun(snapshot);
  const db = await openDatabase();
  const row: SavedEventRun = { runId: crypto.randomUUID(), createdAt: new Date().toISOString(), expiresAt: 0, snapshot: validated };
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const count = store.count();
      let full = false;
      count.onsuccess = () => {
        if (count.result >= 50) { full = true; tx.abort(); } else store.put(row);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error(full ? "Local history is full (50 runs). Delete a run or export this one." : "Could not save locally. Export the run to keep a copy."));
    });
    return row;
  } finally { db.close(); }
}
export async function deleteLocalRun(id: string) { await transaction("readwrite", store => store.delete(id)); }

const API = (import.meta.env.VITE_API_URL || import.meta.env.VITE_ASSESSMENT_API_URL || "").replace(/\/$/, "");
async function cloudRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  if (!API) throw new Error("Cloud history is not configured. Local history and simulation are available.");
  const response = await fetch(`${API}/api/v2/simulation/runs${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    const message = await response.json().catch(() => null);
    throw new Error(typeof message?.detail === "string" ? message.detail : "Cloud history is unavailable. Your local simulation is unaffected.");
  }
  return response.status === 204 ? undefined : response.json();
}
export async function saveCloudRun(snapshot: EventRunArtifact): Promise<SavedEventRun> {
  return await cloudRequest("", { method: "POST", body: JSON.stringify({ snapshot: parseEventRun(snapshot) }) }) as SavedEventRun;
}
export async function listCloudRuns(scope: SimulationScope): Promise<SavedEventRun[]> {
  return await cloudRequest(`?${new URLSearchParams({ designId: scope.designId, canvasId: scope.canvasId })}`) as SavedEventRun[];
}
export async function deleteCloudRun(id: string) { await cloudRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" }); }

export function downloadRun(snapshot: EventRunArtifact) {
  const blob = new Blob([JSON.stringify(parseEventRun(snapshot, { allowLegacyExport: true }), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `diagramwise-run-${Date.now()}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
