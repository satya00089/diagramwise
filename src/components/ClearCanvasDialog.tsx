import React from "react";
import { useModalDialog } from "../hooks/useModalDialog";
import AnimatedCheckbox from "./shared/AnimatedCheckbox";

type ClearCanvasDialogProps = {
  clearSaved: boolean;
  onClearSavedChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Confirms wiping the canvas. A native modal dialog gives focus containment,
 * Esc to cancel and a blocked background; Cancel takes initial focus so a stray
 * Enter never runs the destructive action.
 */
const ClearCanvasDialog: React.FC<ClearCanvasDialogProps> = ({
  clearSaved,
  onClearSavedChange,
  onCancel,
  onConfirm,
}) => {
  const dialogRef = useModalDialog();

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="clear-canvas-title"
      aria-describedby="clear-canvas-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-0 h-full max-h-none w-full max-w-none border-0 text-theme fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-surface rounded-2xl shadow-2xl p-6 max-w-md w-full border border-theme/10">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3
              id="clear-canvas-title"
              className="text-lg font-bold text-theme"
            >
              Clear Canvas?
            </h3>
            <p className="text-sm text-muted">
              Your current diagram will be removed.
            </p>
          </div>
        </div>
        <p id="clear-canvas-description" className="text-muted mb-4">
          Every component and connection on the canvas will be deleted. You
          can't undo this.
        </p>

        <div className="mb-4">
          <AnimatedCheckbox
            id="clear-saved"
            variant="danger"
            checked={clearSaved}
            onChange={onClearSavedChange}
            labelClassName="text-muted"
            label="Also delete my saved progress (local and server)"
          />
        </div>

        <div className="flex space-x-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-theme/5 hover:bg-theme/10 text-theme font-medium rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-600/30 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Clear canvas
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default ClearCanvasDialog;
