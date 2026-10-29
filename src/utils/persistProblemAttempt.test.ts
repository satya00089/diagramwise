import { describe, expect, it } from "vitest";
import { getProblemSaveStatus } from "./persistProblemAttempt";

describe("problem save status", () => {
  it("keeps an assessment failure visible after a diagram save succeeds", () => {
    expect(getProblemSaveStatus("error", true)).toBe("both-error");
    expect(getProblemSaveStatus("saved", true)).toBe("assessment-error");
    expect(getProblemSaveStatus("saved", false)).toBe("saved");
  });
});
