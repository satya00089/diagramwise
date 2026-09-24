import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { AuthModal } from "../components/AuthModal";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../hooks/useOnboarding";
import { useTour } from "../hooks/useTour";
import { useToast } from "../hooks/useToast";
import SEO from "../components/SEO";
import { ToastContainer } from "../components/Toast";
import { apiService } from "../services/api";
import type { SavedDiagramSummary } from "../types/auth";
import {
  MdContentCopy,
  MdDeleteOutline,
  MdHelpOutline,
  MdLockOutline,
  MdOpenInNew,
  MdPublic,
  MdSearch,
  MdSearchOff,
  MdSort,
  MdVisibilityOff,
} from "react-icons/md";
import {
  HiChevronDown,
  HiEye,
  HiShare,
  HiUserGroup,
  HiPencilSquare,
  HiCube,
} from "react-icons/hi2";
import "./MyDesigns.css";

const copyValue = async (value: string) => {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is unavailable");
  }
  await navigator.clipboard.writeText(value);
};

const CARD_DELAY_CLASSES = ["delay-0", "delay-100", "delay-200"] as const;

type SortOption = "updated" | "created" | "title";

type DesignFamily = {
  primary: SavedDiagramSummary;
  related: SavedDiagramSummary[];
};

const isRemix = (diagram: SavedDiagramSummary) =>
  diagram.recordType === "remix" ||
  Boolean(diagram.sourceDiagramId) ||
  /\s[—-]\sRemix$/i.test(diagram.title);

const remixBaseTitle = (title: string) =>
  title.replace(/\s[—-]\sRemix$/i, "").trim();

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "updated", label: "Last Updated" },
  { value: "created", label: "Date Created" },
  { value: "title", label: "Title (A-Z)" },
];

