import type { AdminCoursePayload, CheckoutSession, EmailDelivery, SupportChatReply, SupportContent } from "../types";

const defaultApiOrigin = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:5000` : "http://127.0.0.1:5000";
const API_URL = import.meta.env.VITE_API_URL ?? `${defaultApiOrigin}/api`;
const CSRF_STORAGE_KEY = "starcraft-academy-csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const readStoredCsrfToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(CSRF_STORAGE_KEY);
  } catch {
    return null;
  }
};

let csrfTokenCache = readStoredCsrfToken();

const storeCsrfToken = (token: string | null) => {
  csrfTokenCache = token;
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (token) {
      window.localStorage.setItem(CSRF_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(CSRF_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures and keep the in-memory token.
  }
};

const extractCsrfToken = (payload: unknown) => {
  if (typeof payload === "object" && payload !== null && "csrfToken" in payload) {
    const token = (payload as { csrfToken?: unknown }).csrfToken;
    return typeof token === "string" && token ? token : null;
  }
  return null;
};

const isUnsafeMethod = (method: string) => !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method.toUpperCase());

const fetchCsrfToken = async (force = false) => {
  if (!force && csrfTokenCache) {
    return csrfTokenCache;
  }

  const response = await fetch(`${API_URL}/auth/csrf`, {
    credentials: "include"
  });
  const payload = await response.json().catch(() => null);
  const token = extractCsrfToken(payload);

  if (!response.ok) {
    throw new ApiError((payload as { error?: string } | null)?.error ?? `Request failed: ${response.status}`, response.status, payload);
  }

  storeCsrfToken(token);
  return token;
};

type RequestOptions = {
  skipCsrf?: boolean;
  csrfRetry?: boolean;
};

async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers ?? undefined);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipCsrf && isUnsafeMethod(method)) {
    const csrfToken = await fetchCsrfToken();
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers
  });

  const payload = await response.json().catch(() => null);
  const refreshedCsrfToken = extractCsrfToken(payload);
  if (refreshedCsrfToken) {
    storeCsrfToken(refreshedCsrfToken);
  }

  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error ?? `Request failed: ${response.status}`;
    const isCsrfError = typeof message === "string" && message.toLowerCase().includes("csrf");
    if (!options.skipCsrf && isUnsafeMethod(method) && options.csrfRetry !== false && isCsrfError) {
      storeCsrfToken(null);
      await fetchCsrfToken(true).catch(() => null);
      return request(path, init, { ...options, csrfRetry: false });
    }
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export const getErrorMessage = (error: unknown, fallback = "Ocurrio un error inesperado.") => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export const api = {
  courses: () => request<any[]>("/courses"),
  course: (slug: string) => request<any>(`/courses/${slug}`),
  csrf: () => request<{ csrfToken: string }>("/auth/csrf", undefined, { skipCsrf: true }),
  me: () => request<{ profile: any | null; csrfToken?: string }>("/auth/me"),
  profile: () => request<{ profile: any }>("/profile"),
  supportContent: () => request<SupportContent>("/support/content"),
  supportChat: (payload: { message: string }) => request<SupportChatReply>("/support/chat", { method: "POST", body: JSON.stringify(payload) }),
  updateProfile: (payload: { name: string; avatar: string }) =>
    request<{ profile: any }>("/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  stats: () => request<any>("/admin/stats"),
  login: (payload: { email: string; password: string }) =>
    request<{ profile?: any; csrfToken?: string }>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload: { name: string; email: string; password: string; referralCode?: string }) =>
    request<{ profile?: any; pendingVerification?: boolean; email?: string; message?: string; delivery?: EmailDelivery | null; csrfToken?: string }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  verifyEmail: (token: string) =>
    request<{ profile: any; verified: boolean; message?: string; csrfToken?: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`, undefined, { skipCsrf: true }),
  resendVerification: (payload: { email: string }) =>
    request<{ ok: boolean; message?: string; delivery?: EmailDelivery | null; csrfToken?: string }>("/auth/resend-verification", { method: "POST", body: JSON.stringify(payload) }),
  requestPasswordReset: (payload: { email: string }) =>
    request<{ ok: boolean; message?: string; delivery?: EmailDelivery | null; csrfToken?: string }>("/auth/request-password-reset", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (payload: { token: string; password: string }) =>
    request<{ ok: boolean; message?: string; csrfToken?: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<{ ok: boolean; csrfToken?: string }>("/auth/logout", { method: "POST" }),
  completeSection: (slug: string, payload: { sectionId: string }) =>
    request<{ profile: any }>(`/courses/${slug}/progress`, { method: "POST", body: JSON.stringify(payload) }),
  addComment: (slug: string, payload: { body: string; stars: number }) =>
    request<{ comment: any }>(`/courses/${slug}/comments`, { method: "POST", body: JSON.stringify(payload) }),
  purchaseCourse: (slug: string, payload: { provider?: string; brand?: string; last4?: string }) =>
    request<{ profile: any; course: any; purchase: any }>(`/courses/${slug}/purchase`, { method: "POST", body: JSON.stringify(payload) }),
  createCheckout: (slug: string, payload: { provider?: string; brand?: string; last4?: string }) =>
    request<{ course: any; purchase: any; checkout: CheckoutSession }>(`/courses/${slug}/checkout`, { method: "POST", body: JSON.stringify(payload) }),
  paymentStatus: (reference: string) => request<{ course: any; purchase: any; checkout: CheckoutSession }>(`/payments/${reference}`),
  confirmDemoPayment: (reference: string) =>
    request<{ profile: any; course: any; purchase: any; checkout: CheckoutSession }>(`/payments/${reference}/confirm-demo`, { method: "POST" }),
  adminCreateCourse: (payload: AdminCoursePayload) => request<{ course: any }>("/admin/courses", { method: "POST", body: JSON.stringify(payload) }),
  adminSaveSupport: (payload: SupportContent) => request<SupportContent>("/admin/support", { method: "PUT", body: JSON.stringify(payload) })
};
