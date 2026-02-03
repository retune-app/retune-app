let globalAuthToken: string | null = null;

export function getAuthToken(): string | null {
  return globalAuthToken;
}

export function setGlobalAuthToken(token: string | null) {
  globalAuthToken = token;
}
