import { useState, useCallback } from "react";
import type { ToastMessage, ToastType } from "../components/Toast";

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const createToastId = useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `toast-${Date.now()}-${crypto.randomUUID()}`;
    }

    return `toast-${Date.now()}-${Math.random()}`;
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration?: number) => {
      const id = createToastId();
      const newToast: ToastMessage = {
        id,
        message,
        type,
        duration,
      };

      setToasts((prev) => [...prev, newToast]);
    },
    [createToastId],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => {
      showToast(message, "success", duration);
    },
    [showToast],
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      showToast(message, "error", duration);
    },
    [showToast],
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      showToast(message, "warning", duration);
    },
    [showToast],
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      showToast(message, "info", duration);
    },
    [showToast],
  );

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
};
