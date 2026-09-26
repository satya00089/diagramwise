import { useEffect, useRef, useState } from "react";
import { apiService } from "../services/api";
import { consumeGoogleAuthReturnTo } from "../services/googleAuth";
import { useAuth } from "../hooks/useAuth";

const AuthCallback: React.FC = () => {
  const { completeSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setError("Google authentication did not return a valid handoff.");
      return;
    }

    apiService
      .exchangeGoogleLoginHandoff(code)
      .then((response) => {
        completeSession(response);
        window.location.replace(consumeGoogleAuthReturnTo());
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Google authentication could not be completed.",
        );
      });
  }, [completeSession]);

  if (error) {
    return (
      <main className="min-h-screen bg-theme text-theme grid place-items-center px-6">
        <section className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">Google sign-in failed</h1>
          <p className="mt-3 text-muted">{error}</p>
          <a
            className="mt-6 inline-block rounded-lg bg-[var(--brand)] px-5 py-3 font-semibold text-[var(--bg)]"
            href="/"
          >
            Return to Diagramwise
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-theme text-theme grid place-items-center px-6">
      <output className="text-center" aria-live="polite">
        <span
          className="mx-auto mb-4 block h-9 w-9 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent"
          aria-hidden
        />
        Completing Google sign-in…
      </output>
    </main>
  );
};

export default AuthCallback;
