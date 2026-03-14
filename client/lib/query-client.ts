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
    
    const currentOrigin = window.location?.origin;
    
    // For development (.replit.dev), use port 5000 explicitly
    if (currentOrigin && currentOrigin.includes(".replit.dev")) {
      const hostname = window.location?.hostname;
      return `https://${hostname}:5000`;
    }

    // For production web (any non-dev, non-localhost domain), use same origin
    if (currentOrigin) {
      return currentOrigin;
    }
  }

  // For native apps (iOS/Android), use the public domain
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  // For production (.replit.app), no port needed - same domain serves API
  if (host.includes(".replit.app")) {
    const cleanHost = host.split(":")[0];
    return `https://${cleanHost}`;
  }

  // App Store builds may have a .replit.dev domain baked in from EAS build config.
  // In production native apps, always use the production API server.
  if (host.includes(".replit.dev")) {
    return "https://retuned.replit.app";
  }

  // For local development, use port 5000 explicitly
  const hostWithPort = host.includes(":") ? host : `${host}:5000`;

  let url = new URL(`https://${hostWithPort}`);

  return url.href.replace(/\/$/, "");
}

const SERVER_UNAVAILABLE_MSG = "We apologize for the inconvenience — we're currently updating the app. Please try again in a moment.";
const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [2000, 3000, 5000, 8000, 10000];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
}

export async function fetchWithRetry(
  input: RequestInfo,
  init?: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.status >= 500 && attempt < retries) {
        const delay = getRetryDelay(attempt);
        console.warn(`[API retry] Server returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        const delay = getRetryDelay(attempt);
        console.warn(`[API retry] Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
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
    res = await fetchWithRetry(url.toString(), {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch (err) {
    console.error(`[API network] ${method} ${url.pathname} failed — server unreachable after retries`, err);
    throw new Error(SERVER_UNAVAILABLE_MSG);
  }

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    logApiError("mutation", method, url.pathname, res.status, text);
    if (res.status >= 500) {
      throw new Error(SERVER_UNAVAILABLE_MSG);
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
      res = await fetchWithRetry(url.toString(), {
        credentials: "include",
        headers,
      });
    } catch (err) {
      console.error(`[API network] GET ${url.pathname} failed — server unreachable after retries`, err);
      throw new Error(SERVER_UNAVAILABLE_MSG);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      logApiError("query", "GET", url.pathname, res.status, text);
      if (res.status >= 500) {
        throw new Error(SERVER_UNAVAILABLE_MSG);
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
      retry: (failureCount, error) => {
        if (error?.message === SERVER_UNAVAILABLE_MSG) return false;
        if (error?.message?.includes("401")) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
    mutations: {
      retry: false,
    },
  },
});
