import { useEffect, useMemo, useState } from "react";
import { apiService } from "../services/api";
import {
  CanvasWorkspaceController,
  type CanvasWorkspaceSnapshot,
} from "../utils/canvasWorkspaceController";

/**
 * React binding for CanvasWorkspaceController. The controller holds all logic and
 * state transitions; this hook only re-renders when its snapshot changes.
 */
export function useCanvasWorkspace(): {
  controller: CanvasWorkspaceController;
  snapshot: CanvasWorkspaceSnapshot;
} {
  const controller = useMemo(
    () => new CanvasWorkspaceController(apiService),
    [],
  );
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot());

  useEffect(
    () => controller.subscribe(() => setSnapshot(controller.getSnapshot())),
    [controller],
  );

  return { controller, snapshot };
}
