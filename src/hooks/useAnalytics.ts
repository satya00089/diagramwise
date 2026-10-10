import { useRef, useEffect, useCallback } from "react";
import { getApiBaseUrl } from "../services/api";

declare global {
  interface Window {
    __analytics_page_enter_ts?: number;
  }
}

export const getAnalyticsBatchUrl = (apiUrl?: string, legacyApiUrl?: string) =>
  `${getApiBaseUrl(apiUrl, legacyApiUrl).replace(/\/$/, "")}/api/v1/analytics/batch`;
const ANALYTICS_BATCH_URL = getAnalyticsBatchUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.VITE_ASSESSMENT_API_URL,
);

export interface AnalyticsEvent {
  ts: number;
  event_name: string;
  page_url?: string;
  route?: string;
  page_title?: string;
  event_props?: Record<string, unknown>;
  time_on_page_ms?: number;
}

export type ProductEventName =
  | "page_view"
  | "time_on_page"
  | "homepage_cta_clicked"
  | "challenge_started"
  | "first_component_added"
  | "first_connection_added"
  | "reasoning_submitted"
  | "assessment_completed"
  | "assessment_retry_started"
  | "assessment_finding_toggled"
  | "account_signup_submitted"
  | "account_signup_completed"
  | "public_share_completed"
  | "feedback_opened"
  | "feedback_submitted"
  | "feedback_failed";

interface AnalyticsBatch {
  user_id?: string;
  anon_id?: string;
  session_id: string;
  events: AnalyticsEvent[];
}

interface UseAnalyticsOptions {
  isEnabled?: boolean;
  trackTimeOnUnmount?: boolean;
}

// Cookie-less analytics: do not depend on consent cookie or persistent ids.
// This hook sends minimal, non-identifying events suitable for aggregated
// collection (no cookies, no localStorage/IDs are used).

export function useAnalytics({
  isEnabled = true,
  trackTimeOnUnmount = true,
}: UseAnalyticsOptions) {
  const bufferRef = useRef<AnalyticsEvent[]>([]);
  // Use an ephemeral per-tab session id (not persisted to storage)
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // No persistent anonymous id — keep analytics cookie-less and non-identifying

  const flush = useCallback(() => {
    if (!isEnabled) return;
    if (bufferRef.current.length === 0) return;

    const events = bufferRef.current.splice(0);
    const payload: AnalyticsBatch = {
      // Do not send user-identifying ids in aggregated mode
      session_id: sessionIdRef.current,
      events,
    };

    // Fire-and-forget
    fetch(ANALYTICS_BATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // swallow — non-blocking telemetry
    });
  }, [isEnabled]);

  // Periodic flush and flush on unload/visibilitychange
  useEffect(() => {
    if (!isEnabled) return;
    const interval = setInterval(flush, 10_000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = () => flush();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
    };
  }, [flush, isEnabled]);

  // Automatic click delegation for elements with data-analytics
  useEffect(() => {
    if (!isEnabled) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el =
        target.closest &&
        (target.closest("[data-analytics]") as HTMLElement | null);
      if (!el) return;
      const attr = el.getAttribute("data-analytics");
      if (!attr) return;
      // Attribute format: "event:cta_signup" or "cta:signup"
      const parts = attr.split(":");
      const name = parts.length > 1 ? parts[1] : parts[0];
      trackEvent(
        (name || "homepage_cta_clicked") as ProductEventName,
        { label: el.innerText?.slice(0, 200) },
        true,
      );
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  const trackEvent = useCallback<(event_name: ProductEventName, event_props?: Record<string, unknown>, immediate?: boolean) => void>(
    (
      event_name: ProductEventName,
      event_props?: Record<string, unknown>,

    ) => {
      if (!isEnabled) return;
      const evt: AnalyticsEvent = {
        ts: Date.now(),
        event_name,
        page_url: window.location.href,
        route: window.location.pathname,
        page_title: document.title,
        event_props,
      };

      bufferRef.current.push(evt);
    },
    [isEnabled],
  );

  const trackPageView = useCallback(
    (props?: Record<string, unknown>) => {
      // page view is immediate
      trackEvent("page_view", props, true);
    },
    [trackEvent],
  );

  // Time on page helper - call when leaving
  const trackTimeOnPage = useCallback(() => {
    if (!isEnabled) return;
    const start = window.__analytics_page_enter_ts || Date.now();
    const duration = Date.now() - start;
    trackEvent("time_on_page", { time_on_page_ms: duration }, true);
  }, [isEnabled, trackEvent]);

  // Mark page enter ts for time on page; update on route changes if callers call trackPageView
  useEffect(() => {
    window.__analytics_page_enter_ts = Date.now();
    return () => {
      if (trackTimeOnUnmount) trackTimeOnPage();
    };
  }, [trackTimeOnPage, trackTimeOnUnmount]);

  return { trackEvent, trackPageView, flush };
}

export default useAnalytics;
