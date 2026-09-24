import { describe, expect, it } from "vitest";
import { shouldUseDirectIcon } from "./iconRendering";

describe("shouldUseDirectIcon", () => {
  it("uses source SVGs for every supported provider", () => {
    expect(shouldUseDirectIcon("aws-detective-security-identity-compliance")).toBe(
      true,
    );
    expect(shouldUseDirectIcon("azure-virtual-machine-compute")).toBe(true);
    expect(shouldUseDirectIcon("gcp-cloud-storage-storage")).toBe(true);
    expect(shouldUseDirectIcon("kubernetes-api-server-control-plane")).toBe(
      true,
    );
  });

  it("is case-insensitive and preserves generic fallbacks", () => {
    expect(shouldUseDirectIcon("AWS-simple-storage-service-storage")).toBe(
      true,
    );
    expect(shouldUseDirectIcon("aws.cache.redis")).toBe(true);
    expect(shouldUseDirectIcon("custom-service")).toBe(false);
    expect(shouldUseDirectIcon()).toBe(false);
  });
});
