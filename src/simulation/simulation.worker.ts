import { createSimulation } from "@diagramwise/simulation-core";
import type {
  RecordedCommand,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";

let runtime: ReturnType<typeof createSimulation> | null = null;
let runId = "";
let running = false;
let speed = 1;
let sequence = 0;
let commands: RecordedCommand[] = [];
let replay: RecordedCommand[] = [];
let replayIndex = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastWall = 0;
let lastPublish = 0;
let measuredWall = 0;
let measuredTime = 0;
let achievedSpeed = 1;
let resourceLimited = false;

function publish() {
  if (!runtime) return;
  const response: WorkerResponse = {
    type: "snapshot",
    runId,
    sequence: ++sequence,
    snapshot: runtime.snapshot(),
    commands,
    achievedSpeed,
    status: resourceLimited
      ? "resource-limited"
      : running
        ? "running"
        : "paused",
  };
  self.postMessage(response);
  lastPublish = performance.now();
}

function fail(error: unknown) {
  running = false;
  clearTimeout(timer);
  self.postMessage({
    type: "error",
    runId,
    message:
      error instanceof Error ? error.message : "Simulation worker failed.",
  } satisfies WorkerResponse);
}

function tick() {
  if (!runtime || !running) return;
  try {
    const wall = performance.now();
    // A background tab must not accumulate minutes of catch-up work.
    const delta = Math.min(100, Math.max(0, wall - lastWall)) * speed;
    lastWall = wall;
    let now = runtime.snapshot().system.timeMs;
    const requested = now + delta;
    const sliceStart = performance.now();
    do {
      const nextCommand = replay[replayIndex];
      const target = Math.min(requested, nextCommand?.atMs ?? Infinity);
      const progress = runtime.advanceTo(target, 4000);
      now = progress.timeMs;
      if (progress.status === "resource-limited") {
        resourceLimited = true;
        running = false;
        break;
      }
      if (nextCommand && now >= nextCommand.atMs) {
        runtime.applyCommand(nextCommand.command, nextCommand.atMs);
        commands.push(nextCommand);
        replayIndex++;
      }
      if (now >= requested) break;
    } while (performance.now() - sliceStart < 8);
    if (wall - measuredWall >= 1000) {
      achievedSpeed = (now - measuredTime) / Math.max(1, wall - measuredWall);
      measuredWall = wall;
      measuredTime = now;
    }
    if (wall - lastPublish >= 100 || !running) publish();
    if (running) timer = setTimeout(tick, 8);
  } catch (error) {
    fail(error);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "start") {
      clearTimeout(timer);
      runId = message.runId;
      runtime = createSimulation(message.topology, message.seed);
      sequence = 0;
      commands = [];
      replay = message.replay ?? [];
      replayIndex = 0;
      resourceLimited = false;
      speed = message.speed;
      running = true;
      lastWall = measuredWall = performance.now();
      measuredTime = 0;
      achievedSpeed = speed;
      publish();
      timer = setTimeout(tick, 0);
      return;
    }
    if (message.runId !== runId || !runtime) return;
    if (message.type === "pause") {
      running = false;
      clearTimeout(timer);
      publish();
    }
    if (message.type === "resume" && !resourceLimited) {
      running = true;
      lastWall = measuredWall = performance.now();
      measuredTime = runtime.snapshot().system.timeMs;
      clearTimeout(timer);
      timer = setTimeout(tick, 0);
    }
    if (message.type === "speed") speed = message.speed;
    if (message.type === "command") {
      if (commands.length >= 1000)
        throw new Error(
          "This run has reached its 1,000-change limit. Reset to continue experimenting.",
        );
      const atMs = runtime.snapshot().system.timeMs;
      runtime.applyCommand(message.command, atMs);
      commands.push({ atMs, command: message.command });
      publish();
    }
  } catch (error) {
    fail(error);
  }
};
