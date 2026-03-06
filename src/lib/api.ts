const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  courses: () => request<any[]>("/courses"),
  me: () => request<{ profile: any }>("/auth/me"),
  stats: () => request<any>("/admin/stats"),
  login: (payload: { email: string; password: string }) =>
    request<{ profile: any }>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload: { name: string; email: string; password: string }) =>
    request<{ profile: any }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" })
};
