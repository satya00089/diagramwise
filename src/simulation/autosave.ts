import { saveLocalRun } from "./history";
import { simulationSession } from "./session";
import { useSimulationSession } from "./store";

export const RUN_SAVED_EVENT = "simulation:run-saved";
export const RUN_SAVE_FAILED_EVENT = "simulation:run-save-failed";

// Shorter runs say too little to be worth keeping.
const MIN_RUN_MS = 3000;

let started = false;
let lastSaved: string | null = null;

function save() {
  if (simulationSession.isReplay()) return;
  const run = simulationSession.artifact();
  if (!run?.result || run.result.timeMs < MIN_RUN_MS) return;
  const key = `${run.graphFingerprint}|${run.workload.seed}|${Math.round(run.result.timeMs)}`;
  if (key === lastSaved) return;
  lastSaved = key;
  saveLocalRun(run)
    .then(() => globalThis.dispatchEvent(new Event(RUN_SAVED_EVENT)))
    .catch((error: unknown) =>
      globalThis.dispatchEvent(
        new CustomEvent(RUN_SAVE_FAILED_EVENT, {
          detail:
            error instanceof Error ? error.message : "Could not save this run.",
        }),
      ),
    );
}

/**
 * Keep every finished measurement without asking the user. A run is kept when
 * it is paused, and when the design changes under it, so the "before" of a
 * before/after comparison is never lost. Lives in the session layer so it
 * works even when the Simulate panel is not open.
 */
export function startRunAutosave() {
  if (started) return;
  started = true;
  useSimulationSession.subscribe((state, previous) => {
    const wasMeasuring =
      previous.status === "running" || previous.status === "paused";
    const paused = previous.status === "running" && state.status === "paused";
    const designChanged = wasMeasuring && state.status === "stale";
    if (paused || designChanged) save();
  });
}

startRunAutosave();
