import { describe, expect, it } from "vitest";
import {
  DATA_MODEL_PARADIGM_ORDER,
  getDefaultDataModelFields,
  isDataModelNodeData,
  parseDataModelFields,
} from "./dataModel";

describe("data model semantics", () => {
  it("keeps the palette order provider-neutral", () => {
    expect(DATA_MODEL_PARADIGM_ORDER).toEqual([
      "relational",
      "document",
      "key-value",
      "wide-column",
      "graph",
    ]);
  });

  it("provides document fields without relational-only flags", () => {
    const fields = getDefaultDataModelFields("collection");

    expect(fields.map((field) => field.name)).toEqual([
      "_id",
      "name",
      "created_at",
    ]);
    expect(fields.some((field) => "isForeignKey" in field)).toBe(false);
  });

  it("parses persisted fields defensively", () => {
    expect(
      parseDataModelFields('[{"id":"1","name":"email","type":"String"}]'),
    ).toEqual([{ id: "1", name: "email", type: "String" }]);
    expect(parseDataModelFields("invalid-json")).toEqual([]);
  });

  it("recognizes data-model nodes by semantic metadata", () => {
    expect(
      isDataModelNodeData({
        label: "users",
        dataModel: { paradigm: "document", kind: "collection", version: 1 },
      }),
    ).toBe(true);
    expect(isDataModelNodeData({ label: "users" })).toBe(false);
  });
});
