import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AuthModal } from "../components/AuthModal";
import { MdHelpOutline } from "react-icons/md";
import SEO from "../components/SEO";
import ThemeSwitcher from "../components/ThemeSwitcher";
import ProductHeader from "../components/ProductHeader";
import { useTheme } from "../hooks/useTheme";
import { useOnboarding } from "../hooks/useOnboarding";
import { useTour } from "../hooks/useTour";
import useAnalytics from "../hooks/useAnalytics";
import {
  fetchLearningPaths,
  getEmbeddedLearningPaths,
} from "../services/contentLoader";
import type { LearningPath } from "../services/contentLoader";
import LearningPathCard from "../components/learning-paths/LearningPathCard";

const getHeaderPathStatus = (
  loading: boolean,
  pathCount: number,
  loadError: boolean,
) => {
  if (loading) return "Loading...";
  if (pathCount > 0) return `${pathCount} paths available`;
  if (loadError) return "Learning paths unavailable";
  return "No paths available";
};

const getPathCountLabel = (pathCount: number) => {
  if (pathCount === 1) return "1 path";
  return `${pathCount} paths`;
};

const getPathAvailabilityMessage = (
  loading: boolean,
  pathCount: number,
  loadError: boolean,
) => {
  if (loading) return "Loading paths...";
  if (pathCount > 0) return getPathCountLabel(pathCount);
  if (loadError) return "Learning paths are temporarily unavailable";
  return "No learning paths are available yet";
};

type LearningPathsHeaderActionsProps = {
  isAuth: boolean;
  loading: boolean;
  pathCount: number;
  loadError: boolean;
  onNavigate: (path: string) => void;
  onStartTour: () => void;
  onSignIn: () => void;
};

const LearningPathsHeaderActions: React.FC<LearningPathsHeaderActionsProps> = ({
  isAuth,
  loading,
  pathCount,
  loadError,
  onNavigate,
  onStartTour,
  onSignIn,
}) => (
  <div className="learning-paths-header-actions flex items-center gap-4">
    {isAuth && (
      <button
        type="button"
        onClick={() => onNavigate("/diagrams")}
        className="hidden md:block px-4 py-2 text-sm font-medium text-theme hover:text-theme/70 transition-colors cursor-pointer"
      >
        My Designs
      </button>
    )}

    <div className="hidden md:block text-sm text-muted">
      {getHeaderPathStatus(loading, pathCount, loadError)}
    </div>

    <button
      type="button"
      onClick={onStartTour}
      data-tooltip="Take a tour"
      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted hover:text-theme hover:bg-[var(--bg-hover)] rounded-md transition-colors cursor-pointer"
    >
      <MdHelpOutline className="h-4 w-4" />
      <span className="hidden sm:inline">Tour</span>
    </button>

    <ThemeSwitcher />

    {!isAuth && (
      <button type="button" onClick={onSignIn} className="product-sign-in">
        Sign In
      </button>
    )}
  </div>
);

const LearningPathGridContent: React.FC<{
  loading: boolean;
  paths: LearningPath[];
  loadError: boolean;
}> = ({ loading, paths, loadError }) => {
  if (loading) {
    return (
      <div className="col-span-3 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand)]" />
      </div>
    );
  }

  if (paths.length === 0 && loadError) {
    return (
      <p className="col-span-3 py-12 text-center text-muted">
        Learning paths are temporarily unavailable. Please try again shortly.
      </p>
    );
  }

  return (
    <>
      {paths.map((path) => (
        <LearningPathCard key={path.id} path={path} />
      ))}
    </>
  );
};

const LearningPaths: React.FC = () => {
  useTheme();
  const navigate = useNavigate();
  const {
    isAuthenticated: isAuth,
    login,
    signup,
    googleLogin,
  } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isNewToPage, markPageVisited } = useOnboarding();
  const { startTour } = useTour("learning_paths");
  const { trackPageView } = useAnalytics({ isEnabled: true });

  const initialPathsRef = useRef<LearningPath[] | null>(null);
  if (initialPathsRef.current === null) {
    initialPathsRef.current = getEmbeddedLearningPaths();
  }
  const initialPaths = initialPathsRef.current ?? [];
  const [paths, setPaths] = useState<LearningPath[]>(initialPaths);
  const [loading, setLoading] = useState(initialPaths.length === 0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // mark visited + optional tour
    const isNew = isNewToPage("learning_paths");
    markPageVisited("learning_paths");
    if (isNew) {
      const t = setTimeout(() => startTour(), 800);
      return () => clearTimeout(t);
    }
    // track page view
    try {
      trackPageView();
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchLearningPaths()
      .then((data) => {
        if (!mounted) return;
        // Do not let an empty refresh erase a valid build-time catalog.
        if (data.length > 0 || initialPathsRef.current?.length === 0) {
          setPaths(data);
          setLoadError(false);
        } else {
          setLoadError(true);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        // Keep the embedded catalog visible when the refresh is unavailable.
        console.error("Failed to refresh learning paths", err);
        setLoadError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <SEO
        title="Learning Paths | Diagramwise"
        description="Structured learning paths to master system design concepts, modules, and exercises."
        keywords="system design learning path, system design tutorial, learning path"
        image="https://diagramwise.com/og/learning-paths.png"
        imageAlt="Diagramwise learning paths preview"
        url="https://diagramwise.com/learning-paths/"
      />

      <div className="learning-paths-page min-h-screen bg-[var(--bg)] text-theme relative grid-pattern-overlay">
        <ProductHeader
          actions={
            <LearningPathsHeaderActions
              isAuth={isAuth}
              loading={loading}
              pathCount={paths.length}
              loadError={loadError}
              onNavigate={navigate}
              onStartTour={startTour}
              onSignIn={() => setShowAuthModal(true)}
            />
          }
        />
        <div className="relative z-10" style={{ paddingTop: "1.5rem" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Page Header */}
            <div className="learning-paths-intro text-center mb-8">
              <p className="learning-paths-eyebrow">
                Build your systems thinking
              </p>
              <h1 className="text-4xl md:text-6xl font-normal mb-4 tracking-[-0.04em]">
                Learning Paths
              </h1>
              <p className="text-muted text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                Follow curated sequences of modules and lessons that teach
                system design from first principles to advanced patterns.
              </p>
            </div>

            <div className="learning-paths-count mb-5 flex items-center justify-between">
              <div className="text-sm text-muted">
                {getPathAvailabilityMessage(loading, paths.length, loadError)}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <LearningPathGridContent
                loading={loading}
                paths={paths}
                loadError={loadError}
              />
            </div>
          </div>
        </div>
      </div>
      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onLogin={async (email, password) => {
            await login({ email, password });
          }}
          onSignup={async (email, password, name) => {
            await signup({ email, password, name });
          }}
          onGoogleLogin={async (credential) => {
            await googleLogin(credential);
          }}
        />
      )}
    </>
  );
};

export default LearningPaths;
