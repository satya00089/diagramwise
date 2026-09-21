import { describe, expect, it } from "vitest";
import {
  getPurposeValue,
  normalizeComponentProperties,
  normalizeEdgeDataPurpose,
  normalizeNodeDataPurpose,
  PURPOSE_PLACEHOLDER,
} from "./purposeMigration";

describe("purpose migration helpers", () => {
  it("normalizes only generic component definitions", () => {
    const normalized = normalizeComponentProperties([
      { key: "description", label: "Description", type: "textarea" },
      { key: "description", label: "Body", type: "textarea" },
    ]);

    expect(normalized[0]).toMatchObject({
      key: "purpose",
      label: "Purpose",
      placeholder: PURPOSE_PLACEHOLDER,
    });
    expect(normalized[1]).toMatchObject({ key: "description", label: "Body" });
  });

  it("falls back to legacy description and resolves node conflicts", () => {
    expect(getPurposeValue({ description: "old" })).toBe("old");
    expect(getPurposeValue({ purpose: "new", description: "old" })).toBe("new");

    expect(
      normalizeNodeDataPurpose(
        { description: "old" },
        [{ key: "purpose", label: "Purpose" }],
      ),
    ).toEqual({ purpose: "old" });
    expect(
      normalizeNodeDataPurpose(
        { purpose: "new", description: "old" },
        [{ key: "purpose", label: "Purpose" }],
      ),
    ).toEqual({ purpose: "new" });
  });

  it("does not rename specialized content fields", () => {
    expect(
      normalizeNodeDataPurpose(
        { description: "body" },
        [{ key: "description", label: "Body" }],
      ),
    ).toEqual({ description: "body" });
  });

  it("normalizes edge data idempotently", () => {
    const first = normalizeEdgeDataPurpose({ description: "carries data" });
    expect(first).toEqual({ purpose: "carries data" });
    expect(normalizeEdgeDataPurpose(first)).toEqual(first);
    expect(normalizeEdgeDataPurpose({ purpose: "new", description: "old" })).toEqual({
      purpose: "new",
    });
  });
});
