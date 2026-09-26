import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MdClose, MdVisibility, MdVisibilityOff } from "react-icons/md";
import { useTheme } from "../hooks/useTheme";
import { apiService, GOOGLE_LOGIN_START_URI } from "../services/api";
import { startGoogleLogin } from "../services/googleAuth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (
    email: string,
    password: string,
    name?: string,
    context?: { verificationReturnUrl?: string },
  ) => Promise<void>;
  onGoogleLogin?: (credential: string) => Promise<void>;
  initialMode?: AuthMode;
  signupContext?: { verificationReturnUrl?: string };
  googleReturnTo?: string;
}

type AuthMode = "login" | "signup";

const getCredentialValidationError = (
  mode: AuthMode,
  password: string,
  confirmPassword: string,
) => {
  if (mode === "signup" && password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  if (mode === "signup" && password !== confirmPassword) {
    return "Passwords do not match. Please re-enter them.";
  }

  return null;
};

const AUTH_MODE_COPY = {
  login: {
    heading: "Welcome Back",
    description:
      "Sign in to save, sync, and share your diagrams across devices",
    submit: "Sign In",
    accountPrompt: "Don't have an account?",
    switchLabel: "Sign up",
  },
  signup: {
    heading: "Create Account",
    description:
      "Create an account to save your work, sync it across devices, and unlock sharing",
    submit: "Create Account",
    accountPrompt: "Already have an account?",
    switchLabel: "Sign in",
  },
} as const;

const PasswordField: React.FC<{
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  placeholder: string;
  visibilityLabel: string;
  helpText?: string;
  invalid?: boolean;
}> = ({
  id,
  label,
  value,
  visible,
  onChange,
  onToggle,
  placeholder,
  visibilityLabel,
  helpText,
  invalid = false,
}) => {
  const visibilityAction = visible
    ? `Hide ${visibilityLabel}`
    : `Show ${visibilityLabel}`;
  const helpId = helpText ? `${id}-help` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-theme mb-2">
        {label}
      </label>
      <div className="grid grid-cols-1">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={6}
          aria-invalid={invalid}
          aria-describedby={helpId}
          className="col-start-1 row-start-1 w-full px-4 py-2 pr-12 bg-surface border border-[var(--auth-field-border)] rounded-lg text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggle}
          className="col-start-1 row-start-1 z-10 flex items-center justify-self-end px-3 text-muted hover:text-theme focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded-r-lg"
          aria-label={visibilityAction}
        >
          {visible ? (
            <MdVisibilityOff className="h-5 w-5" />
          ) : (
            <MdVisibility className="h-5 w-5" />
          )}
        </button>
      </div>
      {helpText && (
        <p id={helpId} className="mt-1 text-xs text-muted">
          {helpText}
        </p>
      )}
    </div>
  );
};

