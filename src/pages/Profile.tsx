import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HiArrowUpRight, HiPencil } from "react-icons/hi2";
import { MdCheckCircle } from "react-icons/md";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import ThemeSwitcher from "../components/ThemeSwitcher";
import ProductHeader from "../components/ProductHeader";
import SEO from "../components/SEO";
import UserAvatar from "../components/UserAvatar";
import {
  BLOBATAR_AVATAR_BATCH_SIZE,
  BLOBATAR_INITIAL_AVATAR_COUNT,
  getBlobatarAvatarChoice,
  isAvatarKey,
  type AvatarKey,
} from "../config/avatar";
import { apiService } from "../services/api";
import {
  fetchLearningPaths,
  getEmbeddedLearningPaths,
} from "../services/contentLoader";
import type { LearningPath } from "../services/contentLoader";
import "./Profile.css";

type PathProgress = {
  completed: string[];
  error: boolean;
};

const preferenceLabels: Array<[string, string]> = [
  ["role", "Role"],
  ["experience_level", "Experience"],
  ["primary_interest", "Main interest"],
  ["preferred_cloud", "Preferred cloud"],
  ["preferred_content_type", "Preferred content"],
];

const formatPreference = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const values = value.map((item) => String(item).trim()).filter(Boolean);
    return values.length ? values.join(", ") : undefined;
  }
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    const label = item.label ?? item.value ?? item.name;
    return typeof label === "string" ? label : undefined;
  }
  return undefined;
};

const formatMemberDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
};

const getUserNameParts = (user: {
  firstName?: string;
  lastName?: string;
  name?: string;
}): [string, string] => {
  if (user.firstName !== undefined || user.lastName !== undefined) {
    return [user.firstName?.trim() ?? "", user.lastName?.trim() ?? ""];
  }
  const parts = user.name?.trim().split(/\s+/, 2) ?? [];
  return [parts[0] ?? "", parts[1] ?? ""];
};

