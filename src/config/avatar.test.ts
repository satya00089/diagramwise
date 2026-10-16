import { describe, expect, it } from "vitest";
import {
  getBlobatarAvatarChoice,
  getAvatarSeed,
  isAvatarKey,
} from "./avatar";

describe("Blobatar avatar choices", () => {
  it("preserves the existing keys and generates new scroll options", () => {
    expect(getBlobatarAvatarChoice(0).key).toBe("blobatar-v2-01");
    expect(getBlobatarAvatarChoice(8).key).toBe("blobatar-v2-09");
    expect(getBlobatarAvatarChoice(119).key).toBe("blobatar-v2-120");
  });

  it("uses valid persisted keys in deterministic avatar seeds", () => {
    expect(isAvatarKey("blobatar-v2-120")).toBe(true);
    expect(isAvatarKey("blobatar-v2-99999")).toBe(true);
    expect(isAvatarKey("blobatar-v2-100000")).toBe(true);
    expect(isAvatarKey("blobatar-v2-999999999")).toBe(true);
    expect(isAvatarKey("blobatar-v2-1000000000")).toBe(false);
    expect(getAvatarSeed("user-1", "blobatar-v2-120")).toBe(
      "diagramwise:blobatar:v2:user-1:blobatar-v2-120",
    );
  });
});
