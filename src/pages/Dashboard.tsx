import React, { useState, useEffect, useMemo } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  MdPublic,
  MdBusiness,
  MdPhoneAndroid,
  MdSettings,
  MdSearch,
  MdTune,
  MdLabel,
  MdAccessTime,
  MdWarningAmber,
  MdSearchOff,
  MdSmartToy,
  MdHelpOutline,
} from "react-icons/md";
import ThemeSwitcher from "../components/ThemeSwitcher";
import ProductHeader from "../components/ProductHeader";
import SelectDropdown from "../components/shared/SelectDropdown";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../hooks/useOnboarding";
import { useTour } from "../hooks/useTour";
import useAnalytics from "../hooks/useAnalytics";
import { AuthModal } from "../components/AuthModal";
import SEO from "../components/SEO";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchProblems,
  fetchMoreProblems,
  fetchAttemptedProblems,
  setSelectedDifficulty,
  setSelectedCategory,
  setSelectedDomain,
  setSearchQuery,
} from "../store/slices/problemsSlice";
import {
  selectFilteredProblems,
  selectProblemsLoading,
  selectProblemsLoadingMore,
  selectProblemsHasMore,
  selectProblemsTotalCount,
  selectProblemsError,
  selectCategories,
  selectDomains,
  selectDifficulties,
  selectSelectedDifficulty,
  selectSelectedCategory,
  selectSelectedDomain,
  selectSearchQuery,
  selectAttemptedProblems,
} from "../store/slices/problemsSelectors";
import { getProblemSlug } from "../utils/problemSlug";

