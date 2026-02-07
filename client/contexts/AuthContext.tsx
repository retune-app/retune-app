import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getApiUrl, queryClient } from "@/lib/query-client";
import { setGlobalAuthToken, getAuthToken } from "@/lib/auth-token";

const AUTH_TOKEN_KEY = "auth_token";

// Use SecureStore on iOS/Android (more reliable for credentials), AsyncStorage on web
async function saveToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    }
  } catch (error) {
    console.error("[Auth] Failed to save token:", error);
  }
}

async function loadToken(): Promise<string | null> {
  try {
    let token: string | null = null;
    if (Platform.OS === "web") {
      token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } else {
      token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    }
    return token;
  } catch (error) {
    console.error("[Auth] Failed to load token:", error);
    return null;
  }
}

async function deleteToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    }
  } catch (error) {
  }
}

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

function seedSampleAffirmations(token: string | null) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["X-Auth-Token"] = token;
  }
  fetch(new URL("/api/affirmations/samples", getApiUrl()).toString(), {
    method: "POST",
    credentials: "include",
    headers,
  })
    .then((res) => {
      if (res.ok) return res.json();
    })
    .then((data) => {
      if (data?.created > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      }
    })
    .catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsVoiceSetup, setNeedsVoiceSetup] = useState(false);

  const clearNeedsVoiceSetup = useCallback(() => {
    setNeedsVoiceSetup(false);
  }, []);

  const setTokenValue = useCallback(async (token: string | null) => {
    setGlobalAuthToken(token);
    setAuthToken(token);
    if (token) {
      await saveToken(token);
    } else {
      await deleteToken();
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      // Get token from storage to ensure we have the latest
      const storedToken = await loadToken();
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
      const savedToken = await loadToken();
      if (savedToken) {
        setGlobalAuthToken(savedToken);
        setAuthToken(savedToken);
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
          await setTokenValue(data.authToken);
        }
        queryClient.invalidateQueries();
        seedSampleAffirmations(data.authToken || getAuthToken());
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
          await setTokenValue(data.authToken);
        }
        queryClient.invalidateQueries();
        seedSampleAffirmations(data.authToken || getAuthToken());
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
          await setTokenValue(data.authToken);
        }
        queryClient.invalidateQueries();
        seedSampleAffirmations(data.authToken || getAuthToken());
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
      await setTokenValue(null);
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
      await setTokenValue(null);
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
