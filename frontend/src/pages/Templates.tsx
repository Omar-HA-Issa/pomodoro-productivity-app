import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { sessionsAPI } from "../lib/api";

// ---- Types ----
export interface Session {
  id: string;
  name: string;
  focus_duration: number;
  break_duration: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

type SessionWrite = Pick<
  Session,
  "name" | "focus_duration" | "break_duration" | "description"
>;

// Payload expected by API (description optional, not null)
type ApiPayload = {
  name: string;
  focus_duration: number;
  break_duration: number;
  description?: string; // optional, undefined when empty
};

const DEFAULT_FORM: SessionWrite = {
  name: "",
  focus_duration: 25,
  break_duration: 5,
  description: null,
};

// ---- Small UI ----
const DurationControl: React.FC<{
  label: string;
  value: number;
  onInc: () => void;
  onDec: () => void;
}> = ({ label, value, onInc, onDec }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={onDec}
        className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#204972]"
        aria-label={`decrease ${label}`}
      >
        −
      </button>
      <span className="text-xl font-semibold text-gray-900 w-16 text-center">{value}</span>
      <button
        type="button"
        onClick={onInc}
        className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#204972]"
        aria-label={`increase ${label}`}
      >
        +
      </button>
    </div>
  </div>
);

const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ open, title, message, onCancel, onConfirm }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
};

const Templates: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SessionWrite>(DEFAULT_FORM);
  const [editing, setEditing] = useState<Session | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ---- Data load ----
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = (await sessionsAPI.getAll()) as Session[] | null | undefined;
        setSessions((data ?? []) as Session[]);
      } catch {
        setError("Failed to load sessions");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ---- Helpers ----
  const setField = (
    field: keyof SessionWrite,
    value: string | number | null
  ) => setFormData((prev) => ({ ...prev, [field]: value }));

  const tweak = (
    field: "focus_duration" | "break_duration",
    up: boolean
  ) => setField(field, Math.max(1, (formData[field] ?? 0) + (up ? 5 : -5)));

  const resetForm = () => {
    setEditing(null);
    setFormData(DEFAULT_FORM);
  };

  // ---- CRUD ----
  const onSave = async () => {
    if (!formData.name.trim()) return;
    try {
      setSubmitting(true);
      setError(null);

      const desc = formData.description?.toString().trim() || "";
      const payload: ApiPayload = {
        name: formData.name.trim(),
        focus_duration: Number(formData.focus_duration) || 0,
        break_duration: Number(formData.break_duration) || 0,
        ...(desc ? { description: desc } : {}),
      };

      const saved = (
        editing
          ? await sessionsAPI.update(editing.id, payload)
          : await sessionsAPI.create(payload)
      ) as Session;

      setSessions((prev: Session[]) => {
        const next: Session[] = editing
          ? prev.map((s) => (s.id === saved.id ? { ...s, ...saved } : s))
          : [saved, ...prev];
        return next;
      });

      resetForm();
    } catch {
      setError("Failed to save session");
    } finally {
      setSubmitting(false);
    }
  };

  const askDelete = (id: string) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      setError(null);
      await sessionsAPI.delete(deleteId);
      setSessions((prev: Session[]) => prev.filter((s) => s.id !== deleteId));
      if (editing?.id === deleteId) resetForm();
    } catch {
      setError("Failed to delete session");
    } finally {
      setConfirmOpen(false);
      setDeleteId(null);
    }
  };

  const startSession = (session: Session) =>
    navigate(`/focus-session?template=${session.id}`);

  if (loading)
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#204972] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );

  const isValid =
    formData.name.trim().length > 0 &&
    Number(formData.focus_duration) > 0 &&
    Number(formData.break_duration) > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{editing ? "Edit Session" : "Create Session"}</h2>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
            <div>
              <label htmlFor="session-name" className="block text-sm font-medium text-gray-700 mb-2">
                Session Name <span className="text-red-500">*</span>
              </label>
              <input
                id="session-name"
                type="text"
                placeholder="e.g. Deep Work, Classic Pomodoro"
                value={formData.name}
                onChange={(e) => setField("name", e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#204972] focus:border-transparent"
                maxLength={100}
              />
            </div>

            <DurationControl
              label="Focus Duration (minutes)"
              value={Number(formData.focus_duration) || 0}
              onDec={() => tweak("focus_duration", false)}
              onInc={() => tweak("focus_duration", true)}
            />

            <DurationControl
              label="Break Duration (minutes)"
              value={Number(formData.break_duration) || 0}
              onDec={() => tweak("break_duration", false)}
              onInc={() => tweak("break_duration", true)}
            />

            <div>
              <label htmlFor="session-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="session-description"
                placeholder="Optional description…"
                value={formData.description || ""}
                onChange={(e) => setField("description", e.target.value || null)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#204972] focus:border-transparent resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{(formData.description || "").length}/500 characters</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onSave}
                disabled={!isValid || submitting}
                className="flex-1 bg-gradient-to-r from-[#204972] to-[#142f4b] text-white py-3 px-6 rounded-xl font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#204972] focus:ring-offset-2"
              >
                {submitting ? "Saving…" : editing ? "Update Session" : "Create Session"}
              </button>

              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Sessions</h2>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl text-gray-400">+</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
                <p className="text-gray-600">Create your first session template to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`border rounded-xl p-4 transition-all hover:shadow-sm ${
                      editing?.id === s.id ? "border-[#204972] bg-blue-50" : "border-gray-100"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{s.name}</h4>
                        {s.description && (
                          <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded-lg mb-3">{s.description}</p>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => {
                            setEditing(s);
                            setFormData({
                              name: s.name,
                              focus_duration: s.focus_duration,
                              break_duration: s.break_duration,
                              description: s.description,
                            });
                          }}
                          className="text-[#204972] hover:bg-[#f5f7fa] px-3 py-1 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#204972] focus:ring-offset-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => askDelete(s.id)}
                          className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {s.focus_duration}min focus
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                          </svg>
                          {s.break_duration}min break
                        </span>
                      </div>

                      <button
                        onClick={() => startSession(s)}
                        className="bg-gradient-to-r from-[#204972] to-[#142f4b] text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Start Session
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Session"
        message="Are you sure you want to delete this session?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default Templates;