const MyDesignsSortSelect: React.FC<{
  value: SortOption;
  onChange: (value: SortOption) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    Math.max(
      0,
      sortOptions.findIndex((option) => option.value === value),
    ),
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(
      Math.max(
        0,
        sortOptions.findIndex((option) => option.value === value),
      ),
    );
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, value]);

  const choose = (nextValue: SortOption) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="my-designs-select-wrapper">
      <button
        id="sort-select"
        type="button"
        className="my-designs-select-trigger"
        aria-label="Sort By"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex((current) =>
              event.key === "ArrowDown"
                ? Math.min(sortOptions.length - 1, current + 1)
                : Math.max(0, current - 1),
            );
          } else if (event.key === "Home") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex(0);
          } else if (event.key === "End") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex(sortOptions.length - 1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(sortOptions[highlightedIndex].value);
            else setOpen(true);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span>
          {sortOptions.find((option) => option.value === value)?.label}
        </span>
        <HiChevronDown
          aria-hidden="true"
          className={`my-designs-select-chevron ${open ? "my-designs-select-chevron--open" : ""}`}
        />
      </button>
      {open && (
        <div
          className="my-designs-select-menu"
          role="listbox"
          aria-label="Sort By"
        >
          {sortOptions.map((option, index) => (
            <div
              key={option.value}
              role="option"
              tabIndex={0}
              aria-selected={option.value === value}
              className={`my-designs-select-option ${
                index === highlightedIndex
                  ? "my-designs-select-option--highlighted"
                  : ""
              } ${
                option.value === value
                  ? "my-designs-select-option--selected"
                  : ""
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => choose(option.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  choose(option.value);
                }
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MyDesignsLoadingState: React.FC = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading your designs"
    className="my-designs-loading"
  >
    <span className="sr-only">Loading your designs…</span>
    <div
      aria-hidden="true"
      className="my-designs-tabs flex gap-2 mb-6"
    >
      {["w-28", "w-32", "w-40"].map((width) => (
        <div
          key={width}
          className={`h-11 ${width} rounded-xl bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none`}
        />
      ))}
    </div>
    <div
      aria-hidden="true"
      className="my-designs-filters elevated-card-bg rounded-2xl p-6 mb-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {["w-24", "w-20"].map((width) => (
          <div key={width}>
            <div
              className={`h-4 ${width} rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none mb-3`}
            />
            <div className="h-12 w-full rounded-xl bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
    <div
      aria-hidden="true"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="my-designs-card elevated-card-bg rounded-2xl p-6 min-h-[360px]"
        >
          <div className="h-6 w-3/4 rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none mb-4" />
          <div className="h-4 w-1/2 rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none mb-3" />
          <div className="space-y-2 mb-8">
            <div className="h-3 w-full rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none" />
            <div className="h-3 w-5/6 rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="h-4 w-full rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none mb-4" />
          <div className="h-3 w-2/3 rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none mb-8" />
          <div className="h-12 w-full rounded-lg bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  </div>
);

const MyDesignsLoadMoreSkeletons: React.FC = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading more designs"
    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6"
  >
    <span className="sr-only">Loading more designs…</span>
    {Array.from({ length: 3 }, (_, index) => (
      <div
        key={index}
        aria-hidden="true"
        className="my-designs-card elevated-card-bg rounded-2xl p-6 min-h-[260px]"
      >
        <div className="h-6 w-3/4 rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none mb-4" />
        <div className="h-4 w-1/2 rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none mb-8" />
        <div className="space-y-2 mb-10">
          <div className="h-3 w-full rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-5/6 rounded bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="h-12 w-full rounded-lg bg-[var(--bg-hover)] animate-pulse motion-reduce:animate-none" />
      </div>
    ))}
  </div>
);

const MyDesigns: React.FC = () => {
  useTheme();
  const navigate = useNavigate();
  const { isNewToPage, markPageVisited } = useOnboarding();
  const { startTour } = useTour("my_designs");
  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagramSummary[]>([]);
  const [loadingDiagrams, setLoadingDiagrams] = useState(true);
  const [loadingMoreDiagrams, setLoadingMoreDiagrams] = useState(false);
  const [nextDiagramCursor, setNextDiagramCursor] = useState<string | null>(
    null,
  );
  const [hasMoreDiagrams, setHasMoreDiagrams] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "title">(
    "updated",
  );
  const [filterBy, setFilterBy] = useState<"all" | "owned" | "shared">("all");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [diagramToDelete, setDiagramToDelete] = useState<SavedDiagramSummary | null>(
    null,
  );
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [diagramToUnpublish, setDiagramToUnpublish] =
    useState<SavedDiagramSummary | null>(null);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);
  const [copiedDiagramId, setCopiedDiagramId] = useState<string | null>(null);
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(
    () => new Set(),
  );
  const {
    user,
    isAuthenticated: isAuth,
    login,
    signup,
    googleLogin,
    logout,
  } = useAuth();
  const toast = useToast();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isAuth) {
      navigate("/");
    }
  }, [isAuth, navigate]);

  // Mark visited + auto-start tour for new users
  useEffect(() => {
    const isNew = isNewToPage("my_designs");
    markPageVisited("my_designs");
    if (isNew) {
      const t = setTimeout(() => startTour(), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load diagrams
  useEffect(() => {
    const loadDiagrams = async () => {
      if (!isAuth) {
        setSavedDiagrams([]);
        setNextDiagramCursor(null);
        setHasMoreDiagrams(false);
        return;
      }
      setLoadingDiagrams(true);
      try {
        const page = await apiService.getUserDiagramPage();
        setSavedDiagrams(page.items);
        setNextDiagramCursor(page.next_cursor);
        setHasMoreDiagrams(page.has_more);
      } catch (error) {
        console.error("Failed to load diagrams:", error);
      } finally {
        setLoadingDiagrams(false);
      }
    };
    loadDiagrams();
  }, [isAuth]);

  const loadMoreDiagrams = useCallback(async () => {
    if (
      !isAuth ||
      !hasMoreDiagrams ||
      !nextDiagramCursor ||
      loadingMoreDiagrams
    ) {
      return;
    }

    setLoadingMoreDiagrams(true);
    try {
      const page = await apiService.getUserDiagramPage(nextDiagramCursor);
      setSavedDiagrams((current) => {
        const existingIds = new Set(current.map((diagram) => diagram.id));
        return [
          ...current,
          ...page.items.filter((diagram) => !existingIds.has(diagram.id)),
        ];
      });
      setNextDiagramCursor(page.next_cursor);
      setHasMoreDiagrams(page.has_more);
    } catch (error) {
      console.error("Failed to load more diagrams:", error);
    } finally {
      setLoadingMoreDiagrams(false);
    }
  }, [hasMoreDiagrams, isAuth, loadingMoreDiagrams, nextDiagramCursor]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMoreDiagrams) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreDiagrams();
        }
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreDiagrams, loadMoreDiagrams]);

  const handleOpenDiagram = (diagramId: string) => {
    navigate(`/playground/free?diagramId=${diagramId}`);
  };

  const handleDeleteDiagram = async (
    diagram: SavedDiagramSummary,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();

    // Only owners can delete
    if (!diagram.isOwner) {
      return;
    }

    setDiagramToDelete(diagram);
    setShowDeleteDialog(true);
  };

  const confirmDeleteDiagram = async () => {
    if (!diagramToDelete || isDeleting) return;

    const diagram = diagramToDelete;
    setIsDeleting(true);

    try {
      await apiService.deleteDiagram(diagram.id);
      setSavedDiagrams((prev) =>
        prev.filter((d) => d.id !== diagram.id),
      );
      setShowDeleteDialog(false);
      setDiagramToDelete(null);
      toast.success(`“${diagram.title}” was deleted.`);
    } catch (error) {
      console.error("Failed to delete diagram:", error);
      toast.error("The design could not be deleted. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteDiagram = () => {
    setShowDeleteDialog(false);
    setDiagramToDelete(null);
  };

  useEffect(() => {
    if (!showDeleteDialog) return;

    const focusCancel = window.requestAnimationFrame(() => {
      deleteCancelRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) {
        setShowDeleteDialog(false);
        setDiagramToDelete(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusCancel);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDeleting, showDeleteDialog]);

  const publicUrlFor = (diagramId: string) =>
    `${window.location.origin}/public/${encodeURIComponent(diagramId)}`;

  const handleCopyPublicLink = async (
    diagram: SavedDiagramSummary,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    try {
      const publicUrl = publicUrlFor(diagram.publicSnapshotId ?? diagram.id);
      await copyValue(publicUrl);
      setCopiedDiagramId(diagram.id);
      window.setTimeout(
        () =>
          setCopiedDiagramId((current) =>
            current === diagram.id ? null : current,
          ),
        2200,
      );
    } catch {
      window.prompt("Copy this public link:", publicUrlFor(diagram.publicSnapshotId ?? diagram.id));
    }
  };

  const handleOpenPublicPage = (
    diagram: SavedDiagramSummary,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    window.open(
      publicUrlFor(diagram.publicSnapshotId ?? diagram.id),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const requestUnpublish = (
    diagram: SavedDiagramSummary,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    setUnpublishError(null);
    setDiagramToUnpublish(diagram);
  };

  const confirmUnpublish = async () => {
    if (!diagramToUnpublish || isUnpublishing) return;
    setIsUnpublishing(true);
    setUnpublishError(null);
    try {
      await apiService.unpublishDiagram(diagramToUnpublish.id);
      setSavedDiagrams((current) =>
        current.map((diagram) =>
          diagram.id === diagramToUnpublish.id
            ? { ...diagram, isPublic: false, publicSnapshotId: null }
            : diagram,
        ),
      );
      setDiagramToUnpublish(null);
    } catch {
      setUnpublishError(
        "The design is still public. Check your connection and try again.",
      );
    } finally {
      setIsUnpublishing(false);
    }
  };

  const { filteredFamilies, ownedCount, sharedCount } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const byId = new Map(savedDiagrams.map((diagram) => [diagram.id, diagram]));
    const families = new Map<string, DesignFamily>();

    savedDiagrams.filter((diagram) => !isRemix(diagram)).forEach((diagram) => {
      const key = diagram.familyId || diagram.id;
      families.set(key, { primary: diagram, related: [] });
    });

    savedDiagrams.filter(isRemix).forEach((diagram) => {
      const explicitParent = diagram.sourceDiagramId
        ? byId.get(diagram.sourceDiagramId)
        : undefined;
      const legacyParent =
        explicitParent ||
        savedDiagrams.find(
          (candidate) =>
            !isRemix(candidate) &&
            candidate.title.trim() === remixBaseTitle(diagram.title) &&
            candidate.isPublic,
        ) ||
        savedDiagrams.find(
          (candidate) =>
            !isRemix(candidate) &&
            candidate.title.trim() === remixBaseTitle(diagram.title),
        );
      const parent = explicitParent || legacyParent;
      const key = parent?.familyId || parent?.id || diagram.familyId || diagram.id;
      const family = families.get(key);
      if (family) {
        family.related.push(diagram);
      } else {
        families.set(key, { primary: parent || diagram, related: parent ? [diagram] : [] });
      }
    });

    const filtered = Array.from(families.values())
      .filter((family) => {
        const members = [family.primary, ...family.related];
        if (filterBy === "owned" && !members.some((diagram) => diagram.isOwner)) return false;
        if (filterBy === "shared" && !members.some((diagram) => !diagram.isOwner)) return false;
        return members.some((diagram) =>
          diagram.title.toLowerCase().includes(searchLower) ||
          diagram.description?.toLowerCase().includes(searchLower) ||
          diagram.owner.name.toLowerCase().includes(searchLower) ||
          diagram.owner.email.toLowerCase().includes(searchLower) ||
          false,
        );
      })
      .sort((a, b) => {
        const first = a.primary;
        const second = b.primary;
        switch (sortBy) {
          case "title":
            return first.title.localeCompare(second.title);
          case "created":
            return (
              new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
            );
          case "updated":
          default:
            return (
              new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
            );
        }
      });

    return {
      filteredFamilies: filtered,
      ownedCount: savedDiagrams.filter((diagram) => diagram.isOwner).length,
      sharedCount: savedDiagrams.filter((diagram) => !diagram.isOwner).length,
    };
  }, [filterBy, savedDiagrams, searchTerm, sortBy]);

  return (
    <>
      <SEO
        title="My Designs | Diagramwise"
        description="View and manage your saved system design projects and diagrams shared with you"
        image="https://diagramwise.com/og/diagrams.png"
        imageAlt="Diagramwise saved designs preview"
        url="https://diagramwise.com/diagrams"
        noIndex
      />
      <div className="my-designs-page min-h-screen relative grid-pattern-overlay">
        {/* Header */}
        <header
          className="my-designs-header fixed left-0 right-0 z-50 transition-all duration-300"
          style={{ top: "var(--announcement-h, 0px)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="my-designs-brand flex items-center space-x-3 group cursor-pointer"
              >
                <img
                  src="/logo-64.png"
                  alt="Logo"
                  className="h-7 transition-transform group-hover:scale-110 duration-300"
                />
                <span className="tracking-wide leading-none">Diagramwise</span>
              </button>
              <div className="flex items-center gap-4">
                {isAuth && (
                  <button
                    type="button"
                    onClick={() => navigate("/problems")}
                    className="my-designs-header-link hidden md:block px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
                  >
                    Problems
                  </button>
                )}

                <div className="my-designs-count hidden md:block text-sm">
                  {loadingDiagrams
                    ? "Loading..."
                    : `${ownedCount} owned · ${sharedCount} shared`}
                </div>
                <button
                  type="button"
                  data-tour="new-design-btn"
                  onClick={() => navigate("/playground/free")}
                  className="my-designs-new-design px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer"
                >
                  New Design
                </button>

                {/* Tour trigger */}
                <button
                  type="button"
                  onClick={startTour}
                  className="my-designs-tour flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer"
                >
                  <MdHelpOutline className="h-4 w-4" />
                  <span className="hidden sm:inline">Tour</span>
                </button>

                <ThemeSwitcher />

                {/* Authentication UI */}
                <div className="relative">
                  {isAuth ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="my-designs-account flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer"
                      >
                        {user?.picture ? (
                          <img
                            src={user.picture}
                            alt={user.name || "User"}
                            className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
                            {user?.name?.[0]?.toUpperCase() || "U"}
                          </div>
                        )}
                        <span className="hidden sm:inline text-sm">
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

                      {/* User Dropdown Menu */}
                      {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-[var(--elevated)] backdrop-blur-sm ring-1 ring-black/5 border border-[var(--border)]">
                          <div className="py-1">
                            <div className="px-4 py-3 border-b border-[var(--border)]">
                              <p className="text-sm font-medium text-theme">
                                {user?.name}
                              </p>
                              <p className="text-sm text-muted truncate">
                                {user?.email}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowUserMenu(false);
                                logout();
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                            >
                              Sign Out
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="my-designs-sign-in px-4 py-2 text-sm font-medium rounded-md transition-all cursor-pointer"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="my-designs-content pt-16 relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="my-designs-intro mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                My Designs
              </h1>
              <p className="text-muted text-lg max-w-2xl mx-auto">
                View and manage your saved projects and diagrams shared with you
              </p>
            </div>

            {loadingDiagrams ? (
              <MyDesignsLoadingState />
            ) : (
              <>
                {/* Filter Tabs */}
                <div
                  className="my-designs-tabs flex gap-2 mb-6"
                  data-tour="filter-tabs"
                >
                  <button
                    type="button"
                    onClick={() => setFilterBy("all")}
                    className={`my-designs-tab px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                      filterBy === "all" ? "my-designs-tab--active" : ""
                    }`}
                  >
                    All Designs ({savedDiagrams.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterBy("owned")}
                    className={`my-designs-tab px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                      filterBy === "owned" ? "my-designs-tab--active" : ""
                    }`}
                  >
                    My Designs ({ownedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterBy("shared")}
                    className={`my-designs-tab px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                      filterBy === "shared" ? "my-designs-tab--active" : ""
                    }`}
                  >
                    Shared with Me ({sharedCount})
                  </button>
                </div>

                <div className="my-designs-filters elevated-card-bg rounded-2xl p-6 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Search */}
                    <div>
                      <label
                        htmlFor="search-input"
                        className="block text-sm font-semibold text-theme mb-2 flex items-center gap-1.5"
                      >
                        <MdSearch className="w-4 h-4" /> Search
                      </label>
                      <input
                        id="search-input"
                        type="text"
                        placeholder="Search designs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="my-designs-input w-full px-4 py-3 rounded-xl focus:outline-none transition-all duration-300"
                      />
                    </div>

                    {/* Sort */}
                    <div>
                      <label
                        htmlFor="sort-select"
                        className="block text-sm font-semibold text-theme mb-2 flex items-center gap-1.5"
                      >
                        <MdSort className="w-4 h-4" /> Sort By
                      </label>
                      <MyDesignsSortSelect
                        value={sortBy}
                        onChange={setSortBy}
                      />
                    </div>
                  </div>
                </div>

                {/* Empty State */}
                {filteredFamilies.length === 0 && (
                  <div className="text-center py-20">
                    <div className="flex justify-center mb-6 text-[var(--brand)]/40">
                      {searchTerm ? (
                        <MdSearchOff className="w-16 h-16" />
                      ) : filterBy === "shared" ? (
                        <HiUserGroup className="w-16 h-16" />
                      ) : (
                        <HiPencilSquare className="w-16 h-16" />
                      )}
                    </div>
                    <div className="text-theme text-2xl font-bold mb-2">
                      {searchTerm
                        ? "No designs match your search"
                        : filterBy === "shared"
                          ? "Nothing shared with you yet"
                          : filterBy === "owned"
                            ? "No designs yet"
                            : "No designs yet"}
                    </div>
                    <div className="text-muted text-lg mb-6">
                      {searchTerm
                        ? "Try a different search term."
                        : filterBy === "shared"
                          ? "Designs shared with you will show up here."
                          : "Create your first design to get started."}
                    </div>
                    {!searchTerm && filterBy !== "shared" && (
                      <button
                        type="button"
                        onClick={() => navigate("/playground/free")}
                        className="my-designs-primary px-6 py-3 font-semibold rounded-lg transition-all duration-200 cursor-pointer"
                      >
                        Create Your First Design →
                      </button>
                    )}
                  </div>
                )}

                {/* Diagrams Grid */}
                {filteredFamilies.length > 0 && (
                  <div className="my-designs-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                    {filteredFamilies.map(({ primary: diagram, related }, index) => (
                      <div
                        key={diagram.id}
                        data-tour={index === 0 ? "design-card" : undefined}
                        className={`my-designs-card group elevated-card-bg rounded-2xl transition-all duration-500 overflow-hidden ${CARD_DELAY_CLASSES[index] ?? ""}`}
                      >
                        <div className="relative p-6">
                          <div
                            className="cursor-pointer"
                            onClick={() => handleOpenDiagram(diagram.id)}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1 pr-8">
                                <div className="flex items-start gap-2 mb-2">
                                  <h3 className="text-lg font-bold text-theme group-hover:text-[var(--brand)] transition-colors duration-300 line-clamp-2 flex-1">
                                    {diagram.title}
                                  </h3>
                                </div>

                                {diagram.isOwner && (
                                  <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                        diagram.isPublic
                                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                          : "bg-[var(--theme)]/8 text-muted"
                                      }`}
                                    >
                                      {diagram.isPublic ? (
                                        <MdPublic aria-hidden />
                                      ) : (
                                        <MdLockOutline aria-hidden />
                                      )}
                                      {diagram.isPublic ? "Public" : "Private"}
                                    </span>
                                    {diagram.isPublic && (
                                      <span className="text-[11px] tabular-nums text-muted">
                                        {diagram.viewCount ?? 0}{" "}
                                        {(diagram.viewCount ?? 0) === 1
                                          ? "view"
                                          : "views"}
                                        {diagram.publishedAt
                                          ? ` · Published ${new Date(diagram.publishedAt).toLocaleDateString()}`
                                          : ""}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Shared-by and permission metadata */}
                                {!diagram.isOwner && (
                                  <div className="my-designs-sharing mb-3">
                                    <div className="my-designs-sharing-person">
                                      <HiShare
                                        className="my-designs-sharing-icon"
                                        aria-hidden="true"
                                      />
                                      <div className="my-designs-sharing-avatar">
                                        {diagram.owner.pictureUrl ? (
                                          <img
                                            src={diagram.owner.pictureUrl}
                                            alt=""
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          diagram.owner.name[0]?.toUpperCase()
                                        )}
                                      </div>
                                      <div className="my-designs-sharing-copy">
                                        <span className="my-designs-sharing-label">
                                          Shared by
                                        </span>
                                        <span className="my-designs-sharing-name">
                                          {diagram.owner.name}
                                        </span>
                                      </div>
                                    </div>

                                    <div
                                      className={`my-designs-permission-badge ${
                                        diagram.permission === "edit"
                                          ? "my-designs-permission-badge--edit"
                                          : "my-designs-permission-badge--view"
                                      }`}
                                    >
                                      {diagram.permission === "edit" ? (
                                        <HiPencilSquare aria-hidden="true" />
                                      ) : (
                                        <HiEye aria-hidden="true" />
                                      )}
                                      <span>
                                        {diagram.permission === "edit"
                                          ? "Can Edit"
                                          : "View Only"}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {diagram.description && (
                                  <p className="text-muted text-sm line-clamp-2 leading-relaxed">
                                    {diagram.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-[var(--brand)]/30">
                                <HiCube className="w-8 h-8" />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-sm text-muted mb-4 pb-4 border-b border-[var(--theme)]/10">
                              <span className="flex items-center gap-1">
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
                                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                                  />
                                </svg>
                                {diagram.nodeCount} node
                                {diagram.nodeCount === 1 ? "" : "s"}
                              </span>
                              <span className="flex items-center gap-1">
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
                                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                  />
                                </svg>
                                {diagram.edgeCount} connection
                                {diagram.edgeCount === 1 ? "" : "s"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted mb-6">
                              <span>
                                Updated{" "}
                                {new Date(diagram.updatedAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                              <span>
                                Created{" "}
                                {new Date(diagram.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </span>
                            </div>

                            {diagram.isOwner && diagram.isPublic && (
                              <div className="mb-3 grid grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    void handleCopyPublicLink(diagram, event)
                                  }
                                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--theme)]/5 px-2 py-2 text-[11px] font-semibold text-theme hover:bg-[var(--theme)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                                >
                                  <MdContentCopy aria-hidden />
                                  {copiedDiagramId === diagram.id
                                    ? "Copied"
                                    : "Copy link"}
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    handleOpenPublicPage(diagram, event)
                                  }
                                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--theme)]/5 px-2 py-2 text-[11px] font-semibold text-theme hover:bg-[var(--theme)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                                >
                                  <MdOpenInNew aria-hidden /> View
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    requestUnpublish(diagram, event)
                                  }
                                  className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold text-muted hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:text-red-300"
                                >
                                  <MdVisibilityOff aria-hidden /> Unpublish
                                </button>
                              </div>
                            )}

                            {related.length > 0 && (
                              <div className="my-designs-related">
                                <button
                                  type="button"
                                  className="my-designs-related-toggle"
                                  aria-expanded={expandedFamilyIds.has(diagram.id)}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setExpandedFamilyIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(diagram.id)) next.delete(diagram.id);
                                      else next.add(diagram.id);
                                      return next;
                                    });
                                  }}
                                >
                                  <span className="my-designs-related-heading">
                                    <span className="my-designs-related-dot" aria-hidden="true" />
                                    Related designs
                                    <span className="my-designs-related-count">{related.length}</span>
                                  </span>
                                  <HiChevronDown
                                    aria-hidden="true"
                                    className={`my-designs-related-chevron ${expandedFamilyIds.has(diagram.id) ? "is-open" : ""}`}
                                  />
                                </button>
                                {expandedFamilyIds.has(diagram.id) && (
                                  <div className="my-designs-related-list">
                                    {related.map((relatedDiagram) => (
                                      <div className="my-designs-related-row" key={relatedDiagram.id}>
                                        <div className="my-designs-related-copy">
                                          <span className="my-designs-related-title">
                                            {relatedDiagram.title}
                                          </span>
                                          <span className="my-designs-related-meta">
                                            {relatedDiagram.isPublic ? "Public version" : "Independent copy"}
                                            {relatedDiagram.isPublic ? " · snapshot" : " · changes stay separate"}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          className="my-designs-related-action"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleOpenDiagram(relatedDiagram.id);
                                          }}
                                        >
                                          Open
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="my-designs-card-actions">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDiagram(diagram.id);
                                }}
                                className="my-designs-primary min-w-0 flex-1 rounded-lg px-4 py-3 font-semibold transition-[transform,filter] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                              >
                                Open design
                              </button>
                              {diagram.isOwner && (
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    void handleDeleteDiagram(diagram, event)
                                  }
                                  className="my-designs-delete-action rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                                  aria-label={`Delete ${diagram.title}`}
                                >
                                  <MdDeleteOutline aria-hidden />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {hasMoreDiagrams && (
                  <div
                    ref={loadMoreSentinelRef}
                    aria-hidden="true"
                    className="h-px w-full"
                  />
                )}

                {loadingMoreDiagrams && <MyDesignsLoadMoreSkeletons />}

                {!loadingMoreDiagrams &&
                  hasMoreDiagrams &&
                  savedDiagrams.length > 0 && (
                    <div className="flex justify-center pb-12">
                      <button
                        type="button"
                        onClick={() => void loadMoreDiagrams()}
                        className="my-designs-tab px-6 py-2.5 rounded-xl font-semibold transition-all duration-300"
                      >
                        Load more designs
                      </button>
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

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && diagramToDelete && (
        <dialog
          open
          className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-slate-950/65 p-4"
          aria-modal="true"
          aria-labelledby="delete-design-title"
          aria-describedby="delete-design-description"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cancel deleting design"
            onClick={() => !isDeleting && cancelDeleteDiagram()}
            disabled={isDeleting}
          />
          <div className="app-modal my-designs-delete-dialog relative w-full">
            <div className="app-modal__body">
              <div className="my-designs-delete-dialog__header">
                <div className="my-designs-delete-dialog__icon" aria-hidden="true">
                  <MdDeleteOutline size={22} />
                </div>
                <div className="min-w-0">
                  <h2 id="delete-design-title" className="app-modal__title">
                    Delete this design?
                  </h2>
                  <p className="my-designs-delete-dialog__eyebrow">
                    Permanent action
                  </p>
                </div>
              </div>

              <p id="delete-design-description" className="my-designs-delete-dialog__copy">
                “<strong>{diagramToDelete.title}</strong>” and all of its saved
                data will be permanently removed. You won’t be able to recover
                this design.
              </p>

              <div className="my-designs-delete-dialog__actions">
                <button
                  ref={deleteCancelRef}
                  type="button"
                  onClick={cancelDeleteDiagram}
                  disabled={isDeleting}
                  className="app-modal__secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteDiagram()}
                  disabled={isDeleting}
                  aria-busy={isDeleting}
                  className="my-designs-delete-dialog__danger disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isDeleting && (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden="true"
                    />
                  )}
                  {isDeleting ? "Deleting…" : "Delete design"}
                </button>
              </div>
            </div>
          </div>
        </dialog>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {diagramToUnpublish && (
        <dialog
          open
          className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-slate-950/65 p-4"
          aria-modal="true"
          aria-labelledby="unpublish-design-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cancel unpublishing"
            onClick={() => !isUnpublishing && setDiagramToUnpublish(null)}
            disabled={isUnpublishing}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-[0_24px_72px_rgba(0,0,0,0.34)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-300">
                <MdVisibilityOff size={22} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2
                  id="unpublish-design-title"
                  className="text-lg font-bold text-theme"
                >
                  Unpublish this design?
                </h2>
                <p className="mt-1 break-words text-sm leading-relaxed text-muted">
                  The public link for “{diagramToUnpublish.title}” will stop
                  working. Your saved design and collaborators will not be
                  affected.
                </p>
              </div>
            </div>

            {unpublishError && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
              >
                {unpublishError}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDiagramToUnpublish(null)}
                disabled={isUnpublishing}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:opacity-50"
              >
                Keep public
              </button>
              <button
                type="button"
                onClick={() => void confirmUnpublish()}
                disabled={isUnpublishing}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUnpublishing && (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden
                  />
                )}
                Unpublish
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
};

export default MyDesigns;
