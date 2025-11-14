import { http } from "./http";

export interface Sentiment {
  label: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  score: number;
}

export interface CompletedSession {
  id: string;
  date: string;
  title: string;
  duration: number;
  notes?: string;
  sentiment?: Sentiment;
  analyzedAt?: string;
}

export const insightsAPI = {
  getCompletedSessions: () =>
    http<{ sessions: CompletedSession[] }>(
      "/insights/completed-sessions"
    ),

  analyze: (sessionId: string, notes: string) =>
    http<{ success: boolean; sentiment: Sentiment }>(
      "/insights/analyze",
      {
        method: "POST",
        body: { sessionId, notes },
      }
    ),
};
