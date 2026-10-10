import { useEffect, useRef } from "react";
import { createDebouncedSave } from "../utils/debouncedSave";

/** The callback stays current without timer ticks restarting the content debounce. */
export function useDebouncedSave(
  enabled: boolean,
  contentKey: string,
  save: () => Promise<void>,
  delay = 3000,
) {
  const latestSave = useRef(save);
  const scheduler = useRef<ReturnType<typeof createDebouncedSave> | null>(null);
  useEffect(() => {
    latestSave.current = save;
  });
  useEffect(() => {
    const current = createDebouncedSave(delay);
    scheduler.current = current;
    return () => {
      current.dispose();
      scheduler.current = null;
    };
  }, [delay]);
  useEffect(() => {
    if (enabled) scheduler.current?.schedule(() => latestSave.current());
    else scheduler.current?.cancel();
  }, [enabled, contentKey, delay]);
}
