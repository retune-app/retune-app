import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

const AUTH_TOKEN_KEY = "@auth/token";

interface User {
  id: number;
  email: string;
  name: string;
  hasVoiceSample: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authToken: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export auth token for use in other parts of the app
let globalAuthToken: string | null = null;
export function getAuthToken(): string | null {
  return globalAuthToken;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setToken = useCallback(async (token: string | null) => {
    globalAuthToken = token;
    setAuthToken(token);
    if (token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (globalAuthToken) {
        headers["X-Auth-Token"] = globalAuthToken;
      }
      
      const response = await fetch(new URL("/api/auth/me", getApiUrl()).toString(), {
        credentials: "include",
        headers,
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      } else {
        setUser(null);
        await setToken(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    }
  }, [setToken]);

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      
      // Load saved auth token
      try {
        const savedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (savedToken) {
          globalAuthToken = savedToken;
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
        console.log("Login response:", JSON.stringify(data));
        setUser(data.user);
        if (data.authToken) {
          console.log("Storing auth token:", data.authToken.substring(0, 10) + "...");
          await setToken(data.authToken);
          console.log("Global auth token after set:", globalAuthToken ? "set" : "null");
        } else {
          console.log("No authToken in login response!");
        }
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
        return { success: true };
      } else {
        return { success: false, error: data.error || "Signup failed" };
      }
    } catch (error) {
      console.error("Signup error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const logout = async () => {
    try {
      const headers: Record<string, string> = {};
      if (globalAuthToken) {
        headers["X-Auth-Token"] = globalAuthToken;
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        authToken,
        login,
        signup,
        logout,
        refreshUser,
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
