import { useEffect, useState } from "react";
import { apiService } from "../services/api";

export function useLearningProgress(pathId: string) {
  const [completed, setCompleted] = useState<string[]>([]);

  // Load progress from API for the authenticated user.
  useEffect(() => {
    let mounted = true;
    if (!pathId) {
      setCompleted([]);
      return;
    }

    void (async () => {
      try {
        const serverProgress = await apiService.getLearningProgress(pathId);
        if (mounted)
          setCompleted(Array.isArray(serverProgress) ? serverProgress : []);
      } catch {
        // If API fails (unauthenticated/offline), leave progress empty.
        if (mounted) setCompleted([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [pathId]);

  async function persist(next: string[]) {
    try {
      await apiService.saveLearningProgress(pathId, next);
    } catch {
      // Fail silently; server-side persistence preferred. No localStorage fallback.
    }
  }

  function toggle(lessonId: string) {
    setCompleted((prev) => {
      const next = prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId];
      void persist(next);
      return next;
    });
  }

  function isCompleted(lessonId: string) {
    return completed.includes(lessonId);
  }

  return { completed, toggle, isCompleted };
}
