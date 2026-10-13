import { describe, expect, it } from "vitest";
import { moveItemWithinGroup } from "./reorder";

const allInOneGroup = () => "all";

describe("moveItemWithinGroup", () => {
  it("moves a field before or after another field", () => {
    const fields = [{ id: "id" }, { id: "email" }, { id: "age" }];

    expect(
      moveItemWithinGroup(fields, "age", "email", "before", allInOneGroup),
    ).toEqual([{ id: "id" }, { id: "age" }, { id: "email" }]);
    expect(
      moveItemWithinGroup(fields, "id", "email", "after", allInOneGroup),
    ).toEqual([{ id: "email" }, { id: "id" }, { id: "age" }]);
  });

  it("reorders only siblings while retaining positions from other groups", () => {
    const fields = [
      { id: "root-a", parentId: null },
      { id: "child-a", parentId: "profile" },
      { id: "root-b", parentId: null },
      { id: "child-b", parentId: "profile" },
    ];
    const getParent = (field: (typeof fields)[number]) => field.parentId;

    expect(
      moveItemWithinGroup(fields, "child-b", "child-a", "before", getParent),
    ).toEqual([
      { id: "root-a", parentId: null },
      { id: "child-b", parentId: "profile" },
      { id: "root-b", parentId: null },
      { id: "child-a", parentId: "profile" },
    ]);
  });

  it("does not reorder across parent groups or for invalid IDs", () => {
    const fields = [
      { id: "root", parentId: null },
      { id: "child", parentId: "profile" },
    ];

    expect(
      moveItemWithinGroup(
        fields,
        "root",
        "child",
        "before",
        (field) => field.parentId ?? "root",
      ),
    ).toBe(fields);
    expect(
      moveItemWithinGroup(
        fields,
        "missing",
        "child",
        "before",
        (field) => field.parentId ?? "root",
      ),
    ).toBe(fields);
  });
});
