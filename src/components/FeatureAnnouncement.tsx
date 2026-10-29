import React, { useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MdClose, MdMenuBook } from "react-icons/md";
import { LuBrainCircuit } from "react-icons/lu";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../hooks/useOnboarding";
import type { PageId } from "../contexts/OnboardingContext";

interface Announcement {
  id: string;
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
}

const ANNOUNCEMENT_SESSION_KEY = "diagramwise_announcement_dismissed_session";

// Add new feature announcements here. Dismissals are stored per account.
const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "aiml_problems_v1",
    icon: <LuBrainCircuit className="h-5 w-5" aria-hidden="true" />,
    badge: "New Domain",
    title: "AI & ML System Design Problems",
    description:
      "48 new problems covering LLM infrastructure, MLOps pipelines, recommendation systems, AIOps observability, and more.",
    ctaLabel: "Explore AI & ML",
    ctaHref: "/problems",
  },
  {
    id: "guided_walkthroughs_v1",
    icon: <MdMenuBook className="h-5 w-5" aria-hidden="true" />,
    badge: "Guided Help",
    title: "Guided Walkthroughs for System Design Problems",
    description:
      "Get step-by-step guidance on supported problems while learning the reasoning behind each design decision.",
    ctaLabel: "Find a walkthrough",
    ctaHref: "/problems/",
  },
];

const mapPathToPageId = (path: string): PageId | undefined => {
  if (path === "/") return "home";
  if (path.startsWith("/problems")) return "dashboard";
  if (path.startsWith("/playground") || path.startsWith("/public"))
    return "design_studio";
  if (path.startsWith("/diagrams")) return "my_designs";
  if (path.startsWith("/problems/play")) return "problem_playground";
  return undefined;
};

const readSessionDismissal = (): boolean => {
  try {
    return sessionStorage.getItem(ANNOUNCEMENT_SESSION_KEY) === "true";
  } catch {
    return false;
  }
};

const FeatureAnnouncement: React.FC = () => {
  const {
    isAnnouncementSeen,
    dismissAnnouncement,
    isNewToPage,
    isTourCompleted,
  } = useOnboarding();
  const { user, isLoading: isAuthLoading } = useAuth();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const announcementRef = useRef<HTMLElement>(null);
  const [dismissedThisSession, setDismissedThisSession] =
    useState(readSessionDismissal);

  const currentPage = mapPathToPageId(location.pathname);
  const deferForTour = Boolean(
    currentPage && isNewToPage(currentPage) && !isTourCompleted(currentPage),
  );
  const announcement =
    isAuthLoading || deferForTour || dismissedThisSession
      ? undefined
      : ANNOUNCEMENTS.find((item) => !isAnnouncementSeen(item.id, user?.id));
  const isVisible = Boolean(announcement);

  // Keep fixed page headers below the strip without assuming a fixed height.
  useLayoutEffect(() => {
    if (!isVisible) {
      document.documentElement.style.removeProperty("--announcement-h");
      return;
    }

    const updateHeight = () => {
      const height =
        announcementRef.current?.getBoundingClientRect().height ?? 0;
      document.documentElement.style.setProperty(
        "--announcement-h",
        `${height}px`,
      );
    };

    updateHeight();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(updateHeight);
    if (observer && announcementRef.current) {
      observer.observe(announcementRef.current);
    }
    window.addEventListener("resize", updateHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
      document.documentElement.style.removeProperty("--announcement-h");
    };
  }, [isVisible]);

  if (!announcement) return null;

  const dismissForSession = () => {
    setDismissedThisSession(true);
    try {
      sessionStorage.setItem(ANNOUNCEMENT_SESSION_KEY, "true");
    } catch {
      // The current component state still prevents announcements cascading.
    }
    dismissAnnouncement(announcement.id, user?.id);
  };

  return (
    <AnimatePresence>
      <motion.aside
        key={announcement.id}
        ref={announcementRef}
        initial={shouldReduceMotion ? false : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeOut" }}
        className="announcement-bar fixed inset-x-0 top-0 z-[60]"
        role="region"
        aria-label="Featured update"
      >
        <div className="announcement-bar__inner">
          <span className="announcement-bar__icon" aria-hidden="true">
            {announcement.icon}
          </span>

          <div className="announcement-bar__content">
            <div className="announcement-bar__heading">
              <span className="announcement-bar__badge">
                {announcement.badge}
              </span>
              <span className="announcement-bar__title">
                {announcement.title}
              </span>
            </div>
            <p className="announcement-bar__description">
              {announcement.description}
            </p>
          </div>

          {announcement.ctaHref ? (
            <Link
              to={announcement.ctaHref}
              onClick={dismissForSession}
              className="announcement-bar__cta"
            >
              {announcement.ctaLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={dismissForSession}
              className="announcement-bar__cta"
            >
              {announcement.ctaLabel}
            </button>
          )}

          <button
            type="button"
            onClick={dismissForSession}
            className="announcement-bar__dismiss"
            aria-label={`Dismiss ${announcement.title} update`}
          >
            <MdClose aria-hidden="true" />
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};

export default FeatureAnnouncement;
