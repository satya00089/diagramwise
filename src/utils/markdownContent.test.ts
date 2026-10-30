import { describe, expect, it } from "vitest";
import { normalizeMarkdownFences } from "./markdownContent";

describe("normalizeMarkdownFences", () => {
  it("turns a two-backtick opening fence into a three-backtick fence", () => {
    const input = "Intro:\n``\ndocs/{id}/snapshot.json\n```\nAfter";
    expect(normalizeMarkdownFences(input)).toBe(
      "Intro:\n```\ndocs/{id}/snapshot.json\n```\nAfter",
    );
  });

  it("keeps the language on a repaired fence", () => {
    expect(normalizeMarkdownFences("``json\n{}\n```")).toBe("```json\n{}\n```");
  });

  it("leaves correct fences and inline code alone", () => {
    const input = "Use `x` and ``y`` here.\n```ts\nconst a = 1;\n```";
    expect(normalizeMarkdownFences(input)).toBe(input);
  });
});
