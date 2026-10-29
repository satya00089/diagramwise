import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRunArtifact } from "./protocol";

// Node has no window events; a plain EventTarget stands in for the browser.
const bus = new EventTarget();
vi.stubGlobal("addEventListener", bus.addEventListener.bind(bus));
vi.stubGlobal("removeEventListener", bus.removeEventListener.bind(bus));
vi.stubGlobal("dispatchEvent", bus.dispatchEvent.bind(bus));

const saveLocalRun = vi.fn();
const artifact = vi.fn();
const isReplay = vi.fn();

vi.mock("./history", () => ({ saveLocalRun }));
vi.mock("./session", () => ({
  simulationSession: { artifact, isReplay },
}));

const { useSimulationSession } = await import("./store");
const { RUN_SAVED_EVENT, RUN_SAVE_FAILED_EVENT } = await import("./autosave");

let counter = 0;
function run(timeMs: number, fingerprint = "design-a"): EventRunArtifact {
  return {
    graphFingerprint: fingerprint,
    workload: { rps: 100, pattern: "steady", seed: 1 },
    result: { timeMs },
  } as EventRunArtifact;
}

function move(from: string, to: string) {
  useSimulationSession.setState({ status: from as never });
  useSimulationSession.setState({ status: to as never });
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  counter += 1; // a fresh fingerprint per test keeps the dedup state separate
  saveLocalRun.mockReset().mockResolvedValue({});
  artifact.mockReset();
  isReplay.mockReset().mockReturnValue(false);
  useSimulationSession.setState({ status: "idle" });
});

describe("run auto-save", () => {
  it("keeps a run when it is paused", () => {
    artifact.mockReturnValue(run(10_000, `a${counter}`));
    move("running", "paused");
    expect(saveLocalRun).toHaveBeenCalledTimes(1);
  });

  it("ignores runs too short to say anything", () => {
    artifact.mockReturnValue(run(1_000, `b${counter}`));
    move("running", "paused");
    expect(saveLocalRun).not.toHaveBeenCalled();
  });

  it("does not save the same measurement twice", () => {
    artifact.mockReturnValue(run(10_000, `c${counter}`));
    move("running", "paused");
    move("paused", "running");
    move("running", "paused");
    expect(saveLocalRun).toHaveBeenCalledTimes(1);
  });

  it("saves again once the run has progressed", () => {
    artifact.mockReturnValue(run(10_000, `d${counter}`));
    move("running", "paused");
    artifact.mockReturnValue(run(20_000, `d${counter}`));
    move("running", "paused");
    expect(saveLocalRun).toHaveBeenCalledTimes(2);
  });

  it("keeps the 'before' when the design changes mid-run", () => {
    artifact.mockReturnValue(run(10_000, `e${counter}`));
    move("running", "stale");
    expect(saveLocalRun).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate a paused run when the design then changes", () => {
    artifact.mockReturnValue(run(10_000, `f${counter}`));
    move("running", "paused");
    move("paused", "stale");
    expect(saveLocalRun).toHaveBeenCalledTimes(1);
  });

  it("saves nothing for starting, resetting or an idle design change", () => {
    artifact.mockReturnValue(run(10_000, `g${counter}`));
    move("idle", "running"); // starting
    useSimulationSession.setState({ status: "idle" }); // resetting
    move("idle", "stale"); // design edited with no run in progress
    expect(saveLocalRun).not.toHaveBeenCalled();
  });

  it("does not re-save a replay", () => {
    isReplay.mockReturnValue(true);
    artifact.mockReturnValue(run(10_000, `h${counter}`));
    move("running", "paused");
    expect(saveLocalRun).not.toHaveBeenCalled();
  });

  it("saves nothing when there is no run to capture", () => {
    artifact.mockReturnValue(null);
    move("running", "paused");
    expect(saveLocalRun).not.toHaveBeenCalled();
  });

  it("announces a saved run", async () => {
    const saved = vi.fn();
    globalThis.addEventListener(RUN_SAVED_EVENT, saved);
    artifact.mockReturnValue(run(10_000, `i${counter}`));
    move("running", "paused");
    await settle();
    expect(saved).toHaveBeenCalledTimes(1);
    globalThis.removeEventListener(RUN_SAVED_EVENT, saved);
  });

  it("reports a failed save, such as full history", async () => {
    const failed = vi.fn();
    globalThis.addEventListener(RUN_SAVE_FAILED_EVENT, failed);
    saveLocalRun.mockRejectedValue(new Error("Local history is full"));
    artifact.mockReturnValue(run(10_000, `j${counter}`));
    move("running", "paused");
    await settle();
    expect(failed).toHaveBeenCalledTimes(1);
    expect((failed.mock.calls[0][0] as CustomEvent<string>).detail).toBe(
      "Local history is full",
    );
    globalThis.removeEventListener(RUN_SAVE_FAILED_EVENT, failed);
  });
});
