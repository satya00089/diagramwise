import { describe, expect, it } from "vitest";
import { createChunkRetryUrl, isChunkLoadError } from "./lazyWithRetry";

describe("lazyWithRetry helpers", () => {
  it("recognizes browser errors caused by unavailable lazy chunks", () => {
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: /assets/Dashboard.js",
        ),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new Error("Problem catalog returned 503"))).toBe(
      false,
    );
  });

  it("preserves the current route while adding a cache-busting retry token", () => {
    const retryUrl = new URL(
      createChunkRetryUrl("https://diagramwise.com/problems/?q=cache", "123"),
    );

    expect(retryUrl.pathname).toBe("/problems/");
    expect(retryUrl.searchParams.get("q")).toBe("cache");
    expect(retryUrl.searchParams.get("__diagrammatic_chunk_retry")).toBe("123");
  });
});
