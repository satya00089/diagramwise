import { compileGraph } from "@diagramwise/simulation-core/compiler";
import type { Topology } from "@diagramwise/simulation-core";
import type {
  EventRunArtifact,
  RecordedCommand,
  RunCommand,
  SimulationScope,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";
import { initialSessionState, useSimulationSession } from "./store";
export { useSimulationSession } from "./store";

export type SimulationDocument = Parameters<typeof compileGraph>[0];
let worker: Worker | null = null;
let runId = "";
let lastSequence = 0;
let watchdog: ReturnType<typeof setTimeout> | undefined;

function send(message: WorkerRequest) {
  worker?.postMessage(message);
}
function armWatchdog() {
  clearTimeout(watchdog);
  watchdog = setTimeout(
    () => fail("The simulation stopped responding. Reset to retry."),
    10000,
  );
}
function terminate() {
  worker?.terminate();
  worker = null;
  runId = "";
  clearTimeout(watchdog);
}
function fail(message: string) {
  terminate();
  useSimulationSession.setState({ status: "error", error: message });
}
function statusAfterSnapshot(
  incoming: Extract<WorkerResponse, { type: "snapshot" }>["status"],
  current: ReturnType<typeof useSimulationSession.getState>["status"],
) {
  if (incoming === "resource-limited") return incoming;
  if (current === "stale" || current === "paused") return current;
  return incoming;
}
// True while a saved run is being replayed. Replays must not be saved again.
let replaying = false;

function begin(topology: Topology, replay?: RecordedCommand[]) {
  terminate();
  replaying = Boolean(replay);
  const state = useSimulationSession.getState();
  runId = crypto.randomUUID();
  lastSequence = 0;
  useSimulationSession.setState({
    status: "running",
    visible: true,
    snapshot: null,
    commands: [],
    error: null,
  });
  try {
    worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onerror = () =>
      fail("The simulation worker could not start. Reset to try again.");
    worker.onmessageerror = () =>
      fail("The simulation returned unreadable data. Reset to try again.");
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.runId !== runId) return;
      clearTimeout(watchdog);
      if (message.type === "error") {
        fail(message.message);
        return;
      }
      if (message.sequence <= lastSequence) return;
      lastSequence = message.sequence;
      const current = useSimulationSession.getState();
      useSimulationSession.setState({
        snapshot: message.snapshot,
        commands: message.commands,
        achievedSpeed: message.achievedSpeed,
        status: statusAfterSnapshot(message.status, current.status),
      });
      if (message.status === "running") armWatchdog();
    };
    armWatchdog();
    send({
      type: "start",
      runId,
      topology,
      seed: state.seed,
      speed: state.speed,
      replay,
    });
  } catch (error) {
    fail(
      error instanceof Error
        ? error.message
        : "This browser could not start a simulation worker.",
    );
  }
}

export const simulationSession = {
  bindDocument(scope: SimulationScope, document: SimulationDocument) {
    const before = useSimulationSession.getState();
    const scopeChanged = JSON.stringify(before.scope) !== JSON.stringify(scope);
    if (scopeChanged) {
      terminate();
      useSimulationSession.setState({ ...initialSessionState, scope });
    }
    const state = useSimulationSession.getState();
    const compilation = compileGraph(document, {
      requestRate: state.rps,
      traffic: state.pattern,
    });
    const changed = Boolean(
      state.compilation &&
        state.compilation.fingerprint !== compilation.fingerprint,
    );
    if (changed && state.snapshot) send({ type: "pause", runId });
    const updatedState: Partial<typeof state> = {
      document,
      compilation,
      scope,
    };
    if (changed && state.snapshot) updatedState.status = "stale";
    useSimulationSession.setState(updatedState);
  },
  start() {
    const state = useSimulationSession.getState();
    if (state.status === "paused" && worker) {
      useSimulationSession.setState({ status: "running" });
      armWatchdog();
      send({ type: "resume", runId });
      return;
    }
    if (!state.document) return;
    const compilation = compileGraph(state.document, {
      requestRate: state.rps,
      traffic: state.pattern,
    });
    useSimulationSession.setState({ compilation, visible: true, error: null });
    if (!compilation.topology) {
      terminate();
      useSimulationSession.setState({ status: "invalid", snapshot: null });
      return;
    }
    useSimulationSession.setState({
      initialTopology: structuredClone(compilation.topology),
      runFingerprint: compilation.fingerprint,
      initialWorkload: {
        rps: state.rps,
        pattern: state.pattern,
        seed: state.seed,
      },
    });
    begin(compilation.topology);
  },
  pause() {
    useSimulationSession.setState({ status: "paused" });
    send({ type: "pause", runId });
  },
  reset() {
    terminate();
    useSimulationSession.setState({
      status: "idle",
      snapshot: null,
      commands: [],
      initialTopology: null,
      initialWorkload: null,
      error: null,
    });
  },
  dispose() {
    terminate();
    useSimulationSession.setState({ ...initialSessionState });
  },
  reveal() {
    useSimulationSession.setState({ visible: true });
  },
  selectNode(selectedNodeId: string | null) {
    useSimulationSession.setState({ selectedNodeId });
  },
  setSpeed(speed: number) {
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 5) return;
    useSimulationSession.setState({ speed });
    send({ type: "speed", runId, speed });
  },
  setWorkload(rps: number, pattern = useSimulationSession.getState().pattern) {
    if (!Number.isFinite(rps) || rps < 0 || rps > 100000) return;
    useSimulationSession.setState({ rps, pattern });
    const compilation = useSimulationSession.getState().compilation;
    const selectedClientId =
      compilation?.trafficSource.mode === "clients"
        ? compilation.trafficSource.selectedNodeId
        : undefined;
    const command: Extract<RunCommand, { type: "workload" }> = {
      type: "workload",
      rps,
      pattern,
    };
    if (selectedClientId) {
      command.clientIds = [selectedClientId];
    }
    this.command(command);
  },
  command(command: RunCommand) {
    const state = useSimulationSession.getState();
    if (worker && (state.status === "running" || state.status === "paused"))
      send({ type: "command", runId, command });
  },
  isReplay(): boolean {
    return replaying;
  },
  /** Identifies the current run across pauses and resumes. */
  currentRunId(): string {
    return runId;
  },
  artifact(): EventRunArtifact | null {
    const s = useSimulationSession.getState();
    if (!s.scope || !s.initialTopology || !s.initialWorkload || !s.snapshot)
      return null;
    const system = s.snapshot.system;
    return {
      contractVersion: "2",
      engineVersion: "event-v2",
      profileVersion: "profiles-v1",
      scope: s.scope,
      graphFingerprint: s.runFingerprint,
      topology: s.initialTopology,
      workload: s.initialWorkload,
      commands: s.commands,
      result: {
        timeMs: system.timeMs,
        offeredRps: system.offeredRps,
        goodputRps: system.goodputRps,
        errorRate: system.errorRate,
        p50: system.p50,
        p95: system.p95,
        p99: system.p99,
        totalRequests: system.totalRequests,
        totalFailed: system.totalFailed,
        status: ["resource-limited", "error", "stale"].includes(s.status)
          ? "incomplete"
          : "complete",
      },
    };
  },
  replay(artifact: EventRunArtifact) {
    useSimulationSession.setState({
      initialTopology: artifact.topology,
      initialWorkload: artifact.workload,
      runFingerprint: artifact.graphFingerprint,
      rps: artifact.workload.rps,
      pattern: artifact.workload.pattern,
      seed: artifact.workload.seed,
    });
    begin(artifact.topology, artifact.commands);
  },
};
