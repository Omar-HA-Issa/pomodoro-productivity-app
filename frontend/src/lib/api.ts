export interface Session {
  id: string;
  name: string;
  focus_duration: number;
  break_duration: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TimerSession {
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
  session_group_id?: string | null;
}

export interface ScheduledSession {
  id: string;
  user_id: string;
  session_id?: string;
  title?: string;
  start_datetime: string;
  duration_min: number;
  created_at: string;
  completed?: boolean;
}

export interface CompletedSession {
  id: string;
  date: string;
  title: string;
  duration: number;
  notes?: string;
  sentiment?: {
    label: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
    score: number;
  };
  analyzedAt?: string;
}

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

// API helper that automatically attaches auth token
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("auth_token");

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

// Sessions API
export const sessionsAPI = {
  getAll: () => api<Session[]>("/sessions"),

  create: (data: {
    name: string;
    focus_duration: number;
    break_duration: number;
    description?: string;
  }) =>
    api<Session>("/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: {
      name: string;
      focus_duration: number;
      break_duration: number;
      description?: string;
    }
  ) =>
    api<Session>(`/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    api<null>(`/sessions/${id}`, {
      method: "DELETE",
    }),

  getById: (id: string) => api<Session>(`/sessions/${id}`),
};

// Timer API
export const timerAPI = {
  getActive: () => api<TimerSession | null>("/timer/active"),

  start: (data: {
    session_template_id?: string;
    duration_minutes: number;
    phase: string;
    current_cycle?: number;
    target_cycles?: number;
    session_group_id?: string;
  }) =>
    api<TimerSession>("/timer/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  pause: (timer_id: string) =>
    api<TimerSession>("/timer/pause", {
      method: "POST",
      body: JSON.stringify({ timer_id }),
    }),

  resume: (timer_id: string) =>
    api<TimerSession>("/timer/resume", {
      method: "POST",
      body: JSON.stringify({ timer_id }),
    }),

  stop: (timer_id: string) =>
    api<TimerSession>("/timer/stop", {
      method: "POST",
      body: JSON.stringify({ timer_id }),
    }),

  complete: (timer_id: string) =>
    api<TimerSession>("/timer/complete", {
      method: "POST",
      body: JSON.stringify({ timer_id }),
    }),
};

// Schedule API
export const scheduleAPI = {
  getAll: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);

    const query = params.toString();
    return api<ScheduledSession[]>(
      `/schedule${query ? `?${query}` : ""}`
    );
  },

  create: (data: {
    session_id?: string;
    title?: string;
    start_datetime: string;
    duration_min?: number;
  }) =>
    api<ScheduledSession>("/schedule", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: {
      session_id?: string;
      title?: string;
      start_datetime: string;
      duration_min?: number;
      completed?: boolean;
    }
  ) =>
    api<ScheduledSession>(`/schedule/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    api<null>(`/schedule/${id}`, {
      method: "DELETE",
    }),
};

// Insights API
export const insightsAPI = {
  getCompletedSessions: () =>
    api<{ sessions: CompletedSession[] }>("/insights/completed-sessions"),

  analyze: (sessionId: string, notes: string) =>
    api<{ success: boolean; sentiment: { label: string; score: number } }>(
      "/insights/analyze",
      {
        method: "POST",
        body: JSON.stringify({ sessionId, notes }),
      }
    ),
};

// Auth API
export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

interface SignInResponse {
  user: AuthUser;
  session: { access_token: string };
}

export const authAPI = {
  signIn: (email: string, password: string) =>
    api<SignInResponse>("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  signUp: (
    email: string,
    password: string,
    metadata?: { first_name?: string; last_name?: string }
  ) =>
    api<unknown>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        first_name: metadata?.first_name,
        last_name: metadata?.last_name,
      }),
    }),

  signOut: () =>
    api<null>("/auth/signout", {
      method: "POST",
    }),

  validateSession: () => api<unknown>("/sessions"),
};
