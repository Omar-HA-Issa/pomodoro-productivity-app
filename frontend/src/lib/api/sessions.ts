import { http } from "./http";

export interface Session {
  id: string;
  name: string;
  focus_duration: number;
  break_duration: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const sessionsAPI = {
  getAll: () => http<Session[]>("/sessions"),

  getById: (id: string) => http<Session>(`/sessions/${id}`),

  create: (data: {
    name: string;
    focus_duration: number;
    break_duration: number;
    description?: string;
  }) =>
    http<Session>("/sessions", {
      method: "POST",
      body: data,
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
    http<Session>(`/sessions/${id}`, {
      method: "PUT",
      body: data,
    }),

  delete: (id: string) =>
    http<null>(`/sessions/${id}`, {
      method: "DELETE",
    }),
};