const CredentialsForm: React.FC<{
  mode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  isLoading: boolean;
  googleLoginAvailable: boolean;
  onGoogleLoginStart: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onSwitchMode: () => void;
}> = ({
  mode,
  email,
  password,
  confirmPassword,
  name,
  showPassword,
  showConfirmPassword,
  isLoading,
  googleLoginAvailable,
  onGoogleLoginStart,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onNameChange,
  onTogglePassword,
  onToggleConfirmPassword,
  onSubmit,
  onSwitchMode,
}) => {
  const isSignup = mode === "signup";
  const modeCopy = AUTH_MODE_COPY[mode];
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;
  const passwordHelp = isSignup ? "Minimum 6 characters" : undefined;
  const confirmPasswordHelp = passwordsMismatch
    ? "Passwords do not match"
    : "Re-enter your password to confirm it";

  return (
    <>
      {googleLoginAvailable && (
        <>
          <button
            type="button"
            onClick={onGoogleLoginStart}
            disabled={isLoading}
            className="mb-4 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-theme/30 bg-surface px-4 text-sm font-semibold text-theme transition-colors hover:bg-theme/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold text-[#4285F4] shadow-sm"
            >
              G
            </span>
            <span>Sign in with Google</span>
          </button>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-theme/20" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-muted">
                Or continue with email
              </span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignup && (
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-theme mb-2"
            >
              Name (optional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className="w-full px-4 py-2 bg-surface border border-[var(--auth-field-border)] rounded-lg text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent"
              placeholder="John Doe"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-theme mb-2"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            required
            className="w-full px-4 py-2 bg-surface border border-[var(--auth-field-border)] rounded-lg text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          visible={showPassword}
          onChange={onPasswordChange}
          onToggle={onTogglePassword}
          placeholder="••••••••"
          visibilityLabel="password"
          helpText={passwordHelp}
        />

        {isSignup && (
          <PasswordField
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            visible={showConfirmPassword}
            onChange={onConfirmPasswordChange}
            onToggle={onToggleConfirmPassword}
            placeholder="Re-enter your password"
            visibilityLabel="confirmed password"
            helpText={confirmPasswordHelp}
            invalid={passwordsMismatch}
          />
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-6 py-3 bg-[var(--brand)] text-[var(--bg)] font-bold rounded-lg hover:brightness-95 disabled:bg-[var(--muted)] disabled:text-[var(--bg)] disabled:opacity-100 disabled:hover:brightness-100 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? "Please wait..." : modeCopy.submit}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-muted text-sm">
          {modeCopy.accountPrompt}{" "}
          <button
            type="button"
            onClick={onSwitchMode}
            className="text-[var(--brand)] font-medium hover:underline"
          >
            {modeCopy.switchLabel}
          </button>
        </p>
      </div>

      <div className="mt-6 p-3 bg-theme/5 rounded-lg">
        <p className="text-xs text-muted text-center">
          🔒 Your designs are securely stored and only accessible to you
        </p>
      </div>
    </>
  );
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  onSignup,
  onGoogleLogin,
  initialMode = "login",
  signupContext,
  googleReturnTo,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const { theme } = useTheme();

  const resolvedDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const googleLoginAvailable = Boolean(onGoogleLogin);

  const handleGoogleLoginStart = () => {
    const currentReturnTo =
      googleReturnTo ||
      `${window.location.pathname}${window.location.search}${window.location.hash}`;
    startGoogleLogin(GOOGLE_LOGIN_START_URI, currentReturnTo || "/");
  };

  const resetCredentialForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
  };

  const submitCredentials = async () => {
    if (mode === "login") {
      await onLogin(email, password);
      onClose();
      return;
    }

    await onSignup(email, password, name || undefined, signupContext);
    setVerificationEmail(email);
  };

  const handleAuthenticationError = (err: unknown) => {
    const message =
      err instanceof Error ? err.message : "Authentication failed";
    if (
      mode === "login" &&
      message.toLowerCase().includes("activate your account")
    ) {
      setVerificationEmail(email);
      return;
    }

    setError(message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = getCredentialValidationError(
      mode,
      password,
      confirmPassword,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      await submitCredentials();
      resetCredentialForm();
    } catch (err) {
      handleAuthenticationError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError("");
    setVerificationEmail("");
    setResendMessage("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const modeCopy = AUTH_MODE_COPY[mode];
  const modalThemeStyles = {
    "--bg": resolvedDarkMode ? "#080808" : "#f4f3ee",
    "--surface": resolvedDarkMode ? "#131313" : "#ebeae5",
    "--bg-hover": resolvedDarkMode ? "#1b1b1b" : "#e4e2db",
    "--text": resolvedDarkMode ? "#f5f5f3" : "#151513",
    "--muted": resolvedDarkMode ? "#9a9a98" : "#686863",
    "--border": resolvedDarkMode ? "#292929" : "#d4d2ca",
    "--brand": resolvedDarkMode ? "#ffffff" : "#151513",
    "--theme": resolvedDarkMode ? "#f5f5f3" : "#151513",
    "--auth-modal-border": resolvedDarkMode ? "#dedede" : "#151513",
    "--auth-field-border": resolvedDarkMode ? "#dedede" : "#686863",
    "--auth-callout-border": resolvedDarkMode ? "#737373" : "#a7a59d",
    colorScheme: resolvedDarkMode ? "dark" : "light",
  } as React.CSSProperties;

  if (!isOpen) return null;
  const modalRoot = typeof document === "undefined" ? null : document.body;
  if (!modalRoot) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto bg-black/50 px-2 py-4 sm:px-2 sm:py-6"
          style={modalThemeStyles}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-2xl border border-[var(--auth-modal-border)] bg-surface p-6 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-theme">
                {modeCopy.heading}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-muted hover:text-theme hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                aria-label="Close"
              >
                <MdClose className="h-5 w-5" />
              </button>
            </div>

            <p className="text-muted mb-6">{modeCopy.description}</p>

            <div className="mb-6 rounded-xl border border-[var(--auth-callout-border)] bg-[var(--bg-hover)]/60 px-4 py-3 text-sm text-muted">
              Signing in enables cloud saves, shared diagrams, and
              collaboration-ready workflows.
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${
                  resolvedDarkMode
                    ? "border-red-700 bg-red-950/40 text-red-100"
                    : "border-red-500 bg-red-50 text-red-800 ring-1 ring-red-200"
                }`}
              >
                {error}
              </div>
            )}

            {verificationEmail ? (
              <div className="space-y-4 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/10 p-5 text-center">
                <h3 className="text-lg font-bold text-theme">
                  Check your inbox
                </h3>
                <p className="text-sm text-muted">
                  We sent an activation link to{" "}
                  <strong className="text-theme">{verificationEmail}</strong>.
                  Open it within 20 minutes, then sign in.
                </p>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    setError("");
                    try {
                      const response =
                        await apiService.resendVerification(verificationEmail);
                      setResendMessage(response.message);
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Unable to resend activation email",
                      );
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="text-sm font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
                >
                  Resend activation email
                </button>
                {resendMessage && (
                  <p className="text-xs text-muted">{resendMessage}</p>
                )}
              </div>
            ) : (
              <CredentialsForm
                mode={mode}
                email={email}
                password={password}
                confirmPassword={confirmPassword}
                name={name}
                showPassword={showPassword}
                showConfirmPassword={showConfirmPassword}
                isLoading={isLoading}
                googleLoginAvailable={googleLoginAvailable}
                onGoogleLoginStart={handleGoogleLoginStart}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onConfirmPasswordChange={setConfirmPassword}
                onNameChange={setName}
                onTogglePassword={() => setShowPassword((visible) => !visible)}
                onToggleConfirmPassword={() =>
                  setShowConfirmPassword((visible) => !visible)
                }
                onSubmit={handleSubmit}
                onSwitchMode={switchMode}
              />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    modalRoot,
  );
};
