/** Save the versioned canvas before writing the attempt's accompanying data. */
export async function persistProblemAttempt<T>(
  saveCanvas: () => Promise<void>,
  saveAttempt: () => Promise<T>,
): Promise<T> {
  await saveCanvas();
  return saveAttempt();
}

/** A diagram-only save cannot resolve a failed assessment save. */
export function getProblemSaveStatus(
  diagramStatus: "idle" | "saving" | "saved" | "error",
  assessmentSaveFailed: boolean,
) {
  if (assessmentSaveFailed && diagramStatus === "error") return "both-error";
  return assessmentSaveFailed ? "assessment-error" : diagramStatus;
}
