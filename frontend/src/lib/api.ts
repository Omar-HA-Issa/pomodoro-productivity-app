interface Session {
  id: string;
  name: string;
  focus_duration: number;
  break_duration: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface TimerSession {
  id: string;
  user_id: string;
  session_template_id?: string;
  duration_minutes: number;
  phase: string;
  current_cycle: number;
  target_cycles: number;
  completed: boolean;
  paused: boolean;
  start_time: string;
  end_time?: string;
}

interface ScheduledSession {
  id: string;
  user_id: string;
  session_id?: string;
  title?: string;
  start_datetime: string;
  duration_min: number;
  created_at: string;
}

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
  getAll: () => api<Session[]>('/sessions'),

  create: (data: { name: string; focus_duration: number; break_duration: number; description?: string }) =>
    api<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name: string; focus_duration: number; break_duration: number; description?: string }) =>
    api<Session>(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    api<null>(`/sessions/${id}`, {
      method: 'DELETE',
    }),

  getById: (id: string) => api<Session>(`/sessions/${id}`),
};

// Timer API helpers
export const timerAPI = {
  getActive: () => api<TimerSession | null>('/timer/active'),

  start: (data: {
    session_template_id?: string;
    duration_minutes: number;
    phase: string;
    current_cycle?: number;
    target_cycles?: number;
  }) => api<TimerSession>('/timer/start', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  pause: (timer_id: string) => api<TimerSession>('/timer/pause', {
    method: 'POST',
    body: JSON.stringify({ timer_id }),
  }),

  resume: (timer_id: string) => api<TimerSession>('/timer/resume', {
    method: 'POST',
    body: JSON.stringify({ timer_id }),
  }),

  stop: (timer_id: string) => api<TimerSession>('/timer/stop', {
    method: 'POST',
    body: JSON.stringify({ timer_id }),
  }),

  complete: (timer_id: string) => api<TimerSession>('/timer/complete', {
    method: 'POST',
    body: JSON.stringify({ timer_id }),
  }),
};

// Schedule API helpers
export const scheduleAPI = {
  getAll: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return api<ScheduledSession[]>(`/schedule${params.toString() ? '?' + params.toString() : ''}`);
  },

  create: (data: {
    session_id?: string;
    title?: string;
    start_datetime: string;
    duration_min?: number;
  }) => api<ScheduledSession>('/schedule', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: {
    session_id?: string;
    title?: string;
    start_datetime: string;
    duration_min?: number;
  }) => api<ScheduledSession>(`/schedule/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => api<null>(`/schedule/${id}`, {
    method: 'DELETE',
  }),
};