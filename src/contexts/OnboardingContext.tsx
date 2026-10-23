import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { APP_VERSION } from "../config/version";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageId =
  | "home"
  | "dashboard"
  | "design_studio"
  | "problem_playground"
  | "my_designs"
  | "learning_paths";

interface PageVisit {
  count: number;
  firstVisit: string | null;
  lastSeenVersion: string;
}

interface OnboardingState {
  appVersion: string;
  visits: Record<PageId, PageVisit>;
  completedTours: string[];
  completedQuickSetupUsers: string[];
  dismissedTips: string[];
  completedTasks: string[];
  /** Legacy, browser-wide announcement dismissals retained for anonymous visitors. */
  seenAnnouncements: string[];
  /** Dismissals for signed-in accounts, so one account does not affect another. */
  seenAnnouncementsByUser: Record<string, string[]>;
}

interface OnboardingContextType {
  /** True if user has never visited this page, or if APP_VERSION has changed since last visit */
  isNewToPage: (pageId: PageId) => boolean;
  /** Call on mount of each page — increments visit count and records version */
  markPageVisited: (pageId: PageId) => void;
  isTourCompleted: (tourId: string) => boolean;
  markTourComplete: (tourId: string) => void;
  isQuickSetupCompleted: (userId: string) => boolean;
  markQuickSetupComplete: (userId: string) => void;
  isTipDismissed: (tipId: string) => boolean;
  dismissTip: (tipId: string) => void;
  isTaskCompleted: (taskId: string) => boolean;
  completeTask: (taskId: string) => void;
  isAnnouncementSeen: (id: string, userId?: string) => boolean;
  dismissAnnouncement: (id: string, userId?: string) => void;
  /** Wipe all onboarding state back to defaults (useful for testing / dev) */
  resetAll: () => void;
  visits: Record<PageId, PageVisit>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "diagrammatic_onboarding";

const DEFAULT_PAGE_VISIT: PageVisit = {
  count: 0,
  firstVisit: null,
  lastSeenVersion: "",
};

const INITIAL_STATE: OnboardingState = {
  appVersion: APP_VERSION,
  visits: {
    home: { ...DEFAULT_PAGE_VISIT },
    dashboard: { ...DEFAULT_PAGE_VISIT },
    design_studio: { ...DEFAULT_PAGE_VISIT },
    problem_playground: { ...DEFAULT_PAGE_VISIT },
    learning_paths: { ...DEFAULT_PAGE_VISIT },
    my_designs: { ...DEFAULT_PAGE_VISIT },
  },
  completedTours: [],
  completedQuickSetupUsers: [],
  dismissedTips: [],
  completedTasks: [],
  seenAnnouncements: [],
  seenAnnouncementsByUser: {},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    // Deep-merge so new pageIds added in future releases don't break
    return {
      ...INITIAL_STATE,
      ...parsed,
      visits: {
        ...INITIAL_STATE.visits,
        ...parsed.visits,
      },
      seenAnnouncementsByUser: parsed.seenAnnouncementsByUser ?? {},
    };
  } catch {
    return INITIAL_STATE;
  }
}

function saveState(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or unavailable; silently skip
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined,
);

export { OnboardingContext };

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<OnboardingState>(loadState);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // ---- Query helpers -------------------------------------------------------

  const isNewToPage = useCallback(
    (pageId: PageId): boolean => {
      const visit = state.visits[pageId];
      if (!visit || visit.count === 0) return true;
      if (visit.lastSeenVersion !== APP_VERSION) return true;
      return false;
    },
    [state.visits],
  );

  const isTourCompleted = useCallback(
    (tourId: string) => state.completedTours.includes(tourId),
    [state.completedTours],
  );

  const isQuickSetupCompleted = useCallback(
    (userId: string) => state.completedQuickSetupUsers.includes(userId),
    [state.completedQuickSetupUsers],
  );

  const isTipDismissed = useCallback(
    (tipId: string) => state.dismissedTips.includes(tipId),
    [state.dismissedTips],
  );

  const isTaskCompleted = useCallback(
    (taskId: string) => state.completedTasks.includes(taskId),
    [state.completedTasks],
  );

  const isAnnouncementSeen = useCallback(
    (id: string, userId?: string) => {
      const seenAnnouncements = userId
        ? (state.seenAnnouncementsByUser[userId] ?? [])
        : state.seenAnnouncements;
      return seenAnnouncements.includes(id);
    },
    [state.seenAnnouncements, state.seenAnnouncementsByUser],
  );

  // ---- Mutating helpers ----------------------------------------------------

  const markPageVisited = useCallback((pageId: PageId) => {
    setState((prev) => {
      const existing = prev.visits[pageId] ?? { ...DEFAULT_PAGE_VISIT };
      return {
        ...prev,
        appVersion: APP_VERSION,
        visits: {
          ...prev.visits,
          [pageId]: {
            count: existing.count + 1,
            firstVisit: existing.firstVisit ?? new Date().toISOString(),
            lastSeenVersion: APP_VERSION,
          },
        },
      };
    });
  }, []);

  const markTourComplete = useCallback((tourId: string) => {
    setState((prev) => ({
      ...prev,
      completedTours: prev.completedTours.includes(tourId)
        ? prev.completedTours
        : [...prev.completedTours, tourId],
    }));
  }, []);

  const markQuickSetupComplete = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      completedQuickSetupUsers: prev.completedQuickSetupUsers.includes(userId)
        ? prev.completedQuickSetupUsers
        : [...prev.completedQuickSetupUsers, userId],
    }));
  }, []);

  const dismissTip = useCallback((tipId: string) => {
    setState((prev) => ({
      ...prev,
      dismissedTips: prev.dismissedTips.includes(tipId)
        ? prev.dismissedTips
        : [...prev.dismissedTips, tipId],
    }));
  }, []);

  const completeTask = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      completedTasks: prev.completedTasks.includes(taskId)
        ? prev.completedTasks
        : [...prev.completedTasks, taskId],
    }));
  }, []);

  const dismissAnnouncement = useCallback((id: string, userId?: string) => {
    setState((prev) => {
      if (userId) {
        const seenAnnouncements = prev.seenAnnouncementsByUser[userId] ?? [];
        if (seenAnnouncements.includes(id)) return prev;
        return {
          ...prev,
          seenAnnouncementsByUser: {
            ...prev.seenAnnouncementsByUser,
            [userId]: [...seenAnnouncements, id],
          },
        };
      }

      return {
        ...prev,
        seenAnnouncements: prev.seenAnnouncements.includes(id)
          ? prev.seenAnnouncements
          : [...prev.seenAnnouncements, id],
      };
    });
  }, []);

  const resetAll = useCallback(() => {
    setState(INITIAL_STATE);
    saveState(INITIAL_STATE);
  }, []);

  const value = useMemo<OnboardingContextType>(
    () => ({
      isNewToPage,
      markPageVisited,
      isTourCompleted,
      markTourComplete,
      isQuickSetupCompleted,
      markQuickSetupComplete,
      isTipDismissed,
      dismissTip,
      isTaskCompleted,
      completeTask,
      isAnnouncementSeen,
      dismissAnnouncement,
      resetAll,
      visits: state.visits,
    }),
    [
      isNewToPage,
      markPageVisited,
      isTourCompleted,
      markTourComplete,
      isQuickSetupCompleted,
      markQuickSetupComplete,
      isTipDismissed,
      dismissTip,
      isTaskCompleted,
      completeTask,
      isAnnouncementSeen,
      dismissAnnouncement,
      resetAll,
      state.visits,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