const Profile: React.FC = () => {
  useTheme();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [progress, setProgress] = useState<Record<string, PathProgress>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [draftAvatarKey, setDraftAvatarKey] = useState<AvatarKey | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSaved, setAvatarSaved] = useState(false);
  const [visibleAvatarCount, setVisibleAvatarCount] = useState(
    BLOBATAR_INITIAL_AVATAR_COUNT,
  );
  const avatarDialogRef = useRef<HTMLDialogElement>(null);
  const avatarOptionsRef = useRef<HTMLDivElement>(null);
  const avatarLoadMoreRef = useRef<HTMLDivElement>(null);

  const loadProgress = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);

    try {
      let catalog: LearningPath[];
      try {
        catalog = await fetchLearningPaths();
        if (catalog.length === 0) catalog = getEmbeddedLearningPaths();
      } catch {
        catalog = getEmbeddedLearningPaths();
        if (catalog.length === 0) throw new Error("Learning paths unavailable");
      }

      const results = await Promise.all(
        catalog.map(async (path) => {
          try {
            const completed = await apiService.getLearningProgress(path.slug);
            return [path.slug, { completed, error: false }] as const;
          } catch {
            return [path.slug, { completed: [], error: true }] as const;
          }
        }),
      );

      setPaths(catalog);
      setProgress(Object.fromEntries(results));
      setLoadError(results.some(([, result]) => result.error));
    } catch {
      setLoadError(true);
      setPaths([]);
      setProgress({});
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth?returnTo=%2Fprofile", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated && user) void loadProgress();
  }, [isAuthenticated, user, loadProgress]);

  useEffect(() => {
    if (!user) return;
    const [savedFirstName, savedLastName] = getUserNameParts(user);
    setFirstName(savedFirstName);
    setLastName(savedLastName);
  }, [user]);

  useEffect(() => {
    const dialog = avatarDialogRef.current;
    if (!dialog) return;
    if (avatarPickerOpen && !dialog.open) dialog.showModal();
    if (!avatarPickerOpen && dialog.open) dialog.close();
  }, [avatarPickerOpen]);

  useEffect(() => {
    const root = avatarOptionsRef.current;
    const sentinel = avatarLoadMoreRef.current;
    if (!avatarPickerOpen || !root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleAvatarCount((count) => count + BLOBATAR_AVATAR_BATCH_SIZE);
        }
      },
      { root, rootMargin: "160px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [avatarPickerOpen, visibleAvatarCount]);

  const beginProfileEdit = () => {
    if (user) {
      const [savedFirstName, savedLastName] = getUserNameParts(user);
      setFirstName(savedFirstName);
      setLastName(savedLastName);
    }
    setProfileError("");
    setProfileSaved(false);
    setEditingProfile(true);
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      await apiService.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await refreshUser();
      setEditingProfile(false);
      setProfileSaved(true);
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Failed to update profile",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const openAvatarPicker = () => {
    if (!user) return;
    setDraftAvatarKey(isAvatarKey(user.avatarKey) ? user.avatarKey : null);
    setVisibleAvatarCount(BLOBATAR_INITIAL_AVATAR_COUNT);
    setAvatarError("");
    setAvatarSaved(false);
    setAvatarPickerOpen(true);
  };

  const avatarChoices = useMemo(
    () =>
      Array.from({ length: visibleAvatarCount }, (_, index) =>
        getBlobatarAvatarChoice(index),
      ),
    [visibleAvatarCount],
  );

  const selectedAvatarIsOutsideLoadedOptions =
    isAvatarKey(draftAvatarKey) &&
    !avatarChoices.some(({ key }) => key === draftAvatarKey);

  const saveAvatar = async () => {
    setAvatarSaving(true);
    setAvatarError("");
    try {
      await apiService.updateAvatar(draftAvatarKey);
      await refreshUser();
      setAvatarPickerOpen(false);
      setAvatarSaved(true);
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : "Failed to update avatar",
      );
    } finally {
      setAvatarSaving(false);
    }
  };

  const pathSummaries = useMemo(
    () =>
      paths.map((path) => {
        const total = path.modules.reduce(
          (count, module) => count + (module.lessons?.length ?? 0),
          0,
        );
        const lessonIds = new Set(
          path.modules.flatMap((module) =>
            (module.lessons ?? []).map((lesson) => lesson.id),
          ),
        );
        const saved = progress[path.slug]?.completed ?? [];
        const completed = saved.filter((id) => lessonIds.has(id)).length;
        return {
          ...path,
          completed,
          total,
          percent:
            total > 0
              ? Math.min(100, Math.round((completed / total) * 100))
              : 0,
        };
      }),
    [paths, progress],
  );

  const activePathSummaries = useMemo(
    () => pathSummaries.filter((path) => path.completed > 0),
    [pathSummaries],
  );

  const completedLessonCount = pathSummaries.reduce(
    (count, path) => count + path.completed,
    0,
  );
  const startedPathCount = pathSummaries.filter(
    (path) => path.completed > 0,
  ).length;
  const preferences = user?.preferences ?? {};
  const visiblePreferences = preferenceLabels
    .map(([key, label]) => ({
      label,
      value: formatPreference(preferences[key]),
    }))
    .filter((item): item is { label: string; value: string } =>
      Boolean(item.value),
    );

  if (isLoading || !isAuthenticated || !user) {
    return (
      <main className="profile-page" aria-busy="true" aria-live="polite">
        <p className="profile-loading">Loading your profile…</p>
      </main>
    );
  }

  const memberSince = formatMemberDate(user.createdAt);

  return (
    <>
      <SEO
        title="Your profile | Diagramwise"
        description="Review your learning progress and update your Diagramwise preferences."
        url="https://diagramwise.com/profile"
        noIndex
      />
      <div className="profile-page min-h-screen bg-[var(--bg)] text-theme">
        <ProductHeader
          actions={
            <>
              <Link to="/diagrams" className="profile-header-link">
                My designs
              </Link>
              <ThemeSwitcher />
            </>
          }
        />

        <main className="profile-content">
          <header className="profile-heading">
            <div className="profile-avatar-control">
              <div className="profile-avatar" aria-hidden="true">
                <UserAvatar
                  userId={user.id}
                  picture={user.picture}
                  avatarKey={user.avatarKey}
                  size={72}
                  className="profile-avatar-image"
                />
              </div>
              <button
                className="profile-avatar-edit"
                type="button"
                onClick={openAvatarPicker}
                aria-label="Change profile avatar"
                title="Change avatar"
              >
                <HiPencil aria-hidden="true" />
              </button>
            </div>
            <div>
              <h1>Your profile</h1>
              <p>
                Keep track of what you’re learning and shape what comes next.
              </p>
            </div>
          </header>

          <div className="profile-layout">
            <div className="profile-primary">
              <section
                className="profile-section"
                aria-labelledby="progress-title"
              >
                <div className="profile-section-heading">
                  <div>
                    <h2 id="progress-title">Learning progress</h2>
                    <p>
                      {completedLessonCount} lesson
                      {completedLessonCount === 1 ? "" : "s"} completed
                      {startedPathCount > 0
                        ? ` across ${startedPathCount} learning path${startedPathCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                  <Link to="/learning-paths/" className="profile-text-link">
                    Explore paths <HiArrowUpRight aria-hidden="true" />
                  </Link>
                </div>

                {loading ? (
                  <div
                    className="profile-progress-skeleton"
                    aria-label="Loading your learning progress"
                    aria-busy="true"
                  >
                    {Array.from({ length: 3 }, (_, index) => (
                      <div
                        className="profile-progress-skeleton-row"
                        key={index}
                      >
                        <span />
                        <span />
                      </div>
                    ))}
                  </div>
                ) : pathSummaries.length === 0 ? (
                  <div className="profile-empty">
                    <p>
                      {loadError
                        ? "Learning progress is unavailable right now."
                        : "Learning paths will appear here when they’re available."}
                    </p>
                    {loadError && (
                      <button
                        className="profile-secondary-button"
                        type="button"
                        onClick={() => void loadProgress()}
                      >
                        Try again
                      </button>
                    )}
                  </div>
                ) : activePathSummaries.length === 0 ? (
                  <div className="profile-empty profile-progress-empty">
                    <p>
                      {loadError
                        ? "Your progress couldn’t be loaded just now."
                        : "Complete your first lesson and your learning progress will appear here."}
                    </p>
                    {loadError ? (
                      <button
                        className="profile-secondary-button"
                        type="button"
                        onClick={() => void loadProgress()}
                      >
                        Try again
                      </button>
                    ) : (
                      <Link
                        className="profile-secondary-button"
                        to="/learning-paths/"
                      >
                        Browse learning paths
                        <HiArrowUpRight aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="profile-path-list">
                    {activePathSummaries.map((path) => {
                      const pathError = progress[path.slug]?.error;
                      const isComplete =
                        path.total > 0 && path.completed >= path.total;
                      return (
                        <Link
                          className="profile-path-row"
                          key={path.slug}
                          to={`/learning-paths/${path.slug}`}
                        >
                          <span className="profile-path-copy">
                            <strong>{path.title}</strong>
                            <span>
                              {pathError
                                ? "Progress couldn’t be loaded"
                                : isComplete
                                  ? "Path complete"
                                  : path.completed > 0
                                    ? `${path.completed} of ${path.total} lessons complete`
                                    : "Not started yet"}
                            </span>
                          </span>
                          <span className="profile-path-progress">
                            <span
                              className="profile-progress-track"
                              role="progressbar"
                              aria-label={`${path.title} progress`}
                              aria-valuemin={0}
                              aria-valuemax={Math.max(1, path.total)}
                              aria-valuenow={Math.min(
                                path.completed,
                                Math.max(1, path.total),
                              )}
                            >
                              <span style={{ width: `${path.percent}%` }} />
                            </span>
                            <span className="profile-path-count">
                              {pathError ? "—" : `${path.percent}%`}
                            </span>
                          </span>
                          {isComplete && (
                            <MdCheckCircle
                              className="profile-complete-icon"
                              aria-hidden="true"
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
                {!loading && pathSummaries.length > 0 && loadError && (
                  <p className="profile-inline-note" role="status">
                    Some progress could not be loaded. You can still open each
                    path and continue learning.
                  </p>
                )}
              </section>

              <section
                className="profile-section"
                aria-labelledby="preferences-title"
              >
                <div className="profile-section-heading">
                  <div>
                    <h2 id="preferences-title">Learning preferences</h2>
                    <p>Used to tailor problem and learning recommendations.</p>
                  </div>
                  <button
                    type="button"
                    className="profile-text-link"
                    onClick={() =>
                      globalThis.dispatchEvent(new Event("open-quick-setup"))
                    }
                  >
                    Edit preferences
                  </button>
                </div>

                {visiblePreferences.length ? (
                  <dl className="profile-preference-list">
                    {visiblePreferences.map(({ label, value }) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="profile-empty">
                    <p>You haven’t added learning preferences yet.</p>
                    <button
                      className="profile-secondary-button"
                      type="button"
                      onClick={() =>
                        globalThis.dispatchEvent(new Event("open-quick-setup"))
                      }
                    >
                      Add preferences
                    </button>
                  </div>
                )}
              </section>
            </div>

            <aside className="profile-aside">
              <section
                className="profile-section"
                aria-labelledby="account-title"
              >
                <h2 id="account-title">Account details</h2>
                <dl className="profile-account-list">
                  <div>
                    <dt>Name</dt>
                    <dd>
                      {editingProfile ? (
                        <form
                          className="profile-name-form"
                          onSubmit={saveProfile}
                        >
                          <label>
                            <span>First name</span>
                            <input
                              autoComplete="given-name"
                              maxLength={80}
                              required
                              value={firstName}
                              onChange={(event) =>
                                setFirstName(event.target.value)
                              }
                              disabled={profileSaving}
                            />
                          </label>
                          <label>
                            <span>Last name</span>
                            <input
                              autoComplete="family-name"
                              maxLength={80}
                              value={lastName}
                              onChange={(event) =>
                                setLastName(event.target.value)
                              }
                              disabled={profileSaving}
                            />
                          </label>
                          {profileError && (
                            <p
                              className="profile-form-message profile-form-error"
                              role="alert"
                            >
                              {profileError}
                            </p>
                          )}
                          <div className="profile-form-actions">
                            <button
                              className="profile-secondary-button"
                              type="button"
                              onClick={() => {
                                setEditingProfile(false);
                                setProfileError("");
                              }}
                              disabled={profileSaving}
                            >
                              Cancel
                            </button>
                            <button
                              className="profile-primary-button"
                              type="submit"
                              disabled={profileSaving || !firstName.trim()}
                            >
                              {profileSaving ? "Saving…" : "Save name"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <span className="profile-name-display">
                          <span>
                            {[firstName, lastName].filter(Boolean).join(" ") ||
                              "Not set"}
                          </span>
                          <button
                            type="button"
                            className="profile-edit-icon-button"
                            onClick={beginProfileEdit}
                            aria-label="Edit name"
                            title="Edit name"
                          >
                            <HiPencil aria-hidden="true" />
                          </button>
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{user.email}</dd>
                  </div>
                  {memberSince && (
                    <div>
                      <dt>Member since</dt>
                      <dd>{memberSince}</dd>
                    </div>
                  )}
                </dl>
                {!editingProfile && profileSaved && (
                  <p className="profile-form-message" role="status">
                    Your name has been updated.
                  </p>
                )}
              </section>

              <section
                className="profile-account-action"
                aria-labelledby="account-action-title"
              >
                <h2 id="account-action-title">Account access</h2>
                <p>Sign out of Diagramwise on this device.</p>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Sign out
                </button>
              </section>
            </aside>
          </div>
        </main>

        {!avatarPickerOpen && avatarSaved && (
          <p className="profile-avatar-status" role="status">
            Avatar updated.
          </p>
        )}

        {avatarPickerOpen && (
          <dialog
            ref={avatarDialogRef}
            className="profile-avatar-dialog"
            aria-labelledby="profile-avatar-dialog-title"
            onCancel={(event) => {
              event.preventDefault();
              setAvatarPickerOpen(false);
            }}
          >
            <div className="profile-avatar-dialog-heading">
              <div>
                <h2 id="profile-avatar-dialog-title">Choose your avatar</h2>
                <p>Choose a profile photo or pick a Blobatar.</p>
              </div>
              <button
                className="profile-avatar-dialog-close"
                type="button"
                onClick={() => setAvatarPickerOpen(false)}
                aria-label="Close avatar picker"
              >
                ×
              </button>
            </div>

            <div className="profile-avatar-options" ref={avatarOptionsRef}>
              {user.picture ? (
                <button
                  type="button"
                  className={`profile-avatar-option${draftAvatarKey === null ? " is-selected" : ""}`}
                  aria-pressed={draftAvatarKey === null}
                  aria-label="Use Google photo"
                  onClick={() => setDraftAvatarKey(null)}
                >
                  <UserAvatar
                    userId={user.id}
                    picture={user.picture}
                    size={72}
                    className="profile-avatar-option-image"
                    alt=""
                  />
                  {draftAvatarKey === null && (
                    <MdCheckCircle aria-hidden="true" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className={`profile-avatar-option${draftAvatarKey === null ? " is-selected" : ""}`}
                  aria-pressed={draftAvatarKey === null}
                  aria-label="Use default Blobatar"
                  onClick={() => setDraftAvatarKey(null)}
                >
                  <UserAvatar
                    userId={user.id}
                    size={72}
                    className="profile-avatar-option-image"
                    alt=""
                  />
                  {draftAvatarKey === null && (
                    <MdCheckCircle aria-hidden="true" />
                  )}
                </button>
              )}
              {selectedAvatarIsOutsideLoadedOptions && draftAvatarKey && (
                <div
                  className="profile-avatar-option is-selected"
                  role="img"
                  aria-label="Currently selected Blobatar"
                >
                  <UserAvatar
                    userId={user.id}
                    avatarKey={draftAvatarKey}
                    size={72}
                    className="profile-avatar-option-image"
                    alt=""
                  />
                  <MdCheckCircle aria-hidden="true" />
                </div>
              )}
              {avatarChoices.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`profile-avatar-option${draftAvatarKey === key ? " is-selected" : ""}`}
                  aria-pressed={draftAvatarKey === key}
                  aria-label={`Select ${label}`}
                  onClick={() => setDraftAvatarKey(key)}
                >
                  <UserAvatar
                    userId={user.id}
                    avatarKey={key}
                    size={72}
                    className="profile-avatar-option-image"
                    alt=""
                  />
                  {draftAvatarKey === key && (
                    <MdCheckCircle aria-hidden="true" />
                  )}
                </button>
              ))}
              <div
                ref={avatarLoadMoreRef}
                className="profile-avatar-load-more"
                aria-hidden="true"
              />
            </div>

            {avatarError && (
              <p
                className="profile-form-message profile-form-error"
                role="alert"
              >
                {avatarError}
              </p>
            )}
            <div className="profile-avatar-dialog-actions">
              <button
                className="profile-secondary-button"
                type="button"
                onClick={() => setAvatarPickerOpen(false)}
                disabled={avatarSaving}
              >
                Cancel
              </button>
              <button
                className="profile-primary-button"
                type="button"
                onClick={() => void saveAvatar()}
                disabled={avatarSaving}
              >
                {avatarSaving ? "Saving…" : "Save avatar"}
              </button>
            </div>
          </dialog>
        )}
      </div>
    </>
  );
};

export default Profile;
