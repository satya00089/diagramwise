import { afterEach, describe, expect, it, vi } from "vitest";
import { createDebouncedSave } from "./debouncedSave";

afterEach(() => vi.useRealTimers());

describe("content-driven autosave", () => {
  it("saves despite one-second clock updates and reads the latest metadata", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    let elapsed = 0;
    const scheduler = createDebouncedSave(3000);
    const clock = setInterval(() => elapsed++, 1000);
    await vi.advanceTimersByTimeAsync(100);
    scheduler.schedule(() => save({ elapsed, content: "guide step" }));
    await vi.advanceTimersByTimeAsync(3000);
    expect(save).toHaveBeenCalledExactlyOnceWith({
      elapsed: 3,
      content: "guide step",
    });
    clearInterval(clock);
    scheduler.dispose();
  });

  it("debounces content edits rather than saving every guide action", async () => {
    vi.useFakeTimers();
    const scheduler = createDebouncedSave(3000);
    const first = vi.fn();
    const last = vi.fn();
    scheduler.schedule(first);
    await vi.advanceTimersByTimeAsync(2000);
    scheduler.schedule(last);
    await vi.advanceTimersByTimeAsync(2999);
    expect(first).not.toHaveBeenCalled();
    expect(last).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(last).toHaveBeenCalledOnce();
    scheduler.dispose();
  });

  it("serializes requests and saves edits made while a request is in flight", async () => {
    vi.useFakeTimers();
    const scheduler = createDebouncedSave(3000);
    let finish!: () => void;
    const first = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const latest = vi.fn();
    scheduler.schedule(first);
    await vi.advanceTimersByTimeAsync(3000);
    scheduler.schedule(latest);
    await vi.advanceTimersByTimeAsync(3000);
    expect(latest).not.toHaveBeenCalled();
    finish();
    await vi.advanceTimersByTimeAsync(3000);
    expect(latest).toHaveBeenCalledOnce();
    scheduler.dispose();
  });

  it("cancels pending work when disabled or unmounted", async () => {
    vi.useFakeTimers();
    const scheduler = createDebouncedSave(3000);
    const save = vi.fn();
    scheduler.schedule(save);
    scheduler.cancel();
    await vi.advanceTimersByTimeAsync(4000);
    scheduler.schedule(save);
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(4000);
    expect(save).not.toHaveBeenCalled();
  });
});
