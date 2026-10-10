import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import DOMPurify from "dompurify";
import { HiChevronDown } from "react-icons/hi2";
import {
  MdAdminPanelSettings,
  MdCheckCircle,
  MdChevronLeft,
  MdChevronRight,
  MdFeedback,
  MdInsights,
  MdRefresh,
  MdTrendingUp,
} from "react-icons/md";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { apiService } from "../services/api";
import ProductHeader from "../components/ProductHeader";
import ThemeSwitcher from "../components/ThemeSwitcher";
import SelectDropdown from "../components/shared/SelectDropdown";
import type {
  AdminAccessUser,
  AdminFeedbackItem,
  AdminGoogleAnalyticsReport,
  AdminOverview,
} from "../types/admin";
import "./SuperAdminDashboard.css";

const STATUS_OPTIONS = ["new", "reviewing", "resolved"] as const;
const STATUS_LABELS = STATUS_OPTIONS.map(
  (status) => status[0].toUpperCase() + status.slice(1),
);
const DATE_RANGE_OPTIONS = ["Last 7 days", "Last 30 days", "Last 90 days"];
const SAFE_FEEDBACK_HTML = {
  ALLOWED_TAGS: [
    "a",
    "blockquote",
    "br",
    "em",
    "i",
    "li",
    "ol",
    "p",
    "strong",
    "u",
    "ul",
  ],
  ALLOWED_ATTR: ["href", "title"],
};
type FeedbackStatus = (typeof STATUS_OPTIONS)[number];

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN").format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const formatFeedbackCategory = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const getFeedbackInitials = (value: string) =>
  value
    .trim()
    .split(/[\s@._+-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "A";

const AdminProductHeader = () => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accountName = user?.name?.trim() || user?.email || "Account";

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnOutsideFocus = (event: FocusEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("focusin", closeOnOutsideFocus);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("focusin", closeOnOutsideFocus);
    };
  }, [menuOpen]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.picture]);

  return (
    <ProductHeader
      actions={
        <>
          <ThemeSwitcher />
          <div className="admin-account-control" ref={menuRef}>
            <button
              ref={triggerRef}
              className="dashboard-account-button"
              type="button"
              aria-label={`Open account menu for ${accountName}`}
              aria-expanded={menuOpen}
              aria-controls="admin-account-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {user?.picture && !avatarFailed ? (
                <img
                  className="dashboard-avatar dashboard-avatar-image"
                  src={user.picture}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span className="dashboard-avatar" aria-hidden="true">
                  {getFeedbackInitials(accountName)}
                </span>
              )}
              <span className="admin-account-control__name">{accountName}</span>
              <HiChevronDown
                className={`admin-account-control__chevron${menuOpen ? " admin-account-control__chevron--open" : ""}`}
                aria-hidden="true"
              />
            </button>
            <div
              className="dashboard-user-menu"
              id="admin-account-menu"
              role="group"
              aria-label="Account menu"
              hidden={!menuOpen}
            >
              <div className="admin-account-menu__identity">
                <strong>{accountName}</strong>
                {user?.email && <span>{user.email}</span>}
              </div>
              <button
                className="dashboard-user-menu-item admin-account-menu__logout"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      }
    />
  );
};

const LoadingOverview = () => (
  <div className="admin-theme-root">
    <AdminProductHeader />
    <main className="admin-page" aria-busy="true">
      <div className="admin-shell">
        <div className="admin-skeleton admin-skeleton--title" />
        <div className="admin-skeleton admin-skeleton--toolbar" />
        <div className="admin-stat-strip">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="admin-stat admin-skeleton-block" key={index} />
          ))}
        </div>
        <div className="admin-overview-grid">
          <div className="admin-panel admin-skeleton-block admin-skeleton-block--large" />
          <div className="admin-panel admin-skeleton-block admin-skeleton-block--large" />
        </div>
      </div>
    </main>
  </div>
);

