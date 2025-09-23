import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface Session {
  id: string;
  user_id: string;
  name: string;
  focus_duration: number;
  break_duration: number;
  description: string;
  created_at: string;
  updated_at: string;
}
type SessionFormData = Pick<Session, 'name' | 'focus_duration' | 'break_duration' | 'description'>;

const SessionsPage: React.FC = () => {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SessionFormData>({
    name: '',
    focus_duration: 25,
    break_duration: 5,
    description: ''
  });

  const [editing, setEditing] = useState<Session | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api<Session[]>('/sessions');
        setSessions(data || []);
      } catch {
        setError('Failed to load sessions');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const setField = (field: keyof SessionFormData, value: string | number) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const tweak = (field: 'focus_duration' | 'break_duration', up: boolean) => {
    const v = formData[field];
    setField(field, up ? v + 5 : Math.max(5, v - 5));
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({ name: '', focus_duration: 25, break_duration: 5, description: '' });
  };

  const onSave = async () => {
    if (!formData.name.trim()) return;
    try {
      setSubmitting(true);
      setError(null);

      const body = JSON.stringify({
        name: formData.name.trim(),
        focus_duration: formData.focus_duration,
        break_duration: formData.break_duration,
        description: formData.description.trim() || null
      });

      const isEdit = Boolean(editing);
      const url = isEdit ? `/sessions/${editing!.id}` : '/sessions';
      const method = isEdit ? 'PUT' : 'POST';

      const saved = await api<Session>(url, { method, body });

      setSessions(prev =>
        isEdit ? prev.map(s => (s.id === saved.id ? saved : s)) : [saved, ...prev]
      );
      resetForm();
    } catch {
      setError('Failed to save session');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    try {
      setError(null);
      await api(`/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (editing?.id === id) resetForm();
    } catch {
      setError('Failed to delete session');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#204972] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const isValid = formData.name.trim() && formData.focus_duration > 0 && formData.break_duration > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {error && <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{editing ? 'Edit Session' : 'Create Session'}</h2>

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
                onChange={e => setField('name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#204972] focus:border-transparent"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Focus Duration (minutes)</label>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => tweak('focus_duration', false)}
                  className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#204972]"
                  aria-label="Decrease focus duration"
                >
                  −
                </button>
                <span className="text-xl font-semibold text-gray-900 w-16 text-center">
                  {formData.focus_duration}
                </span>
                <button
                  type="button"
                  onClick={() => tweak('focus_duration', true)}
                  className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#204972]"
                  aria-label="Increase focus duration"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Break Duration (minutes)</label>
              {/* FIX: centered row via justify-center */}
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => tweak('break_duration', false)}
                  className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#204972]"
                  aria-label="Decrease break duration"
                >
                  −
                </button>
                <span className="text-xl font-semibold text-gray-900 w-16 text-center">
                  {formData.break_duration}
                </span>
                <button
                  type="button"
                  onClick={() => tweak('break_duration', true)}
                  className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#204972]"
                  aria-label="Increase break duration"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="session-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="session-description"
                placeholder="Optional description…"
                value={formData.description}
                onChange={e => setField('description', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#204972] focus:border-transparent resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{formData.description.length}/500 characters</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onSave}
                disabled={!isValid || submitting}
                className="flex-1 bg-gradient-to-r from-[#204972] to-[#142f4b] text-white py-3 px-6 rounded-xl font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#204972] focus:ring-offset-2"
              >
                {submitting ? 'Saving…' : editing ? 'Update Session' : 'Create Session'}
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
                {sessions.map(s => (
                  <div
                    key={s.id}
                    className={`border rounded-xl p-4 transition-all hover:shadow-sm ${
                      editing?.id === s.id ? 'border-[#204972] bg-blue-50' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{s.name}</h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {s.focus_duration}min focus • {s.break_duration}min break
                        </p>
                        <p className="text-xs text-gray-500 mb-2">
                          Created {new Date(s.created_at).toLocaleDateString()}
                        </p>
                        {s.description && (
                          <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded-lg">{s.description}</p>
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
                                description: s.description || ''
                              });
                            }}

                          className="text-[#204972] hover:bg-[#f5f7fa] px-3 py-1 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#204972] focus:ring-offset-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(s.id)}
                          className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionsPage;
