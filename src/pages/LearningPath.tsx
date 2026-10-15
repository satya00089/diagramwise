import React, { useEffect, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AuthModal } from "../components/AuthModal";
import ThemeSwitcher from "../components/ThemeSwitcher";
import ProductHeader from "../components/ProductHeader";
import { useTheme } from "../hooks/useTheme";
import SEO from "../components/SEO";
import { fetchLearningPathBySlug } from "../services/contentLoader";
import type { LearningPath as LPType, Lesson } from "../services/contentLoader";
import LessonRenderer from "../components/learning-paths/LessonRenderer.tsx";
import ModuleList from "../components/learning-paths/ModuleList.tsx";
import ProgressTracker from "../components/learning-paths/ProgressTracker.tsx";
import { useLearningProgress } from "../hooks/useLearningProgress";
import { MdHelpOutline } from "react-icons/md";
import { IoChevronBackOutline } from "react-icons/io5";

const LearningPath: React.FC = () => {
  useTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated: isAuth,
    login,
    signup,
    googleLogin,
    logout,
  } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [path, setPath] = useState<LPType | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const { completed, toggle, isCompleted } = useLearningProgress(slug ?? "");

  const location = useLocation();

  useEffect(() => {
    if (!slug) return;
    fetchLearningPathBySlug(slug)
      .then((p) => {
        setPath(p);
        if (p) {
          const params = new URLSearchParams(location.search);
          const moduleParam = params.get("module");
          let initialLesson: Lesson | null = null;

          if (moduleParam) {
            const targetModule = p.modules?.find(
              (m) =>
                m.id === moduleParam ||
                m.id === decodeURIComponent(moduleParam),
            );
            if (targetModule?.lessons?.[0]) {
              initialLesson = targetModule.lessons[0];
            }
          }

          if (!initialLesson && p.modules?.[0]?.lessons?.[0]) {
            initialLesson = p.modules[0].lessons[0];
          }

          if (initialLesson) {
            setSelectedLesson(initialLesson);
            setActiveLessonId(initialLesson.id);
          }
        }
      })
      .catch((err) => console.error(err));
  }, [slug, location.search]);

  return (
    <>
      <SEO
        title={
          path
            ? `${path.title} | Learning Path | Diagramwise`
            : "Learning Path | Diagramwise"
        }
        description={
          path?.summary ??
          "Deep dive lessons and modules for system design learning."
        }
        keywords="system design learning path, system design module, system architecture lessons"
        image="https://diagramwise.com/og/learning-path.png"
        imageAlt={
          path?.title
            ? `${path.title} learning path preview`
            : "Diagramwise learning path preview"
        }
        url={
          slug
            ? `https://diagramwise.com/learning-paths/${slug}/`
            : "https://diagramwise.com/learning-paths/"
        }
      />

      <div className="learning-path-detail-page min-h-screen bg-[var(--bg)] text-theme relative grid-pattern-overlay">
        <ProductHeader
          actions={
            <>
              {isAuth && (
                <button
                  type="button"
                  onClick={() => navigate("/diagrams")}
                  className="detail-header-action hidden md:block"
                >
                  My Designs
                </button>
              )}
              {path && (
                <span className="detail-header-context hidden lg:block">
                  {path.title}
                </span>
              )}
              <button
                type="button"
                data-tooltip="Back to all paths"
                onClick={() => navigate("/learning-paths/")}
                className="detail-header-action"
              >
                <MdHelpOutline className="h-4 w-4" />
                <span className="hidden sm:inline">All Paths</span>
              </button>
              <ThemeSwitcher />
              <div className="relative">
                {isAuth ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="detail-account-button"
                    >
                      {user?.picture ? (
                        <img
                          src={user.picture}
                          alt={user.name || "User"}
                          className="detail-avatar detail-avatar-image"
                        />
                      ) : (
                        <div className="detail-avatar">
                          {user?.name?.[0]?.toUpperCase() ||
                            user?.email?.[0]?.toUpperCase() ||
                            "U"}
                        </div>
                      )}
                      <span className="hidden sm:inline max-w-[150px] truncate">
                        {user?.name || user?.email}
                      </span>
                      <span aria-hidden="true">⌄</span>
                    </button>
                    {showUserMenu && (
                      <div className="detail-user-menu">
                        <div className="px-4 py-2">
                          <p className="text-sm font-medium text-theme">
                            {user?.name || "User"}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {user?.email}
                          </p>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setShowUserMenu(false)}
                          className="detail-user-menu-item border-b border-theme/10"
                        >
                          Your profile
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            globalThis.dispatchEvent(
                              new Event("open-quick-setup"),
                            );
                            setShowUserMenu(false);
                          }}
                          className="detail-user-menu-item border-b border-theme/10"
                        >
                          Edit preferences
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            logout();
                            setShowUserMenu(false);
                          }}
                          className="detail-user-menu-item text-red-600"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="product-sign-in detail-sign-in"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </>
          }
        />

        <div
          className="relative z-10 h-screen overflow-hidden"
          style={{ paddingTop: "1.5rem" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full pt-6 pb-2">
            {!path ? (
              <div className="text-center py-20">
                <div className="inline-block w-12 h-12 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="text-theme">Loading learning path...</div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="learning-path-detail-intro shrink-0 mb-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <button
                      type="button"
                      onClick={() => navigate("/learning-paths/")}
                      className="detail-back-button px-3 py-2 text-sm rounded-md border text-theme transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <IoChevronBackOutline /> Back to Learning Paths
                    </button>

                    <h1 className="text-3xl md:text-4xl font-normal text-theme m-0">
                      {path.title}
                    </h1>
                  </div>
                </div>

                <div className="md:flex gap-6 flex-1 min-h-0">
                  <div className="md:w-1/3 h-full overflow-auto pr-1 component-palette">
                    <div className="rounded border border-theme/10 elevated-card-bg p-5 shadow-sm">
                      <p className="text-muted mb-6">{path.summary}</p>
                      <ModuleList
                        modules={path.modules}
                        onSelectLesson={(l) => {
                          setSelectedLesson(l);
                          setActiveLessonId(l.id);
                        }}
                        activeLessonId={activeLessonId}
                        completedLessons={completed}
                        onToggleCompleted={(id) => toggle(id)}
                      />
                      <div className="mt-4">
                        <ProgressTracker
                          pathId={path.id}
                          totalLessons={path.modules.reduce(
                            (acc, m) => acc + (m.lessons?.length || 0),
                            0,
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:flex-1 flex flex-col min-h-0 h-full rounded border border-theme/10 elevated-card-bg p-5 shadow-sm">
                    {selectedLesson ? (
                      <>
                        {(() => {
                          // Find next lesson in sequence across modules
                          let foundCurrent = false;
                          let nextLessonFound = null;

                          for (const mod of path.modules) {
                            for (const les of mod.lessons || []) {
                              if (foundCurrent) {
                                nextLessonFound = les;
                                break;
                              }
                              if (les.id === selectedLesson.id) {
                                foundCurrent = true;
                              }
                            }
                            if (nextLessonFound) break;
                          }

                          // Find current module index and whether selected lesson is the last in its module
                          let currentModuleIndex = -1;
                          let isLastInModule = false;
                          for (let i = 0; i < path.modules.length; i++) {
                            const mod = path.modules[i];
                            const idx = (mod.lessons || []).findIndex(
                              (l) => l.id === selectedLesson.id,
                            );
                            if (idx !== -1) {
                              currentModuleIndex = i;
                              isLastInModule =
                                idx === (mod.lessons?.length || 0) - 1;
                              break;
                            }
                          }

                          const handleNext = () => {
                            // Mark current as complete
                            if (!isCompleted(selectedLesson.id)) {
                              toggle(selectedLesson.id);
                            }
                            // Move to next
                            if (nextLessonFound) {
                              setSelectedLesson(nextLessonFound);
                              setActiveLessonId(nextLessonFound.id);
                              // update module query param if module changed
                              const parentModule = path.modules.find((m) =>
                                (m.lessons || []).some(
                                  (l) => l.id === nextLessonFound.id,
                                ),
                              );
                              if (parentModule) {
                                const params = new URLSearchParams(
                                  location.search,
                                );
                                params.set("module", parentModule.id);
                                navigate(
                                  `${location.pathname}?${params.toString()}`,
                                  { replace: true },
                                );
                              }
                            }
                          };

                          const handleFinish = () => {
                            if (currentModuleIndex === -1) return;
                            const curMod = path.modules[currentModuleIndex];
                            for (const les of curMod.lessons || []) {
                              if (!isCompleted(les.id)) {
                                toggle(les.id);
                              }
                            }
                            const nextMod =
                              path.modules[currentModuleIndex + 1];
                            if (nextMod?.lessons?.[0]) {
                              const first = nextMod.lessons[0];
                              setSelectedLesson(first);
                              setActiveLessonId(first.id);
                              const params = new URLSearchParams(
                                location.search,
                              );
                              params.set("module", nextMod.id);
                              navigate(
                                `${location.pathname}?${params.toString()}`,
                                { replace: true },
                              );
                            } else {
                              // No more modules — return to paths overview
                              navigate("/learning-paths/");
                            }
                          };

                          return (
                            <LessonRenderer
                              lesson={selectedLesson}
                              completed={isCompleted(selectedLesson.id)}
                              onToggleCompleted={() =>
                                toggle(selectedLesson.id)
                              }
                              hasNextLesson={!!nextLessonFound}
                              onNext={handleNext}
                              hasFinishModule={isLastInModule}
                              onFinish={handleFinish}
                            />
                          );
                        })()}
                      </>
                    ) : (
                      <div className="text-muted">Select a lesson</div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
            setShowAuthModal(false);
          }}
          onSignup={async (email, password, name) => {
            await signup({ email, password, name });
          }}
          onGoogleLogin={async (credential) => {
            await googleLogin(credential);
            setShowAuthModal(false);
          }}
        />
      )}
    </>
  );
};

export default LearningPath;
