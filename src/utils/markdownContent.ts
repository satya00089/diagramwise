import DOMPurify from "dompurify";
import { marked } from "marked";

/**
 * Repairs code fences that authors (and AI-generated lessons) get slightly
 * wrong. A fence opened with two backticks never matches the three-backtick
 * fence that closes it, so the closing fence starts a block that swallows the
 * rest of the lesson as unformatted monospace text. A line that is only two
 * backticks (optionally followed by a language) is always meant as a fence.
 */
export function normalizeMarkdownFences(markdown: string): string {
  return markdown.replaceAll(/^``(?!`)([\w+-]*)[ \t]*$/gm, "```$1");
}

/** Markdown to sanitized HTML, after repairing malformed code fences. */
export function renderMarkdownToHtml(markdown: string | undefined): string {
  return DOMPurify.sanitize(
    marked.parse(normalizeMarkdownFences(markdown ?? ""), { async: false }),
  );
}
