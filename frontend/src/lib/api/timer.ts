import { http } from "./http";

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

export const timerAPI = {
  getActive: () => http<TimerSession | null>("/timer/active"),

  start: (data: {
    session_template_id?: string;
    duration_minutes: number;
    phase: string;
    current_cycle?: number;
    target_cycles?: number;
    session_group_id?: string;
  }) =>
    http<TimerSession>("/timer/start", {
      method: "POST",
      body: data,
    }),

  pause: (timer_id: string) =>
    http<TimerSession>("/timer/pause", {
      method: "POST",
      body: { timer_id },
    }),

  resume: (timer_id: string) =>
    http<TimerSession>("/timer/resume", {
      method: "POST",
      body: { timer_id },
    }),

  stop: (timer_id: string) =>
    http<TimerSession>("/timer/stop", {
      method: "POST",
      body: { timer_id },
    }),

  complete: (timer_id: string) =>
    http<TimerSession>("/timer/complete", {
      method: "POST",
      body: { timer_id },
    }),
};
