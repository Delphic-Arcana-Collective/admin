const STORAGE_KEY = "delphic_token";
const AUTH_ORIGIN = "https://auth.delphic.studio";

export function storeFragmentToken(): void {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!raw) return;
  const token = new URLSearchParams(raw).get("token");
  if (!token) return;
  sessionStorage.setItem(STORAGE_KEY, token);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

function readCookie(): string | null {
  const prefix = `${STORAGE_KEY}=`;
  for (const part of document.cookie.split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return item.slice(prefix.length);
  }
  return null;
}

export function readToken(): string | null {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const cookie = readCookie();
  if (!cookie) return null;
  sessionStorage.setItem(STORAGE_KEY, cookie);
  return cookie;
}

function decodeBase64Url(value: string): string {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const b64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

export function tokenExpired(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return true;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: unknown };
    return typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  const base = `${STORAGE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = base;
  document.cookie = `${base}; Domain=.delphic.studio; Secure`;
}

export function redirectToAuth(): void {
  const page = window.location.origin + window.location.pathname + window.location.search;
  window.location.replace(`${AUTH_ORIGIN}/?redirect=${encodeURIComponent(page)}`);
}

export function hasValidToken(): boolean {
  storeFragmentToken();
  const token = readToken();
  if (!token || tokenExpired(token)) {
    clearSession();
    return false;
  }
  return true;
}
