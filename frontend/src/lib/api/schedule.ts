import { http } from "./http";

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

export const scheduleAPI = {
  getAll: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);

    const query = params.toString();
    return http<ScheduledSession[]>(
      `/schedule${query ? `?${query}` : ""}`
    );
  },

  create: (data: {
    session_id?: string;
    title?: string;
    start_datetime: string;
    duration_min?: number;
  }) =>
    http<ScheduledSession>("/schedule", {
      method: "POST",
      body: data,
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
    http<ScheduledSession>(`/schedule/${id}`, {
      method: "PUT",
      body: data,
    }),

  delete: (id: string) =>
    http<null>(`/schedule/${id}`, {
      method: "DELETE",
    }),
};