const FeedbackRow = ({
  item,
  onStatusChange,
}: {
  item: AdminFeedbackItem;
  onStatusChange: (item: AdminFeedbackItem, status: FeedbackStatus) => void;
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const authorEmail = item.authorEmail || item.contactEmail;
  const authorName =
    item.authorName?.trim() ||
    (item.authorEmail
      ? "Diagramwise user"
      : item.contactEmail
        ? "Feedback visitor"
        : "Anonymous visitor");
  const avatarInitials = getFeedbackInitials(
    item.authorName || authorEmail || authorName,
  );

  return (
    <article className="admin-feedback-row">
      <div className="admin-feedback-row__main">
        <div className="admin-feedback-row__author">
          <div className="admin-feedback-row__avatar" aria-hidden="true">
            <span>{avatarInitials}</span>
            {item.authorPicture && !avatarFailed && (
              <img
                src={item.authorPicture}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            )}
          </div>
          <div className="admin-feedback-row__identity">
            <strong>{authorName}</strong>
            {authorEmail && <span>{authorEmail}</span>}
          </div>
        </div>
        <div className="admin-feedback-row__meta">
          <span className={`admin-status admin-status--${item.status}`}>
            {item.status}
          </span>
          <span>{formatFeedbackCategory(item.category)}</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <div
          className="admin-feedback-row__message"
          dangerouslySetInnerHTML={{
            __html: item.message
              ? DOMPurify.sanitize(item.message, SAFE_FEEDBACK_HTML)
              : "Rating-only feedback",
          }}
        />
        <div className="admin-feedback-row__context">
          {item.route && <span>{item.route}</span>}
          {item.rating != null && <span>{"★".repeat(item.rating)}</span>}
          {item.helpful != null && (
            <span>{item.helpful ? "Helpful" : "Not helpful"}</span>
          )}
          {item.contactEmail && <span>{item.contactEmail}</span>}
        </div>
      </div>
      <SelectDropdown
        id={`admin-feedback-status-${item.id}`}
        value={
          STATUS_LABELS[
            STATUS_OPTIONS.indexOf(item.status as FeedbackStatus)
          ] ?? STATUS_LABELS[0]
        }
        options={STATUS_LABELS}
        onChange={(label) =>
          onStatusChange(item, label.toLowerCase() as FeedbackStatus)
        }
        aria-label={`Update status for feedback from ${formatDate(item.createdAt)}`}
        className="admin-status-select"
      />
    </article>
  );
};

const SuperAdminDashboard = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [googleAnalytics, setGoogleAnalytics] =
    useState<AdminGoogleAnalyticsReport | null>(null);
  const [googleAnalyticsLoading, setGoogleAnalyticsLoading] = useState(true);
  const [access, setAccess] = useState<AdminAccessUser[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSaving, setAccessSaving] = useState(false);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollToOlderActivity, setCanScrollToOlderActivity] =
    useState(false);
  const [canScrollToNewestActivity, setCanScrollToNewestActivity] =
    useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResponse, accessResponse] = await Promise.all([
        apiService.getAdminOverview(days),
        apiService.getAdminAccess(),
      ]);
      setOverview(overviewResponse);
      setAccess(accessResponse);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the private console.",
      );
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadGoogleAnalytics = useCallback(async () => {
    setGoogleAnalyticsLoading(true);
    try {
      setGoogleAnalytics(await apiService.getAdminGoogleAnalytics(days));
    } catch {
      setGoogleAnalytics({
        status: "error",
        channelGroups: [],
        message: "Unable to load Google Analytics. Try again shortly.",
      });
    } finally {
      setGoogleAnalyticsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.isSuperAdmin) {
      void loadDashboard();
    }
  }, [authLoading, isAuthenticated, user?.isSuperAdmin, loadDashboard]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.isSuperAdmin) {
      void loadGoogleAnalytics();
    }
  }, [authLoading, isAuthenticated, user?.isSuperAdmin, loadGoogleAnalytics]);

  const dailyActivity = useMemo(
    () =>
      [...(overview?.analytics.daily ?? [])].sort((first, second) =>
        first.date.localeCompare(second.date),
      ),
    [overview?.analytics.daily],
  );
  const maximumDailyEvents = useMemo(
    () => Math.max(...dailyActivity.map((day) => day.events), 1),
    [dailyActivity],
  );
  const chartLabelInterval = Math.max(1, Math.ceil(dailyActivity.length / 6));

  const syncChartNavigation = useCallback(() => {
    const chart = chartScrollRef.current;
    if (!chart) return;

    const maxScrollLeft = chart.scrollWidth - chart.clientWidth;
    setCanScrollToOlderActivity(chart.scrollLeft > 1);
    setCanScrollToNewestActivity(chart.scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    const chart = chartScrollRef.current;
    if (!chart) return;

    chart.scrollLeft = chart.scrollWidth;
    syncChartNavigation();

    const resizeObserver = new ResizeObserver(syncChartNavigation);
    resizeObserver.observe(chart);
    return () => resizeObserver.disconnect();
  }, [days, dailyActivity, syncChartNavigation]);

  const scrollActivity = (direction: "older" | "newest") => {
    const chart = chartScrollRef.current;
    if (!chart) return;

    chart.scrollBy({
      left:
        (direction === "older" ? -1 : 1) *
        Math.max(chart.clientWidth * 0.8, 240),
      behavior: "smooth",
    });
  };

  if (authLoading) return null;
  if (!isAuthenticated || !user?.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }
  if (loading && !overview) return <LoadingOverview />;

  const handleStatusChange = async (
    item: AdminFeedbackItem,
    status: FeedbackStatus,
  ) => {
    try {
      const updated = await apiService.updateAdminFeedbackStatus(
        item.id,
        status,
      );
      setOverview((current) =>
        current
          ? {
              ...current,
              recentFeedback: current.recentFeedback.map((feedback) =>
                feedback.id === updated.id ? updated : feedback,
              ),
              feedback: {
                ...current.feedback,
                new:
                  current.feedback.new -
                  (item.status === "new" ? 1 : 0) +
                  (status === "new" ? 1 : 0),
              },
            }
          : current,
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to update feedback.",
      );
    }
  };

  const handleGrantAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setAccessSaving(true);
    setAccessError(null);
    try {
      const granted = await apiService.grantAdminAccess(email.trim());
      setAccess((current) => [
        ...current.filter((item) => item.id !== granted.id),
        granted,
      ]);
      setEmail("");
    } catch (grantError) {
      setAccessError(
        grantError instanceof Error
          ? grantError.message
          : "Unable to grant access.",
      );
    } finally {
      setAccessSaving(false);
    }
  };

  const handleRevokeAccess = async (admin: AdminAccessUser) => {
    if (!window.confirm(`Remove admin access for ${admin.email}?`)) return;
    try {
      await apiService.revokeAdminAccess(admin.id);
      setAccess((current) => current.filter((item) => item.id !== admin.id));
    } catch (revokeError) {
      setAccessError(
        revokeError instanceof Error
          ? revokeError.message
          : "Unable to revoke access.",
      );
    }
  };

  return (
    <div className="admin-theme-root">
      <AdminProductHeader />
      <main className="admin-page">
        <div className="admin-shell">
          <header className="admin-header">
            <div>
              <h1>Product health</h1>
              <p className="admin-header__description">
                Usage, feedback, and access controls for Diagramwise.
              </p>
            </div>
            <div className="admin-header__actions">
              <SelectDropdown
                id="admin-analytics-range"
                value={`Last ${days} days`}
                options={DATE_RANGE_OPTIONS}
                onChange={(range) =>
                  setDays(Number(range.match(/\d+/)?.[0] ?? 30))
                }
                aria-label="Analytics date range"
                className="admin-range-select"
              />
              <button
                className="admin-icon-button"
                type="button"
                onClick={() => {
                  void loadDashboard();
                  void loadGoogleAnalytics();
                }}
                aria-label="Refresh dashboard"
              >
                <MdRefresh aria-hidden="true" />
              </button>
            </div>
          </header>

          {error && (
            <div className="admin-alert" role="alert">
              {error}
            </div>
          )}

          {overview && (
            <>
              <section
                className="admin-stat-strip"
                aria-label="Product health summary"
              >
                <div className="admin-stat">
                  <span>Tracked events</span>
                  <strong>
                    {formatNumber(overview.analytics.totalEvents)}
                  </strong>
                  <small>
                    {overview.fromDate} – {overview.toDate}
                  </small>
                </div>
                <div className="admin-stat">
                  <span>Page views</span>
                  <strong>{formatNumber(overview.analytics.pageViews)}</strong>
                  <small>First-party analytics</small>
                </div>
                <div className="admin-stat">
                  <span>Feedback received</span>
                  <strong>{formatNumber(overview.feedback.total)}</strong>
                  <small>{overview.feedback.new} need review</small>
                </div>
                <div className="admin-stat">
                  <span>Average rating</span>
                  <strong>
                    {overview.feedback.averageRating?.toFixed(1) ?? "—"}
                    <small className="admin-stat__suffix"> / 5</small>
                  </strong>
                  <small>From submitted ratings</small>
                </div>
                <div className="admin-stat">
                  <span>Helpful rate</span>
                  <strong>
                    {overview.feedback.helpfulRate != null
                      ? `${Math.round(overview.feedback.helpfulRate * 100)}%`
                      : "—"}
                  </strong>
                  <small>Assessment and global feedback</small>
                </div>
              </section>

              <div className="admin-overview-grid">
                <section
                  className="admin-panel admin-panel--chart"
                  aria-labelledby="usage-title"
                >
                  <div className="admin-panel__header">
                    <div>
                      <h2 id="usage-title">Product activity</h2>
                      <p className="admin-panel__description">
                        First-party events captured across the product.
                      </p>
                    </div>
                    <MdInsights
                      className="admin-panel__icon"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="admin-chart-carousel">
                    <div
                      ref={chartScrollRef}
                      className="admin-chart-scroll"
                      aria-label="Daily product activity chart. Scroll horizontally to explore older dates."
                      onScroll={syncChartNavigation}
                    >
                      {dailyActivity.length ? (
                        <div
                          className="admin-chart"
                          id="admin-activity-chart"
                          role="img"
                          aria-label={`Daily tracked events over the last ${days} days`}
                          style={{
                            gridTemplateColumns: `repeat(${dailyActivity.length}, minmax(0, 1fr))`,
                            minWidth: `${dailyActivity.length * 12}px`,
                          }}
                        >
                          {dailyActivity.map((day, index) => {
                            const dateLabel = new Date(
                              `${day.date}T00:00:00`,
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            });
                            const showDate =
                              index % chartLabelInterval === 0 ||
                              index === dailyActivity.length - 1;
                            return (
                              <div
                                className="admin-chart__column"
                                key={day.date}
                              >
                                <div className="admin-chart__bar-wrap">
                                  <div
                                    className="admin-chart__bar"
                                    style={{
                                      height: `${Math.max((day.events / maximumDailyEvents) * 100, day.events ? 7 : 2)}%`,
                                    }}
                                    title={`${day.events} events on ${day.date}`}
                                  />
                                </div>
                                <span aria-hidden="true">
                                  {showDate ? dateLabel : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="admin-empty">
                          No events were recorded in this period.
                        </p>
                      )}
                    </div>
                    {canScrollToOlderActivity && (
                      <button
                        className="admin-chart-nav admin-chart-nav--older"
                        type="button"
                        aria-label="Show older product activity"
                        aria-controls="admin-activity-chart"
                        onClick={() => scrollActivity("older")}
                      >
                        <MdChevronLeft aria-hidden="true" />
                      </button>
                    )}
                    {canScrollToNewestActivity && (
                      <button
                        className="admin-chart-nav admin-chart-nav--newest"
                        type="button"
                        aria-label="Return to newest product activity"
                        aria-controls="admin-activity-chart"
                        onClick={() => scrollActivity("newest")}
                      >
                        <MdChevronRight aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="admin-list-split">
                    <div>
                      <h3>Top events</h3>
                      {overview.analytics.topEvents.slice(0, 5).map((event) => (
                        <div className="admin-ranking" key={event.name}>
                          <span>{event.name}</span>
                          <strong>{formatNumber(event.count)}</strong>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h3>Top routes</h3>
                      {overview.analytics.topRoutes.slice(0, 5).map((route) => (
                        <div className="admin-ranking" key={route.route}>
                          <span>{route.route}</span>
                          <strong>{formatNumber(route.count)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section
                  className="admin-panel admin-panel--acquisition"
                  aria-labelledby="acquisition-title"
                >
                  <div className="admin-panel__header">
                    <div>
                      <h2 id="acquisition-title">Google Analytics</h2>
                      <p className="admin-panel__description">
                        Sessions, visitors, page views, and acquisition
                        channels.
                      </p>
                    </div>
                    <div className="admin-panel__header-actions">
                      {googleAnalytics?.status === "connected" && (
                        <span className="admin-panel__count">Connected</span>
                      )}
                      <MdTrendingUp
                        className="admin-panel__icon"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  {googleAnalyticsLoading ? (
                    <div
                      className="admin-ga-loading"
                      role="status"
                      aria-label="Loading Google Analytics report"
                    >
                      <span />
                      <span />
                    </div>
                  ) : googleAnalytics?.status === "connected" ? (
                    <div className="admin-ga-content">
                      <dl className="admin-ga-metrics">
                        <div>
                          <dt>Active users</dt>
                          <dd>
                            {formatNumber(googleAnalytics.activeUsers ?? 0)}
                          </dd>
                        </div>
                        <div>
                          <dt>New users</dt>
                          <dd>{formatNumber(googleAnalytics.newUsers ?? 0)}</dd>
                        </div>
                        <div>
                          <dt>Sessions</dt>
                          <dd>{formatNumber(googleAnalytics.sessions ?? 0)}</dd>
                        </div>
                        <div>
                          <dt>Page views</dt>
                          <dd>
                            {formatNumber(googleAnalytics.screenPageViews ?? 0)}
                          </dd>
                        </div>
                      </dl>
                      <div className="admin-ga-channels">
                        <h3>Sessions by channel</h3>
                        {googleAnalytics.channelGroups.length ? (
                          googleAnalytics.channelGroups.map((channel) => (
                            <div className="admin-ranking" key={channel.name}>
                              <span>{channel.name}</span>
                              <strong>{formatNumber(channel.sessions)}</strong>
                            </div>
                          ))
                        ) : (
                          <p className="admin-empty">
                            No channel data in this period.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="admin-connection-state">
                      <span
                        className={`admin-connection-state__badge${googleAnalytics?.status === "error" ? " admin-connection-state__badge--error" : ""}`}
                      >
                        {googleAnalytics?.status === "error"
                          ? "Connection issue"
                          : "Not connected"}
                      </span>
                      <div>
                        <strong>
                          {googleAnalytics?.status === "error"
                            ? "Google Analytics is unavailable"
                            : "Connect a GA4 property"}
                        </strong>
                        <p>
                          {googleAnalytics?.message ??
                            "Configure a GA4 property and credentials on the API server."}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="admin-source-note">
                    <MdCheckCircle aria-hidden="true" /> GA4 is queried
                    read-only for the selected date range. Product events above
                    come from Diagramwise’s first-party pipeline.
                  </div>
                </section>
              </div>

              <section className="admin-panel" aria-labelledby="feedback-title">
                <div className="admin-panel__header">
                  <div>
                    <h2 id="feedback-title">Recent feedback</h2>
                    <p className="admin-panel__description">
                      Review what people shared and update its status.
                    </p>
                  </div>
                  <div className="admin-panel__header-actions">
                    <span className="admin-panel__count">
                      {overview.feedback.new} new
                    </span>
                    <MdFeedback
                      className="admin-panel__icon"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <div className="admin-feedback-list">
                  {overview.recentFeedback.length ? (
                    overview.recentFeedback.map((item) => (
                      <FeedbackRow
                        item={item}
                        onStatusChange={handleStatusChange}
                        key={item.id}
                      />
                    ))
                  ) : (
                    <p className="admin-empty">
                      No feedback has arrived in this period.
                    </p>
                  )}
                </div>
              </section>

              <section
                className="admin-panel admin-access-panel"
                aria-labelledby="access-title"
              >
                <div className="admin-panel__header">
                  <div>
                    <h2 id="access-title">Admin access</h2>
                    <p className="admin-panel__description">
                      Choose who can open this private console.
                    </p>
                  </div>
                  <MdAdminPanelSettings
                    className="admin-panel__icon"
                    aria-hidden="true"
                  />
                </div>
                <p className="admin-access-panel__description">
                  Admin access is stored with each user account. Add a verified
                  Diagramwise account when you want someone else to help review
                  product health.
                </p>
                <form className="admin-grant-form" onSubmit={handleGrantAccess}>
                  <label htmlFor="admin-email">Grant super-admin access</label>
                  <div>
                    <input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="person@example.com"
                      required
                    />
                    <button type="submit" disabled={accessSaving}>
                      {accessSaving ? "Granting…" : "Grant access"}
                    </button>
                  </div>
                </form>
                {accessError && (
                  <p className="admin-inline-error" role="alert">
                    {accessError}
                  </p>
                )}
                <div className="admin-access-list">
                  {access.map((admin) => (
                    <div className="admin-access-row" key={admin.id}>
                      <div>
                        <strong>{admin.name || admin.email}</strong>
                        {admin.name && <span>{admin.email}</span>}
                      </div>
                      <div className="admin-access-row__actions">
                        <span>Super-admin</span>
                        {admin.id !== user?.id && (
                          <button
                            type="button"
                            onClick={() => void handleRevokeAccess(admin)}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
