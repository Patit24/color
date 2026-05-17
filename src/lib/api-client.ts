const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

type RequestOptions = RequestInit & {
  token?: string | null;
  skipRefresh?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("x-device-fingerprint", getDeviceFingerprint());

  const token = options.token || getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const csrfToken = getCookie("admin_csrf_token") || getCookie("user_csrf_token");
  if (csrfToken && options.method && options.method !== "GET") {
    headers.set("x-csrf-token", csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error("Backend API is offline. Start the API server on localhost:8080 and try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (
    response.status === 401 &&
    path.startsWith("/admin/") &&
    !options.skipRefresh
  ) {
    try {
      await apiRequest("/admin-auth/refresh", {
        method: "POST",
        skipRefresh: true,
      });
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    } catch {
      if (typeof window !== "undefined") {
        window.location.href = "/admin/login";
      }
      throw new Error("Admin session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Request failed with ${response.status}`);
  }

  return payload as T;
}

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("accessToken");
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

export function getDeviceFingerprint() {
  if (typeof window === "undefined") return "server";
  const key = "colorProDeviceFingerprint";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}
