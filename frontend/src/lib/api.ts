const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token');

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  // Handle 204 No Content responses
  if (res.status === 204) {
    return null as T;
  }

  return res.json();
}

// Sessions API helpers
export const sessionsAPI = {
  getAll: () => api<any[]>('/sessions'),

  create: (data: { name: string; focus_duration: number; break_duration: number; description?: string }) =>
    api('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name: string; focus_duration: number; break_duration: number; description?: string }) =>
    api(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    api(`/sessions/${id}`, {
      method: 'DELETE',
    }),
};