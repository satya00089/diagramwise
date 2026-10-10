import React, {
  createContext,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { apiService } from "../services/api";
import useAnalytics from "../hooks/useAnalytics";
import { APP_VERSION } from "../config/version";
import type {
  FeedbackLaunchOptions,
  FeedbackSubmission,
} from "../types/feedback";
import { lazyWithRetry } from "../utils/lazyWithRetry";

const FeedbackDialog = lazyWithRetry(
  () => import("../components/FeedbackDialog"),
  "feedback-dialog",
);

interface FeedbackContextValue {
  isOpen: boolean;
  launchOptions: FeedbackLaunchOptions;
  openFeedback: (options?: FeedbackLaunchOptions) => void;
  closeFeedback: () => void;
  submitFeedback: (submission: FeedbackSubmission) => Promise<void>;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(
  undefined,
);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [launchOptions, setLaunchOptions] = useState<FeedbackLaunchOptions>({});
  const { trackEvent } = useAnalytics({
    isEnabled: true,
    trackTimeOnUnmount: false,
  });

  const openFeedback = useCallback(
    (options: FeedbackLaunchOptions = {}) => {
      setLaunchOptions(options);
      setIsOpen(true);
      trackEvent("feedback_opened", {
        source: options.source ?? "global",
        contextual: Boolean(options.context),
      });
    },
    [trackEvent],
  );

  const closeFeedback = useCallback(() => setIsOpen(false), []);

  const submitFeedback = useCallback(
    async (submission: FeedbackSubmission) => {
      try {
        await apiService.submitFeedback({
          ...submission,
          route: window.location.pathname,
          appVersion: APP_VERSION,
        });
        trackEvent("feedback_submitted", {
          source: submission.source,
          category: submission.category,
          has_message: Boolean(submission.message.trim()),
          helpful: submission.helpful,
        });
      } catch (error) {
        trackEvent("feedback_failed", {
          source: submission.source,
          category: submission.category,
        });
        throw error;
      }
    },
    [trackEvent],
  );

  const value = useMemo(
    () => ({
      isOpen,
      launchOptions,
      openFeedback,
      closeFeedback,
      submitFeedback,
    }),
    [closeFeedback, isOpen, launchOptions, openFeedback, submitFeedback],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {isOpen && (
        <Suspense fallback={null}>
          <FeedbackDialog
            initialOptions={launchOptions}
            onClose={closeFeedback}
            onSubmit={submitFeedback}
          />
        </Suspense>
      )}
    </FeedbackContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useFeedback = (): FeedbackContextValue => {
  const context = React.useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return context;
};
