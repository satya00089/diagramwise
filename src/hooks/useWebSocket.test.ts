import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookRuntime = vi.hoisted(() => ({
  cursor: 0,
  slots: [] as Array<{ value: unknown; deps?: unknown[] }>,
}));

vi.mock("react", () => ({
  useCallback: (callback: (...args: never[]) => unknown, deps: unknown[]) => {
    const index = hookRuntime.cursor++;
    const slot = hookRuntime.slots[index];
    if (
      !slot ||
      !slot.deps ||
      deps.length !== slot.deps.length ||
      deps.some(
        (dependency, dependencyIndex) => dependency !== slot.deps?.[dependencyIndex],
      )
    ) {
      hookRuntime.slots[index] = { value: callback, deps };
    }
    return hookRuntime.slots[index].value;
  },
  useEffect: () => undefined,
  useRef: (initial: unknown) => {
    const index = hookRuntime.cursor++;
    hookRuntime.slots[index] ??= { value: { current: initial } };
    return hookRuntime.slots[index].value;
  },
  useState: (initial: unknown) => {
    const index = hookRuntime.cursor++;
    hookRuntime.slots[index] ??= { value: initial };
    const slot = hookRuntime.slots[index];
    return [
      slot.value,
      (value: unknown) => {
        slot.value =
          typeof value === "function"
            ? (value as (current: unknown) => unknown)(slot.value)
            : value;
      },
    ];
  },
}));

import { useWebSocket } from "./useWebSocket";

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
  }

  send() {}
}

describe("useWebSocket callback lifecycle", () => {
  beforeEach(() => {
    hookRuntime.cursor = 0;
    hookRuntime.slots = [];
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the connection function stable when event callbacks change", () => {
    const Render = (onMessage: (message: { type: string }) => void) => {
      hookRuntime.cursor = 0;
      return useWebSocket({
        url: "ws://localhost:8000/collaborate",
        onMessage,
        onClose: () => undefined,
      }).connect;
    };

    const initialHandler = vi.fn();
    const latestHandler = vi.fn();
    const firstConnect = Render(initialHandler);
    firstConnect();
    const nextConnect = Render(latestHandler);

    expect(nextConnect).toBe(firstConnect);
    expect(MockWebSocket.instances).toHaveLength(1);

    MockWebSocket.instances[0].onmessage?.({ data: '{"type":"update"}' });

    expect(initialHandler).not.toHaveBeenCalled();
    expect(latestHandler).toHaveBeenCalledWith({ type: "update" });
  });
});
