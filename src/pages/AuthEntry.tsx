import React, { Suspense, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { useAuth } from "../hooks/useAuth";

const AuthModal = lazyWithRetry(
  () =>
    import("../components/AuthModal").then((module) => ({
      default: module.AuthModal,
    })),
  "auth-modal",
);

const getMcpContinuationUrl = (token: string | null): string | undefined => {
  if (!token || !/^[A-Za-z0-9_-]{20,}$/.test(token)) return undefined;

  const issuer =
    import.meta.env.VITE_MCP_OAUTH_ISSUER || "https://mcp.diagramwise.com";
  try {
    const url = new URL("/oauth/continue", issuer);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return undefined;
    }
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return undefined;
  }
};

const getSafeReturnTo = (value: string | null): string => {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }
  return value;
};

const AuthEntry: React.FC = () => {
  const navigate = useNavigate();
  const returnAfterLogin = useRef(false);
  const [params] = useSearchParams();
  const { login, signup, googleLogin } = useAuth();
  const continuationUrl = getMcpContinuationUrl(params.get("mcp_continuation"));
  const returnTo = getSafeReturnTo(params.get("returnTo"));
  const initialMode = params.get("mode") === "signup" ? "signup" : "login";

  return (
    <main className="min-h-screen bg-theme">
      <Suspense fallback={null}>
        <AuthModal
          isOpen
          initialMode={initialMode}
          signupContext={{ verificationReturnUrl: continuationUrl }}
          onClose={() => {
            if (returnAfterLogin.current && continuationUrl) return;
            navigate(returnAfterLogin.current ? returnTo : "/");
          }}
          googleReturnTo={continuationUrl || returnTo}
          onLogin={async (email, password) => {
            await login({ email, password });
            returnAfterLogin.current = true;
            if (continuationUrl) window.location.assign(continuationUrl);
          }}
          onSignup={async (email, password, name, context) => {
            await signup({
              email,
              password,
              name,
              verificationReturnUrl: context?.verificationReturnUrl,
            });
          }}
          onGoogleLogin={async (credential) => {
            await googleLogin(credential);
            returnAfterLogin.current = true;
            if (continuationUrl) window.location.assign(continuationUrl);
          }}
        />
      </Suspense>
    </main>
  );
};

export default AuthEntry;
