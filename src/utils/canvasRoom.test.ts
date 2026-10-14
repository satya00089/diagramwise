import { describe, expect, it } from "vitest";
import { canvasRoomId } from "./canvasRoom";

describe("canvasRoomId", () => {
  it("keeps the design room for the design's own canvas", () => {
    expect(canvasRoomId("design-1", "design-1")).toBe("design-1");
  });

  it("gives every other canvas its own room", () => {
    expect(canvasRoomId("design-1", "flow-9")).toBe("design-1~flow-9");
    expect(canvasRoomId("design-1", "flow-9")).not.toBe(canvasRoomId("design-1", "er-3"));
  });
});
