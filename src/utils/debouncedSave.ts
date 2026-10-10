type SaveTask = () => void | Promise<unknown>;

/** Content edits reset the debounce; metadata updates do not. One write at a time. */
export function createDebouncedSave(delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: SaveTask | undefined;
  let inFlight = false;
  let disposed = false;

  const arm = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, delay);
  };

  const flush = async () => {
    if (disposed || inFlight || !pending) return;
    const task = pending;
    pending = undefined;
    inFlight = true;
    try {
      await task();
    } finally {
      inFlight = false;
      // A debounce may have expired while the previous request was still saving.
      if (!disposed && pending && timer === undefined) arm();
    }
  };

  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };

  return {
    schedule(task: SaveTask) {
      if (disposed) return;
      pending = task;
      arm();
    },
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
