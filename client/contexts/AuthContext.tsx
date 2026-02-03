import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl, queryClient } from "@/lib/query-client";
import { setGlobalAuthToken, getAuthToken } from "@/lib/auth-token";

const AUTH_TOKEN_KEY = "@auth/token";

interface User {
  id: number;
  email: string;
  name: string;
  hasVoiceSample: boolean;
}

interface OAuthParams {
  email: string;
  name: string;
  provider: "google" | "apple";
  providerId: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authToken: string | null;
  needsVoiceSetup: boolean;
  clearNeedsVoiceSetup: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  oauthLogin: (params: OAuthParams) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsVoiceSetup, setNeedsVoiceSetup] = useState(false);

  const clearNeedsVoiceSetup = useCallback(() => {
    setNeedsVoiceSetup(false);
  }, []);

  const setToken = useCallback(async (token: string | null) => {
    setGlobalAuthToken(token);
    setAuthToken(token);
    if (token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      // Get token from storage to ensure we have the latest
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const tokenToUse = storedToken || getAuthToken();
      
      const headers: Record<string, string> = {};
      if (tokenToUse) {
        headers["X-Auth-Token"] = tokenToUse;
      }
      
      const response = await fetch(new URL("/api/auth/me", getApiUrl()).toString(), {
        credentials: "include",
        headers,
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      }
      // Don't log out on error - just keep existing user data
      // This prevents logout when refreshing after profile updates
    } catch (error) {
      console.error("Failed to refresh user:", error);
      // Don't set user to null - keep existing data on network errors
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      
      // Load saved auth token
      try {
        const savedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (savedToken) {
          setGlobalAuthToken(savedToken);
          setAuthToken(savedToken);
        }
      } catch (e) {
        console.error("Failed to load auth token:", e);
      }
      
      await refreshUser();
      setIsLoading(false);
    };
    checkAuth();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(new URL("/api/auth/login", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        if (data.authToken) {
          await setToken(data.authToken);
        }
        queryClient.invalidateQueries();
        return { success: true };
      } else {
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      const response = await fetch(new URL("/api/auth/signup", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        if (data.authToken) {
          await setToken(data.authToken);
        }
        queryClient.invalidateQueries();
        // New users always need voice setup
        if (!data.user.hasVoiceSample) {
          setNeedsVoiceSetup(true);
        }
        return { success: true };
      } else {
        return { success: false, error: data.error || "Signup failed" };
      }
    } catch (error) {
      console.error("Signup error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const oauthLogin = async (params: OAuthParams) => {
    try {
      const response = await fetch(new URL("/api/auth/oauth", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });

      // Check content type before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("OAuth response not JSON:", contentType);
        return { success: false, error: "Server error. Please try again." };
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Failed to parse OAuth response:", parseError);
        return { success: false, error: "Server error. Please try again." };
      }

      if (response.ok) {
        setUser(data.user);
        if (data.authToken) {
          await setToken(data.authToken);
        }
        queryClient.invalidateQueries();
        // Check if new user needs voice setup
        if (!data.user.hasVoiceSample) {
          setNeedsVoiceSetup(true);
        }
        return { success: true };
      } else {
        return { success: false, error: data.error || "OAuth login failed" };
      }
    } catch (error) {
      console.error("OAuth login error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const logout = async () => {
    try {
      const headers: Record<string, string> = {};
      const currentToken = getAuthToken();
      if (currentToken) {
        headers["X-Auth-Token"] = currentToken;
      }
      
      await fetch(new URL("/api/auth/logout", getApiUrl()).toString(), {
        method: "POST",
        credentials: "include",
        headers,
      });
      setUser(null);
      await setToken(null);
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
      await setToken(null);
    }
  };

  // Direct update for user name (optimistic update)
  const updateUserName = useCallback((name: string) => {
    setUser((prev) => prev ? { ...prev, name } : null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        authToken,
        needsVoiceSetup,
        clearNeedsVoiceSetup,
        login,
        signup,
        oauthLogin,
        logout,
        refreshUser,
        updateUserName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
