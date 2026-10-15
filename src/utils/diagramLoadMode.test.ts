import { describe, expect, it } from "vitest";
import { getDiagramLoadMode } from "./diagramLoadMode";

describe("getDiagramLoadMode", () => {
  it("waits for auth restoration before choosing a private or public endpoint", () => {
    expect(
      getDiagramLoadMode({ isLoading: true, isAuthenticated: false }),
    ).toBeNull();
  });

  it("loads the private diagram after an authenticated session is restored", () => {
    expect(
      getDiagramLoadMode({ isLoading: false, isAuthenticated: true }),
    ).toBe("private");
  });

  it("uses the public endpoint only after auth resolves to anonymous", () => {
    expect(
      getDiagramLoadMode({ isLoading: false, isAuthenticated: false }),
    ).toBe("public");
  });
});
