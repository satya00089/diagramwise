const GOOGLE_AUTH_RETURN_KEY = "diagramwise_google_auth_return_to";

export const getGoogleLoginStartUri = (apiBaseUrl: string): string =>
  `${apiBaseUrl.replace(/\/$/, "")}/api/v1/auth/google/redirect/start`;

const isAllowedMcpContinuation = (value: URL): boolean =>
  value.protocol === "https:" &&
  value.hostname === "mcp.diagramwise.com" &&
  value.pathname === "/oauth/continue" &&
  /^[A-Za-z0-9_-]{20,}$/.test(value.searchParams.get("token") || "");

export const storeGoogleAuthReturnTo = (target: string): void => {
  try {
    sessionStorage.setItem(GOOGLE_AUTH_RETURN_KEY, target);
    return;
  } catch {
    // Some isolated browser policies restrict sessionStorage. The value is
    // validated again when consumed, so localStorage is a safe fallback for
    // this short-lived navigation hint.
  }

  try {
    localStorage.setItem(GOOGLE_AUTH_RETURN_KEY, target);
  } catch {
    // Authentication can still complete; the safe fallback is "/".
  }
};

export const consumeGoogleAuthReturnTo = (): string => {
  let target: string | null = null;
  try {
    target = sessionStorage.getItem(GOOGLE_AUTH_RETURN_KEY);
    sessionStorage.removeItem(GOOGLE_AUTH_RETURN_KEY);
  } catch {
    // Try the fallback storage below.
  }

  if (!target) {
    try {
      target = localStorage.getItem(GOOGLE_AUTH_RETURN_KEY);
      localStorage.removeItem(GOOGLE_AUTH_RETURN_KEY);
    } catch {
      // Fall through to the safe home-page destination.
    }
  }

  if (!target) return "/";

  try {
    const parsed = new URL(target, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    if (isAllowedMcpContinuation(parsed)) return parsed.toString();
  } catch {
    // Fall through to the safe home-page destination.
  }

  return "/";
};

export const startGoogleLogin = (startUri: string, returnTo: string): void => {
  const target = returnTo || "/";
  storeGoogleAuthReturnTo(target);
  window.location.assign(
    `${startUri}?return_to=${encodeURIComponent(target)}`,
  );
};
