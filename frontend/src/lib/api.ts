const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(payload?.error ?? `Request failed: ${response.status}`, response.status);
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
  me: () => request<{ profile: any | null }>("/auth/me"),
  profile: () => request<{ profile: any }>("/profile"),
  updateProfile: (payload: { name: string; avatar: string }) =>
    request<{ profile: any }>("/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  stats: () => request<any>("/admin/stats"),
  login: (payload: { email: string; password: string }) =>
    request<{ profile: any }>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload: { name: string; email: string; password: string }) =>
    request<{ profile: any }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  completeSection: (slug: string, payload: { sectionId: string }) =>
    request<{ profile: any }>(`/courses/${slug}/progress`, { method: "POST", body: JSON.stringify(payload) }),
  addComment: (slug: string, payload: { body: string; stars: number }) =>
    request<{ comment: any }>(`/courses/${slug}/comments`, { method: "POST", body: JSON.stringify(payload) })
};
