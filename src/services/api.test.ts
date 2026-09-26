import { describe, expect, it } from "vitest";
import { getApiBaseUrl, getGoogleLoginRedirectUri } from "./api";

describe("getApiBaseUrl", () => {
  it("uses the documented API URL for authentication requests", () => {
    expect(
      getApiBaseUrl("https://api.example.com", "https://legacy.example.com"),
    ).toBe("https://api.example.com");
  });

  it("supports deployments that still use the legacy API URL", () => {
    expect(getApiBaseUrl(undefined, "https://legacy.example.com")).toBe(
      "https://legacy.example.com",
    );
  });
});

describe("getGoogleLoginRedirectUri", () => {
  it("builds the backend redirect endpoint without a duplicate slash", () => {
    expect(getGoogleLoginRedirectUri("https://api.example.com/")).toBe(
      "https://api.example.com/api/v1/auth/google/redirect",
    );
  });
});
