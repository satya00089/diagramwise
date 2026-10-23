import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type {
  AuthState,
  User,
  SessionAuthResponse,
  LoginCredentials,
  SignupCredentials,
} from "../types/auth";
import { apiService } from "../services/api";
import useAnalytics from "../hooks/useAnalytics";
import { useToast } from "../hooks/useToast";
import { ToastContainer } from "../components/Toast";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  completeSession: (response: SessionAuthResponse) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AUTH_CHANNEL_NAME = "diagramwise-auth";
const AUTH_CHANGE_STORAGE_KEY = "diagramwise-auth-change";
let sessionBootstrap: Promise<User | null> | null = null;
let authStateRevision = 0;

const clearLegacyToken = (): void => {
  try {
    localStorage.removeItem("auth_token");
  } catch {
    // Storage may be disabled; the cookie session still works.
  }
};

const readLegacyToken = (): string | null => {
  try {
    return localStorage.getItem("auth_token");
  } catch {
    // Continue with the HttpOnly cookie when storage is unavailable.
    return null;
  }
};

const getCurrentUserOrNull = async (): Promise<User | null> => {
  try {
    return await apiService.getCurrentUser();
  } catch {
    return null;
  }
};

const getErrorStatus = (error: unknown): unknown =>
  error && typeof error === "object" && "status" in error
    ? error.status
    : undefined;

const restoreSessionAfterUpgradeFailure = async (
  error: unknown,
): Promise<User | null> => {
  // Another tab may already have upgraded and revoked the old bearer.
  const user = await getCurrentUserOrNull();
  if (user) {
    clearLegacyToken();
    notifyAuthChanged();
    return user;
  }

  if (getErrorStatus(error) === 401) clearLegacyToken();
  // Keep the token after a transient failure so a reload can retry the upgrade.
  return null;
};

const loadBrowserSession = async (): Promise<User | null> => {
  const legacyToken = readLegacyToken();
  if (!legacyToken) return getCurrentUserOrNull();

  try {
    const user = (await apiService.upgradeSession(legacyToken)).user;
    clearLegacyToken();
    notifyAuthChanged();
    return user;
  } catch (error) {
    return restoreSessionAfterUpgradeFailure(error);
  }
};

const initializeBrowserSession = (): Promise<User | null> => {
  sessionBootstrap ??= loadBrowserSession();
  return sessionBootstrap;
};

function notifyAuthChanged(): void {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    channel.postMessage({ type: "session-changed" });
    channel.close();
    return;
  }

  try {
    localStorage.setItem(AUTH_CHANGE_STORAGE_KEY, String(Date.now()));
  } catch {
    // The current tab's auth state remains correct if storage is unavailable.
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };
export type { AuthContextType };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const { trackEvent } = useAnalytics({
    isEnabled: true,
    trackTimeOnUnmount: false,
  });
  const { toasts, removeToast, warning: showWarning } = useToast();

  const refreshSession = useCallback(async () => {
    const revision = ++authStateRevision;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const user = await apiService.getCurrentUser();
      if (revision === authStateRevision) {
        setState({ user, isAuthenticated: true, isLoading: false });
      }
    } catch {
      if (revision === authStateRevision) {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const revision = authStateRevision;

    const initAuth = async () => {
      const user = await initializeBrowserSession();
      if (active && revision === authStateRevision) {
        setState({ user, isAuthenticated: Boolean(user), isLoading: false });
      }
    };

    void initAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      void refreshSession();
    };
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(AUTH_CHANNEL_NAME)
        : null;
    if (channel) channel.onmessage = handleAuthChange;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_CHANGE_STORAGE_KEY) handleAuthChange();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      channel?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshSession]);

  const completeSession = useCallback((response: SessionAuthResponse) => {
    authStateRevision += 1;
    sessionBootstrap = null;
    clearLegacyToken();
    setState({
      user: response.user,
      isAuthenticated: true,
      isLoading: false,
    });
    notifyAuthChanged();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await apiService.login(credentials);
    completeSession(response);
  }, [completeSession]);

  const signup = useCallback(async (credentials: SignupCredentials) => {
    await apiService.signup(credentials);
    trackEvent("account_signup_submitted", { method: "password" }, true);
  }, [trackEvent]);

  const googleLogin = useCallback(async (credential: string) => {
    const response = await apiService.googleLogin(credential);
    completeSession(response);
  }, [completeSession]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiService.logout();
    } catch (error) {
      console.warn("Server-side session revocation could not be confirmed:", error);
      showWarning(
        "Signed out on this device. The server could not confirm session revocation, so this session may remain valid until it expires.",
        8000,
      );
    } finally {
      authStateRevision += 1;
      sessionBootstrap = null;
      clearLegacyToken();
      setState({ user: null, isAuthenticated: false, isLoading: false });
      notifyAuthChanged();
    }
  }, [showWarning]);

  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;
    try {
      const user = await apiService.getCurrentUser();
      setState((prev) => ({ ...prev, user }));
    } catch (error) {
      console.error("Failed to refresh user:", error);
      await logout();
    }
  }, [state.isAuthenticated, logout]);

  const contextValue = useMemo(
    () => ({
      ...state,
      login,
      signup,
      googleLogin,
      completeSession,
      logout,
      refreshUser,
    }),
    [state, login, signup, googleLogin, completeSession, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </AuthContext.Provider>
  );
};
