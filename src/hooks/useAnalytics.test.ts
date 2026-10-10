import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactEffects = vi.hoisted(() => ({
  callbacks: [] as Array<() => void | (() => void)>,
}));

vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (callback: () => void | (() => void)) => {
    reactEffects.callbacks.push(callback);
  },
  useRef: (current: unknown) => ({ current }),
}));

import { getAnalyticsBatchUrl, useAnalytics } from "./useAnalytics";

describe("useAnalytics provider lifecycle", () => {
  it("uses the documented API URL before the legacy assessment URL", () => {
    expect(
      getAnalyticsBatchUrl("https://api.example.com/", "https://legacy.example.com"),
    ).toBe("https://api.example.com/api/v1/analytics/batch");
  });

  beforeEach(() => {
    reactEffects.callbacks.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal("crypto", { randomUUID: () => "test-session" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { href: "http://localhost/", pathname: "/" },
    });
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      title: "Landing",
      visibilityState: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not queue a page-exit event for app-wide providers", () => {
    const providers = [
      useAnalytics({ isEnabled: true, trackTimeOnUnmount: false }),
      useAnalytics({ isEnabled: true, trackTimeOnUnmount: false }),
    ];

    const cleanups = reactEffects.callbacks
      .map((effect) => effect())
      .filter((cleanup): cleanup is () => void => typeof cleanup === "function");

    cleanups.forEach((cleanup) => cleanup());
    providers.forEach(({ flush }) => flush());

    expect(fetch).not.toHaveBeenCalled();
  });
});
