import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { jwtDecode } from "jwt-decode";
import type {
  AuthState,
  AuthResponse,
  LoginCredentials,
  SignupCredentials,
} from "../types/auth";
import { apiService } from "../services/api";
import useAnalytics from "../hooks/useAnalytics";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  completeSession: (response: AuthResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export context for useAuth hook
export { AuthContext };
export type { AuthContextType };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const { trackEvent } = useAnalytics({ isEnabled: true });

  // Check if token is expired
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const decoded = jwtDecode(token);
      if (!decoded.exp) return false;
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }, []);

  // Define logout first so it can be used in other functions
  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("auth_token");

      if (!token) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      if (isTokenExpired(token)) {
        localStorage.removeItem("auth_token");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const user = await apiService.getCurrentUser();
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error) {
        console.error("Failed to fetch user:", error);
        localStorage.removeItem("auth_token");
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
  }, [isTokenExpired]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { user, token } = await apiService.login(credentials);
    localStorage.setItem("auth_token", token);
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const signup = useCallback(async (credentials: SignupCredentials) => {
    // Email/password accounts must be activated before they receive a session.
    await apiService.signup(credentials);
    trackEvent("account_signup_submitted", { method: "password" }, true);
  }, [trackEvent]);

  const completeSession = useCallback((response: AuthResponse) => {
    const { user, token } = response;
    localStorage.setItem("auth_token", token);
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const googleLogin = useCallback(async (credential: string) => {
    const { user, token } = await apiService.googleLogin(credential);
    completeSession({ user, token });
  }, [completeSession]);

  const refreshUser = useCallback(async () => {
    if (!state.token) return;

    try {
      const user = await apiService.getCurrentUser();
      setState((prev) => ({ ...prev, user }));
    } catch (error) {
      console.error("Failed to refresh user:", error);
      logout();
    }
  }, [state.token, logout]);

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
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
