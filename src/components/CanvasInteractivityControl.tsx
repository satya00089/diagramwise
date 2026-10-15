import React from "react";
import { ControlButton, useStore, useStoreApi } from "@xyflow/react";
import { MdLock, MdLockOpen } from "react-icons/md";

const CanvasInteractivityControl: React.FC = () => {
  const isInteractive = useStore(
    (state) =>
      state.nodesDraggable ||
      state.nodesConnectable ||
      state.elementsSelectable,
  );
  const store = useStoreApi();

  const toggleInteractivity = () => {
    const nextInteractive = !isInteractive;
    store.setState({
      nodesDraggable: nextInteractive,
      nodesConnectable: nextInteractive,
      elementsSelectable: nextInteractive,
    });
  };

  return (
    <ControlButton
      className="react-flow__controls-interactive"
      aria-label="Toggle interactivity"
      aria-pressed={isInteractive}
      title="Toggle Interactivity"
      onClick={toggleInteractivity}
    >
      {isInteractive ? (
        <MdLockOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <MdLock className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
    </ControlButton>
  );
};

export default CanvasInteractivityControl;