const Dashboard: React.FC = () => {
  useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { isNewToPage, markPageVisited } = useOnboarding();
  const { startTour } = useTour("dashboard");
  const { trackPageView } = useAnalytics({ isEnabled: true });

  // Mark visited + auto-start tour for new users
  useEffect(() => {
    const isNew = isNewToPage("dashboard");
    markPageVisited("dashboard");
    if (isNew || searchParams.get("tour") === "1") {
      // Slight delay so DOM elements with data-tour attrs are rendered
      const t = setTimeout(() => startTour(), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      trackPageView();
    } catch {
      // ignore
    }
  }, [trackPageView]);

  // Local UI state
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Redux state
  const filteredProblems = useAppSelector(selectFilteredProblems);
  const loading = useAppSelector(selectProblemsLoading);
  const loadingMore = useAppSelector(selectProblemsLoadingMore);
  const hasMore = useAppSelector(selectProblemsHasMore);
  const totalProblemCount = useAppSelector(selectProblemsTotalCount);
  const error = useAppSelector(selectProblemsError);
  const categories = useAppSelector(selectCategories);
  const domains = useAppSelector(selectDomains);
  const difficulties = selectDifficulties();
  const selectedDifficulty = useAppSelector(selectSelectedDifficulty);
  const selectedCategory = useAppSelector(selectSelectedCategory);
  const selectedDomain = useAppSelector(selectSelectedDomain);
  const searchQuery = useAppSelector(selectSearchQuery);
  const attemptedProblems = useAppSelector(selectAttemptedProblems);
  const hasProblems = filteredProblems.length > 0;
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      selectedDifficulty !== "All" ||
      selectedCategory !== "All" ||
      selectedDomain !== "All",
  );
  const loadingLabel = hasProblems ? "Updating..." : "Loading...";
  const availableProblemCount =
    !hasActiveFilters && totalProblemCount !== null
      ? totalProblemCount
      : filteredProblems.length;

  const {
    user,
    isAuthenticated: isAuth,
    login,
    signup,
    googleLogin,
    logout,
  } = useAuth();

  const prioritizedProblems = useMemo(() => {
    // If no preferences or no problems, return as-is
    const prefs = user?.preferences as Record<string, unknown> | undefined;
    if (!prefs || !filteredProblems || filteredProblems.length === 0) {
      return filteredProblems.map((p) => ({ problem: p, score: 0 }));
    }

    const normalize = (v: unknown): string[] => {
      if (v == null) return [];
      if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase());
      if (typeof v === "string") {
        const s = v.trim();
        if (!s) return [];
        return s.includes(",")
          ? s
              .split(",")
              .map((x) => x.trim().toLowerCase())
              .filter(Boolean)
          : [s.toLowerCase()];
      }
      if (typeof v === "object") {
        const obj = v as Record<string, unknown>;
        for (const key of ["value", "label", "id", "name"]) {
          const val = obj[key];
          if (typeof val === "string" && val.trim())
            return [val.trim().toLowerCase()];
        }
        try {
          return [JSON.stringify(obj).toLowerCase()];
        } catch {
          return [];
        }
      }
      return [String(v).toLowerCase()];
    };

    const primaryInterests = normalize(
      prefs.primary_interest ??
        prefs["primaryInterest"] ??
        prefs["primary_interest"],
    );
    const preferredClouds = normalize(
      prefs.preferred_cloud ?? prefs["preferredCloud"],
    );
    const experience = normalize(
      prefs.experience_level ?? prefs["experienceLevel"] ?? "",
    )
      .join(",")
      .toLowerCase();

    const scored = filteredProblems.map((problem, idx) => {
      let score = 0;
      const tags = new Set((problem.tags || []).map((t: string) => String(t).toLowerCase()));
      const category = String(problem.category || "").toLowerCase();
      const domain = String(problem.domain || "").toLowerCase();

      for (const pi of primaryInterests) {
        if (!pi) continue;
        if (tags.has(pi)) score += 3;
        if (category === pi) score += 2;
        if (domain === pi) score += 1;
      }

      for (const pc of preferredClouds) {
        if (!pc) continue;
        if (tags.has(pc) || category === pc || domain === pc) score += 1;
      }

      if (experience) {
        const diff = String(problem.difficulty || "").toLowerCase();
        if (experience === "beginner" && diff === "easy") score += 1;
        if (
          experience === "intermediate" &&
          (diff === "medium" || diff === "easy")
        )
          score += 1;
        if (
          experience === "advanced" &&
          (diff === "hard" || diff === "very hard")
        )
          score += 1;
      }

      return {
        problem,
        score,
        originalIndex: idx,
        attempted: attemptedProblems.has(problem.id),
      };
    });

    scored.sort((a, b) => {
      const aAttempt = a.attempted ? 1 : 0;
      const bAttempt = b.attempted ? 1 : 0;
      if (aAttempt !== bAttempt) return bAttempt - aAttempt; // attempted first
      if (a.score !== b.score) return b.score - a.score; // higher score first
      return a.originalIndex - b.originalIndex; // stable order
    });

    return scored;
  }, [filteredProblems, user?.preferences, attemptedProblems]);

  const [columnCount, setColumnCount] = useState(1);

  // Keep the desktop grid full while the cursor still has more problems.
  // The last partial row is only valid once pagination is exhausted.
  const gridProblems = useMemo(() => {
    if (!hasMore || columnCount === 1) return prioritizedProblems;

    return prioritizedProblems.slice(
      0,
      Math.floor(prioritizedProblems.length / columnCount) * columnCount,
    );
  }, [columnCount, hasMore, prioritizedProblems]);

  useEffect(() => {
    const updateColumnCount = () => {
      const width = window.innerWidth;
      let nextColumnCount = 1;
      if (width >= 1024) nextColumnCount = 3;
      else if (width >= 768) nextColumnCount = 2;
      setColumnCount(nextColumnCount);
    };
    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: hasMore
      ? Math.max(1, Math.ceil(gridProblems.length / columnCount))
      : Math.ceil(gridProblems.length / columnCount),
    estimateSize: () => 390,
    overscan: 2,
    getItemKey: (index) => `problem-row-${index}`,
  });

  const virtualRows = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastRow = virtualRows[virtualRows.length - 1];
    if (
      lastRow &&
      lastRow.index >=
        (hasMore
          ? Math.max(1, Math.ceil(gridProblems.length / columnCount))
          : Math.ceil(gridProblems.length / columnCount)) -
          2 &&
      hasMore &&
      !loadingMore
    ) {
      dispatch(fetchMoreProblems());
    }
  }, [
    columnCount,
    dispatch,
    gridProblems.length,
    hasMore,
    loadingMore,
    virtualRows,
  ]);

  // Fetch problems from API on mount
  useEffect(() => {
    dispatch(fetchProblems());
  }, [dispatch]);

  useEffect(() => {
    const query = searchParams.get("q")?.trim();
    if (query) dispatch(setSearchQuery(query));
  }, [dispatch, searchParams]);

  // Fetch attempted problems when user is authenticated
  useEffect(() => {
    if (isAuth) {
      dispatch(fetchAttemptedProblems());
    }
  }, [isAuth, dispatch]);

  const getDomainIcon = (domain: string) => {
    switch (domain) {
      case "All":
        return <MdPublic className="inline flex-shrink-0" />;
      case "infra":
        return <MdBusiness className="inline flex-shrink-0" />;
      case "application":
        return <MdPhoneAndroid className="inline flex-shrink-0" />;
      case "aiml":
        return <MdSmartToy className="inline flex-shrink-0" />;
      default:
        return <MdSettings className="inline flex-shrink-0" />;
    }
  };

  const getDomainText = (domain: string) => {
    switch (domain) {
      case "All":
        return "All";
      case "infra":
        return "Infrastructure";
      case "application":
        return "Application";
      case "aiml":
        return "AI & ML";
      default:
        return domain;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "dashboard-difficulty dashboard-difficulty--easy";
      case "Medium":
        return "dashboard-difficulty dashboard-difficulty--medium";
      case "Hard":
        return "dashboard-difficulty dashboard-difficulty--hard";
      case "Very Hard":
        return "dashboard-difficulty dashboard-difficulty--very-hard";
      default:
        return "dashboard-difficulty";
    }
  };

  return (
    <>
      <SEO
        title="System Design & AI/ML Practice Problems | Diagramwise"
        description="Practice infrastructure, application, AI/ML, and MLOps architecture problems with clear requirements, interactive diagrams, and feedback on the decisions behind your design."
        keywords="system design problems, AI ML design problems, machine learning architecture, MLOps, AIOps, recommendation systems, fraud detection, NLP, computer vision, distributed systems, scalable architecture, system design interview prep, infrastructure design, application architecture"
        image="https://diagramwise.com/og/problems.png"
        imageAlt="Diagramwise practice problems preview"
        url="https://diagramwise.com/problems"
      />
      <div className="dashboard-page min-h-screen bg-[var(--bg)] text-theme relative grid-pattern-overlay">
        <ProductHeader
          actions={
            <>
              {isAuth && (
                <button
                  type="button"
                  onClick={() => navigate("/diagrams")}
                  className="dashboard-header-action hidden md:block"
                >
                  My Designs
                </button>
              )}
              <div className="dashboard-problem-count hidden lg:block">
                {loading ? loadingLabel : `${availableProblemCount} problems available`}
              </div>
              <button
                type="button"
                onClick={startTour}
                data-tooltip="Take a tour"
                className="dashboard-header-action dashboard-tour-action"
              >
                <MdHelpOutline className="h-4 w-4" />
                <span className="hidden sm:inline">Tour</span>
              </button>
              <ThemeSwitcher />
              <div className="relative">
                {isAuth ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="dashboard-account-button"
                    >
                      {user?.picture ? (
                        <img
                          src={user.picture}
                          alt={user.name || "User"}
                          className="dashboard-avatar dashboard-avatar-image"
                        />
                      ) : (
                        <div className="dashboard-avatar">
                          {user?.name?.[0]?.toUpperCase() ||
                            user?.email?.[0]?.toUpperCase() ||
                            "U"}
                        </div>
                      )}
                      <span className="hidden sm:inline max-w-[150px] truncate">
                        {user?.name || user?.email}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {showUserMenu && (
                      <div className="dashboard-user-menu">
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
                          className="dashboard-user-menu-item border-b border-theme/10"
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
                          aria-label="Edit preferences"
                          className="dashboard-user-menu-item border-b border-theme/10"
                        >
                          Edit preferences
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            logout();
                            setShowUserMenu(false);
                          }}
                          className="dashboard-user-menu-item text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                    className="product-sign-in dashboard-sign-in"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </>
          }
        />

        {/* Main Content */}
        <div className="relative z-10" style={{ paddingTop: "1.5rem" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="dashboard-intro text-center mb-12">
              <p className="dashboard-eyebrow">Practice the craft of systems</p>
              <h1 className="text-4xl md:text-6xl font-normal mb-5 tracking-[-0.04em]">
                System Design & AI/ML Problems
              </h1>
              <p className="text-muted text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                Master Infrastructure, Application, AI & ML architectures.
                Practice with realistic architecture problems in an interactive
                canvas.
              </p>
              <nav
                className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold"
                aria-label="System design guides"
              >
                <Link
                  to="/system-design-interview/"
                  className="dashboard-guide-link"
                >
                  Interview guide
                </Link>
                <Link
                  to="/system-design-practice/"
                  className="dashboard-guide-link"
                >
                  Practice method
                </Link>
                <Link
                  to="/ai-system-design-interview/"
                  className="dashboard-guide-link"
                >
                  AI system design
                </Link>
              </nav>
            </div>

            {/* Loading State */}
            {loading && !hasProblems && (
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6"
                aria-label="Loading problems"
                aria-busy="true"
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="elevated-card-bg rounded-2xl p-6 min-h-[390px] animate-pulse"
                  >
                    <div className="h-4 w-28 rounded bg-[var(--bg-hover)] mb-6" />
                    <div className="h-6 w-4/5 rounded bg-[var(--bg-hover)] mb-4" />
                    <div className="h-4 w-full rounded bg-[var(--bg-hover)] mb-2" />
                    <div className="h-4 w-11/12 rounded bg-[var(--bg-hover)] mb-8" />
                    <div className="h-4 w-2/3 rounded bg-[var(--bg-hover)] mb-10" />
                    <div className="mt-auto h-11 w-full rounded-xl bg-[var(--bg-hover)]" />
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="elevated-card-bg backdrop-blur-md rounded-2xl p-8 mb-6 border-2 border-red-500/20 shadow-lg max-w-2xl mx-auto">
                <div className="text-center">
                  <div className="flex justify-center mb-4 text-red-400">
                    <MdWarningAmber className="w-14 h-14" />
                  </div>
                  <div className="text-theme text-xl font-semibold mb-2">
                    Couldn't load problems
                  </div>
                  <div className="text-muted text-sm mb-6">{error}</div>
                  <button
                    type="button"
                    onClick={() => globalThis.location.reload()}
                    className="dashboard-primary-cta px-6 py-3 font-semibold rounded-lg transition-all duration-200 cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Filters - Only show when not loading and no error */}
            {!error && (!loading || hasProblems) && (
              <>
                <div className="dashboard-filter-shell elevated-card-bg backdrop-blur-md rounded-2xl p-6 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Search */}
                    <div data-tour="search-box">
                      <label
                        htmlFor="search-input"
                        className="flex items-center gap-1.5 text-sm font-semibold text-theme mb-2"
                      >
                        <MdSearch className="w-4 h-4" /> Search
                      </label>
                      <input
                        id="search-input"
                        type="text"
                        placeholder="Search problems..."
                        value={searchQuery}
                        onChange={(e) =>
                          dispatch(setSearchQuery(e.target.value))
                        }
                        className="dashboard-search-input w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent bg-[var(--surface)] text-theme transition-all duration-300"
                      />
                    </div>

                    {/* Difficulty Filter */}
                    <div data-tour="difficulty-filter">
                      <label
                        htmlFor="difficulty-select"
                        className="flex items-center gap-1.5 text-sm font-semibold text-theme mb-2"
                      >
                        <MdTune className="w-4 h-4" /> Difficulty
                      </label>
                      <SelectDropdown
                        id="difficulty-select"
                        value={selectedDifficulty}
                        options={difficulties}
                        onChange={(value) =>
                          dispatch(setSelectedDifficulty(value))
                        }
                        aria-label="Difficulty"
                      />
                    </div>

                    {/* Category Filter */}
                    <div data-tour="category-filter">
                      <label
                        htmlFor="category-select"
                        className="flex items-center gap-1.5 text-sm font-semibold text-theme mb-2"
                      >
                        <MdLabel className="w-4 h-4" /> Category
                      </label>
                      <SelectDropdown
                        id="category-select"
                        value={selectedCategory}
                        options={categories}
                        onChange={(value) =>
                          dispatch(setSelectedCategory(value))
                        }
                        aria-label="Category"
                      />
                    </div>
                  </div>
                </div>

                {/* Domain Filter - Below the other filters */}
                <div
                  className="dashboard-domain-filter mb-6"
                  data-tour="domain-filter"
                >
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-theme mb-2">
                    <MdPublic className="w-4 h-4" /> Domain
                  </div>
                  <div className="flex flex-wrap gap-2 p-1 rounded-xl">
                    {domains.map((domain) => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => dispatch(setSelectedDomain(domain))}
                        className={`dashboard-domain-chip flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          selectedDomain === domain
                            ? "dashboard-domain-chip--active"
                            : ""
                        }`}
                      >
                        {getDomainIcon(domain)}
                        <span className="hidden sm:inline">
                          {getDomainText(domain)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Problems Grid */}
                <div
                  className="relative pb-12"
                  style={{ height: `${virtualizer.getTotalSize()}px` }}
                >
                  {virtualRows.map((virtualRow) => (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                        {gridProblems
                          .slice(
                            virtualRow.index * columnCount,
                            (virtualRow.index + 1) * columnCount,
                          )
                          .map((entry, columnIndex) => {
                            const index =
                              virtualRow.index * columnCount + columnIndex;
                            const problem = entry.problem;
                            const score = entry.score;
                            const delayClass =
                              ["delay-0", "delay-100", "delay-200"][index] ?? "";
                            return (
                              <div
                                key={problem.id}
                                data-tour={
                                  index === 0 ? "problem-card" : undefined
                                }
                                className={`dashboard-problem-card group elevated-card-bg backdrop-blur-md rounded-2xl transition-all duration-500 relative h-full flex flex-col ${delayClass}`}
                              >
                                {problem.has_guided_walkthrough ? (
                                  <div className="dashboard-guided-banner flex items-center justify-between px-4 py-2 rounded-t-2xl">
                                    <div className="flex items-center gap-3 text-sm font-semibold tracking-wide">
                                      <span>🗺️</span>
                                      <span>Guided Walkthrough</span>
                                      {score > 0 && (
                                        <span className="dashboard-recommended inline-block px-2 py-0.5 text-xs font-semibold rounded">
                                          Recommended
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getDifficultyColor(problem.difficulty)}`}
                                    >
                                      {problem.difficulty}
                                    </span>
                                  </div>
                                ) : null}
                                <div className="relative p-6 flex flex-col flex-1">
                                  {!problem.has_guided_walkthrough &&
                                    score > 0 && (
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="dashboard-recommended inline-block px-2 py-1 text-xs font-semibold rounded">
                                          Recommended
                                        </span>
                                        <span
                                          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getDifficultyColor(problem.difficulty)}`}
                                        >
                                          {problem.difficulty}
                                        </span>
                                      </div>
                                    )}
                                  <div className="flex items-start justify-between mb-4">
                                    <h3 className="text-lg font-bold text-theme group-hover:text-[var(--brand)] transition-colors duration-300 line-clamp-2 flex-1 pr-2">
                                      <Link
                                        to={`/problems/${getProblemSlug(problem)}/`}
                                        className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
                                      >
                                        {problem.title}
                                      </Link>
                                    </h3>
                                    {!problem.has_guided_walkthrough &&
                                      score === 0 && (
                                        <div className="flex-shrink-0 ml-2">
                                          <span
                                            className={`px-3 py-1 text-xs font-semibold rounded-full ${getDifficultyColor(problem.difficulty)}`}
                                          >
                                            {problem.difficulty}
                                          </span>
                                        </div>
                                      )}
                                  </div>

                                  <p className="text-muted text-sm mb-4 line-clamp-3 leading-relaxed">
                                    {problem.description}
                                  </p>

                                  <div className="flex items-center justify-between text-sm text-muted mb-4 pb-4 border-b border-[var(--theme)]/10">
                                    <span className="flex items-center gap-1">
                                      <MdLabel className="w-4 h-4 text-muted/60" />{" "}
                                      {problem.category}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MdAccessTime className="w-4 h-4 text-muted/60" />{" "}
                                      {problem.estimated_time}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap gap-2 mb-6">
                                    {problem.tags
                                      .slice(0, 3)
                                      .map((tag: string) => (
                                        <span
                                          key={tag}
                                          className="dashboard-tag px-3 py-1 uppercase text-xs font-semibold rounded-full"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    {problem.tags.length > 3 && (
                                      <span className="dashboard-tag dashboard-tag--muted px-3 py-1 text-xs font-medium rounded-full">
                                        +{problem.tags.length - 3} more
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-auto grid grid-cols-[5fr_7fr] gap-2">
                                    <Link
                                      to={`/problems/${getProblemSlug(problem)}/`}
                                      aria-label={`View guide for ${problem.title}`}
                                      className="dashboard-secondary-cta inline-flex w-full items-center justify-center rounded-xl border px-3 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                                    >
                                      View guide
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!problem.id) {
                                          navigate(
                                            `/problems/${getProblemSlug(problem)}/`,
                                          );
                                          return;
                                        }
                                        if (!isAuth) {
                                          setShowAuthModal(true);
                                          return;
                                        }
                                        navigate(`/playground/${problem.id}`);
                                      }}
                                      aria-label={`Start ${problem.title}`}
                                      className={`dashboard-primary-cta w-full px-3 py-3 text-sm font-semibold rounded-xl transition-all duration-300 cursor-pointer ${
                                        isAuth &&
                                        attemptedProblems.has(problem.id)
                                          ? "bg-blue-600 text-white hover:shadow-md"
                                          : "bg-[var(--brand)] text-[var(--bg)] hover:shadow-md"
                                      }`}
                                    >
                                      <span className="flex items-center justify-center gap-2">
                                        {isAuth &&
                                          attemptedProblems.has(problem.id) && (
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              className="h-4 w-4"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                              strokeWidth={2.5}
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                              />
                                            </svg>
                                          )}
                                        {isAuth &&
                                        attemptedProblems.has(problem.id)
                                          ? "Continue Problem"
                                          : "Start Problem"}{" "}
                                        →
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>

                {loadingMore && (
                  <output className="block py-8 text-center text-muted">
                    Loading more problems…
                  </output>
                )}

                {!loadingMore && hasMore && prioritizedProblems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => dispatch(fetchMoreProblems())}
                    className="dashboard-secondary-cta mx-auto mb-10 block rounded-xl border px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  >
                    Load more problems
                  </button>
                )}

                {filteredProblems.length === 0 && !loading && (
                  <div className="text-center py-20">
                    <div className="flex justify-center mb-6 text-muted/40">
                      <MdSearchOff className="w-16 h-16" />
                    </div>
                    <div className="text-theme text-xl font-semibold mb-2">
                      No problems found
                    </div>
                    <div className="text-muted">
                      Try adjusting your filters or search terms.
                    </div>
                  </div>
                )}
              </>
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

export default Dashboard;
