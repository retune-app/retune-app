import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Platform } from "react-native";
import { getAuthToken } from "@/lib/auth-token";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:5000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // For web running on localhost, use localhost:5000 directly
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const currentHost = window.location?.hostname;
    if (currentHost === "localhost" || currentHost === "127.0.0.1") {
      return "http://localhost:5000";
    }
    
    // For production (.replit.app), use the same origin (no port needed)
    // Production deployments serve both frontend and API on the same domain
    const currentOrigin = window.location?.origin;
    if (currentOrigin && currentOrigin.includes(".replit.app")) {
      return currentOrigin;
    }
    
    // For development (.replit.dev), use port 5000 explicitly
    // The default port 80 routes to Expo (8081), but port 5000 routes to Express
    // e.g., https://domain.replit.dev:5000
    if (currentOrigin && currentOrigin.includes(".replit.dev")) {
      // Extract the hostname and add port 5000
      const hostname = window.location?.hostname;
      return `https://${hostname}:5000`;
    }
  }

  // For native apps (iOS/Android), use the public domain
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  // For production (.replit.app), no port needed - same domain serves API
  if (host.includes(".replit.app")) {
    // Remove any port if present and use https
    const cleanHost = host.split(":")[0];
    return `https://${cleanHost}`;
  }

  // For development (.replit.dev), use port 5000 explicitly
  // The domain "something.replit.dev:5000" should stay as is
  // The domain "something.replit.dev" should become "something.replit.dev:5000"
  const hostWithPort = host.includes(":") ? host : `${host}:5000`;

  let url = new URL(`https://${hostWithPort}`);

  // Remove trailing slash to prevent double slashes in URL concatenation
  return url.href.replace(/\/$/, "");
}

function logApiError(context: string, method: string, url: string, status: number, body: string) {
  const isHtml = body.startsWith("<!") || body.startsWith("<html");
  console.error(
    `[API ${context}] ${method} ${url} → ${status}` +
    (isHtml ? " (server returned HTML instead of JSON — possible server crash or misconfiguration)" : ""),
    { status, bodyPreview: body.substring(0, 200) }
  );
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  const authToken = getAuthToken();
  if (authToken) {
    headers["X-Auth-Token"] = authToken;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch (err) {
    console.error(`[API network] ${method} ${url.pathname} failed — server unreachable`, err);
    throw new Error("We apologize for the inconvenience — we're currently updating the app. Please try again in a moment.");
  }

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    logApiError("mutation", method, url.pathname, res.status, text);
    if (res.status >= 500) {
      throw new Error("We apologize for the inconvenience — we're currently updating the app. Please try again in a moment.");
    }
    throw new Error(`${res.status}: ${text}`);
  }

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const headers: Record<string, string> = {};
    const authToken = getAuthToken();
    if (authToken) {
      headers["X-Auth-Token"] = authToken;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        credentials: "include",
        headers,
      });
    } catch (err) {
      console.error(`[API network] GET ${url.pathname} failed — server unreachable`, err);
      throw new Error("We apologize for the inconvenience — we're currently updating the app. Please try again in a moment.");
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      logApiError("query", "GET", url.pathname, res.status, text);
      if (res.status >= 500) {
        throw new Error("We apologize for the inconvenience — we're currently updating the app. Please try again in a moment.");
      }
      throw new Error(`${res.status}: ${text}`);
    }

    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
