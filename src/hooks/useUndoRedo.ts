import { useState, useCallback, useRef } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseUndoRedoReturn<T> {
  state: T;
  setState: (newState: T | ((prevState: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  /** Replace the current state and drop all history, e.g. when switching canvases. */
  resetState: (newState: T) => void;
}

export function useUndoRedo<T>(
  initialState: T,
  maxHistorySize = 50,
): UseUndoRedoReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Track if the current change is from undo/redo to avoid adding to history
  const isUndoRedoAction = useRef(false);

  const setState = useCallback(
    (newState: T | ((prevState: T) => T)) => {
      setHistory((currentHistory) => {
        const nextState =
          typeof newState === "function"
            ? (newState as (prevState: T) => T)(currentHistory.present)
            : newState;

        // Don't add to history if this is an undo/redo action
        if (isUndoRedoAction.current) {
          isUndoRedoAction.current = false;
          return {
            ...currentHistory,
            present: nextState,
          };
        }

        // Don't add to history if state hasn't changed
        if (
          JSON.stringify(nextState) === JSON.stringify(currentHistory.present)
        ) {
          return currentHistory;
        }

        const newPast = [...currentHistory.past, currentHistory.present];

        // Limit history size
        if (newPast.length > maxHistorySize) {
          newPast.shift();
        }

        return {
          past: newPast,
          present: nextState,
          future: [], // Clear future when new action is taken
        };
      });
    },
    [maxHistorySize],
  );

  const undo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.past.length === 0) {
        return currentHistory;
      }

      const previous = currentHistory.past[currentHistory.past.length - 1];
      const newPast = currentHistory.past.slice(0, -1);

      isUndoRedoAction.current = true;

      return {
        past: newPast,
        present: previous,
        future: [currentHistory.present, ...currentHistory.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.future.length === 0) {
        return currentHistory;
      }

      const next = currentHistory.future[0];
      const newFuture = currentHistory.future.slice(1);

      isUndoRedoAction.current = true;

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory({
      past: [],
      present: history.present,
      future: [],
    });
  }, [history.present]);

  const resetState = useCallback((newState: T) => {
    isUndoRedoAction.current = false;
    setHistory({ past: [], present: newState, future: [] });
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clearHistory,
    resetState,
  };
}
