import React, { Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatBotProvider } from "./contexts/ChatBotContext";
import { OnboardingProvider } from "./contexts/OnboardingContext";
import { FeedbackProvider } from "./contexts/FeedbackContext";
import { lazyWithRetry } from "./utils/lazyWithRetry";
import AdaptiveTooltipLayer from "./components/shared/AdaptiveTooltipLayer";

const FeatureAnnouncement = lazyWithRetry(
  () => import("./components/FeatureAnnouncement"),
  "feature-announcement",
);
const QuickSetupModal = lazyWithRetry(
  () => import("./components/QuickSetupModal"),
  "quick-setup-modal",
);
const FeedbackLauncher = lazyWithRetry(
  () => import("./components/FeedbackLauncher"),
  "feedback-launcher",
);
const StoreBoundary = lazyWithRetry(
  () => import("./components/StoreBoundary"),
  "store-boundary",
);

const Home = lazyWithRetry(() => import("./pages/Home"), "home");
const Landing3D = lazyWithRetry(
  () => import("./pages/Landing3D"),
  "landing-3d",
);
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "dashboard");
const ProblemLanding = lazyWithRetry(
  () => import("./pages/ProblemLanding"),
  "problem-landing",
);
const SeoGuide = lazyWithRetry(() => import("./pages/SeoGuide"), "seo-guide");
const CreateProblem = lazyWithRetry(
  () => import("./pages/CreateProblem"),
  "create-problem",
);
const MyDesigns = lazyWithRetry(
  () => import("./pages/MyDesigns"),
  "my-designs",
);
const SystemDesignPlayground = lazyWithRetry(
  () => import("./pages/SystemDesignPlayground"),
  "system-design-playground",
);
const SharedCanvasPage = lazyWithRetry(
  () => import("./pages/SharedCanvasPage"),
  "shared-canvas-page",
);
const LearningPaths = lazyWithRetry(
  () => import("./pages/LearningPaths"),
  "learning-paths",
);
const LearningPath = lazyWithRetry(
  () => import("./pages/LearningPath"),
  "learning-path",
);
const VerifyEmail = lazyWithRetry(
  () => import("./pages/VerifyEmail"),
  "verify-email",
);
const AuthEntry = lazyWithRetry(() => import("./pages/AuthEntry"), "auth-entry");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "not-found");

const RouteLoading: React.FC = () => (
  <output className="min-h-screen bg-[var(--bg)] text-theme grid place-items-center px-6">
    <span className="block text-center">
      <span
        className="mx-auto mb-4 block h-9 w-9 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent"
        aria-hidden
      />
      <span className="block text-sm font-semibold text-muted">
        Loading Diagramwise…
      </span>
    </span>
  </output>
);

const GlobalProductChrome: React.FC = () => {
  const { pathname } = useLocation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load non-critical product chrome only after the route has had a quiet
    // startup window. This keeps animation libraries and modal code out of
    // the critical render and interaction path.
    let idleId: number | undefined;
    let hasScheduled = false;
    const scheduleChrome = () => {
      if (hasScheduled) return;
      hasScheduled = true;
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(() => setIsReady(true), {
          timeout: 3000,
        });
      } else {
        setIsReady(true);
      }
    };

    const timer = window.setTimeout(scheduleChrome, 12000);
    const engagementEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
    ];
    engagementEvents.forEach((eventName) =>
      window.addEventListener(eventName, scheduleChrome, {
        once: true,
        passive: true,
      }),
    );

    return () => {
      window.clearTimeout(timer);
      engagementEvents.forEach((eventName) =>
        window.removeEventListener(eventName, scheduleChrome),
      );
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  const isKnownRoute =
    [
      "/",
      "/landing-backup",
      "/problems",
      "/create-problem",
      "/learning-paths",
      "/diagrams",
      "/system-design-interview",
      "/system-design-practice",
      "/ai-system-design-interview",
      "/kubernetes-architecture",
    ].includes(pathname) ||
    ["/learning-paths/", "/playground/", "/problems/"].some((prefix) =>
      pathname.startsWith(prefix),
    );
  const isSystemaLanding = pathname === "/" || pathname === "/landing-3d";

  if (
    !isReady ||
    isSystemaLanding ||
    pathname.startsWith("/public/") ||
    pathname === "/verify-email" ||
    !isKnownRoute
  ) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <FeatureAnnouncement />
      <QuickSetupModal />
      <FeedbackLauncher />
    </Suspense>
  );
};

const AppContent: React.FC = () => {
  return (
    <AuthProvider>
      <ChatBotProvider>
        <OnboardingProvider>
          <FeedbackProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/" element={<Landing3D />} />
                  <Route path="/landing-3d" element={<Landing3D />} />
                  <Route path="/landing-backup" element={<Home />} />
                  <Route
                    path="/problems"
                    element={
                      <StoreBoundary>
                        <Dashboard />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/problems/:slug"
                    element={
                      <StoreBoundary>
                        <ProblemLanding />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/system-design-interview"
                    element={
                      <StoreBoundary>
                        <SeoGuide />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/system-design-practice"
                    element={
                      <StoreBoundary>
                        <SeoGuide />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/ai-system-design-interview"
                    element={
                      <StoreBoundary>
                        <SeoGuide />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/kubernetes-architecture"
                    element={
                      <StoreBoundary>
                        <SeoGuide />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/create-problem"
                    element={
                      <StoreBoundary>
                        <CreateProblem />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/learning-paths"
                    element={
                      <StoreBoundary>
                        <LearningPaths />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/learning-paths/:slug"
                    element={
                      <StoreBoundary>
                        <LearningPath />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/diagrams"
                    element={
                      <StoreBoundary>
                        <MyDesigns />
                      </StoreBoundary>
                    }
                  />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/auth" element={<AuthEntry />} />
                  <Route
                    path="/playground/:id"
                    element={
                      <StoreBoundary>
                        <SystemDesignPlayground />
                      </StoreBoundary>
                    }
                  />
                  <Route
                    path="/public/:id"
                    element={
                      <StoreBoundary>
                        <SharedCanvasPage />
                      </StoreBoundary>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <GlobalProductChrome />
            </BrowserRouter>
          </FeedbackProvider>
        </OnboardingProvider>
      </ChatBotProvider>
    </AuthProvider>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <AppContent />
    <AdaptiveTooltipLayer />
  </ThemeProvider>
);

export default App;
