import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// =============================== Types ===============================
interface SessionTemplate {
  id: number;
  name: string;
  focus_duration: number;
  break_duration: number;
  description?: string;
}

interface ScheduledSession {
  id: number;
  session_id?: number;
  title?: string;
  start_datetime: string;
  duration_min: number;
  completed?: boolean;
}

type ViewMode = 'list' | 'calendar';

// ============================= Theme ================================
const BRAND = {
  primary: '#204972',
  primaryDark: '#142f4b',
};
const gradient = { background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.primaryDark})` };

// ============================ Component =============================
const Schedule: React.FC = () => {
  const navigate = useNavigate();
  // Data
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [schedule, setSchedule] = useState<ScheduledSession[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Plan form
  const today = useMemo(() => new Date(), []);
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Views
  const [mode, setMode] = useState<ViewMode>('list');
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // ============================== API ===============================
  const API_BASE =
  "https://pomodoroapp-hyekcsauhufjdgbd.westeurope-01.azurewebsites.net/api";

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('Please sign in to use the schedule.');
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API ${res.status}: ${txt || res.statusText}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const txt = await res.text();
      throw new Error(`Unexpected response: ${txt.slice(0, 160)}`);
    }
    return res.json() as Promise<T>;
  }

  useEffect(() => {
    (async () => {
      try {
        const [tpls, sched] = await Promise.all([
          api<SessionTemplate[]>('/api/sessions'),
          api<ScheduledSession[]>('/api/schedule'),
        ]);
        setTemplates(tpls || []);
        setSchedule(sched || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ============================ Utilities ============================
  const isoDate = (d: Date) => d.toISOString().split('T')[0];
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const minTimeFor = (d: string) => (d === isoDate(today) ? new Date().toTimeString().slice(0, 5) : '');

  const findTemplate = (id?: number) => templates.find(t => t.id === id);
  const titleFor = (s: ScheduledSession) => s.title || findTemplate(s.session_id)?.name || 'Untitled Session';
  const subtitleFor = (s: ScheduledSession) => {
    if (s.title) return `${s.duration_min} min`;
    const t = findTemplate(s.session_id);
    return t ? `${t.focus_duration} min focus • ${t.break_duration} min break` : `${s.duration_min} min`;
  };

  const sorted = useMemo(() =>
    [...schedule].sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()),
  [schedule]);

  const minutesFromTemplate = (id: number) => findTemplate(id)?.focus_duration ?? 0;
  const overlaps = (startISO: string, durationMin: number) => {
    const start = new Date(startISO).getTime();
    const end = start + durationMin * 60000;
    return schedule.some(it => {
      const s = new Date(it.start_datetime).getTime();
      const e = s + it.duration_min * 60000;
      return start < e && end > s;
    });
  };
  const flashMsg = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 5000);
  };

  // ============================== Actions ============================
  async function addPlanned() {
    if (templateId === '' || !date || !time) {
      return;
    }

    const mins = minutesFromTemplate(Number(templateId));
    const startISO = `${date}T${time}:00`;

    if (overlaps(startISO, mins)) {
      return flashMsg('Time conflict: pick another slot.');
    }

    try {
      const created = await api<ScheduledSession>('/api/schedule', {
        method: 'POST',
        body: JSON.stringify({ session_id: Number(templateId), start_datetime: startISO, duration_min: mins }),
      });
      setSchedule(prev => [...prev, created]);
      setTemplateId(''); setDate(''); setTime('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to schedule'); }
  }

  async function toggleDone(id: number) {
    const s = schedule.find(x => x.id === id); if (!s) return;
    try {
      await api(`/api/schedule/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          session_id: s.session_id,
          title: s.title,
          start_datetime: s.start_datetime,
          duration_min: s.duration_min,
          completed: !s.completed,
        }),
      });
      setSchedule(prev => prev.map(x => x.id === id ? { ...x, completed: !s.completed } : x));
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to update'); }
  }

  async function removeItem(id: number) {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/api/schedule/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);
      setSchedule(prev => prev.filter(x => x.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete'); }
  }

  function startSession(s: ScheduledSession) {
    const tpl = findTemplate(s.session_id);
    if (tpl) localStorage.setItem('selectedTemplate', JSON.stringify(tpl));
    navigate('/focus-session');
  }

  // ============================ Calendar =============================
  const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstWeekday = (y: number, m: number) => new Date(y, m, 1).getDay();
  const sessionsOn = (y: number, m: number, d: number) => {
    const key = new Date(y, m, d).toDateString();
    return sorted.filter(s => new Date(s.start_datetime).toDateString() === key);
  };
  function shiftMonth(delta: number) {
    const dt = new Date(calYear, calMonth + delta, 1);
    const now = new Date();
    if (dt.getFullYear() < now.getFullYear() || (dt.getFullYear() === now.getFullYear() && dt.getMonth() < now.getMonth())) return;
    setCalYear(dt.getFullYear()); setCalMonth(dt.getMonth());
  }

  // ============================== Render =============================
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto px-6 md:px-10 py-16 text-center">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 md:px-10 py-8 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z"/></svg>
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Heading outside the box */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2 text-gray-900">Schedule</h2>
        <p className="text-lg text-gray-600">
          Plan and organize your Pomodoro sessions for maximum productivity
        </p>
      </div>

      {/* Planner */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Template Selection</label>
            <select
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Choose a template…</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.focus_duration} min)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input type="date" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2" value={date} min={isoDate(today)} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
            <input type="time" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2" value={time} min={minTimeFor(date)} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        {templateId !== '' && (() => {
          const t = findTemplate(Number(templateId));
          if (!t) return null;
          return (
            <div className="mt-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={gradient}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                  <p className="text-sm text-gray-600 truncate">{t.focus_duration} min focus • {t.break_duration} min break{t.description ? ` • ${t.description}` : ''}</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-lg font-bold" style={{ color: BRAND.primary }}>{t.focus_duration} min</div>
                  <div className="text-xs text-gray-500">Duration</div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm" style={{display: flash ? 'block' : 'none'}}>{flash || 'TEST MESSAGE'}</div>

        <div className="mt-5 flex gap-3">
          <button onClick={addPlanned} disabled={templateId === '' || !date || !time} className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed" style={gradient}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            Add to schedule
          </button>
          <a href="/sessions" className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6"/></svg>
            Manage Templates
          </a>
        </div>
      </section>

      {/* View toggle */}
      <section className="flex items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setMode('list')} className={`px-4 py-2 text-sm font-medium ${mode==='list' ? 'text-white' : 'text-gray-700'}`} style={mode==='list' ? gradient : undefined}>List</button>
          <button onClick={() => setMode('calendar')} className={`px-4 py-2 text-sm font-medium ${mode==='calendar' ? 'text-white' : 'text-gray-700'}`} style={mode==='calendar' ? gradient : undefined}>Calendar</button>
        </div>
      </section>

      {/* Calendar or List */}
      {mode === 'calendar' ? (
        <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <h3 className="text-lg font-semibold text-gray-900">{monthLabel(calYear, calMonth)}</h3>
            <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-gray-300 rounded-xl overflow-hidden border border-gray-300">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-700 border-r border-gray-300 last:border-r-0">{d}</div>
            ))}
            {Array.from({ length: firstWeekday(calYear, calMonth) }).map((_, i) => (
              <div key={`e-${i}`} className="h-24 bg-white border-r border-b border-gray-300 last:border-r-0" />
            ))}
            {Array.from({ length: daysInMonth(calYear, calMonth) }).map((_, i) => {
              const dayNum = i + 1;
              const cellDate = new Date(calYear, calMonth, dayNum);
              const isoKey = isoDate(cellDate);
              const todayCell = sameDay(cellDate, today);
              const daySessions = sessionsOn(calYear, calMonth, dayNum);
              const open = !!expanded[isoKey];
              return (
                <div key={dayNum} className={`${open ? 'h-auto min-h-24' : 'h-24'} bg-white p-2 border-r border-b border-gray-300 last:border-r-0 ${todayCell ? 'outline outline-2 outline-blue-200' : ''} transition-all overflow-hidden`}>
                  <div className={`text-sm font-medium mb-1 ${todayCell ? 'text-blue-700' : 'text-gray-900'}`}>{dayNum}</div>
                  <div className="space-y-1">
                    {daySessions.length > 0 && (
                      <>
                        {(open ? daySessions : daySessions.slice(0, 1)).map(s => (
                          <div key={s.id} className={`text-xs p-1.5 rounded text-center text-white ${s.completed ? 'line-through opacity-60' : ''}`} style={gradient}>
                            <div className="font-medium truncate">{titleFor(s)}</div>
                            {(open || daySessions.length === 1) && (
                              <div className="opacity-90 mt-0.5">{new Date(s.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                            )}
                          </div>
                        ))}
                        {daySessions.length > 1 && (
                          <button onClick={() => setExpanded(prev => ({ ...prev, [isoKey]: !open }))} className="w-full text-xs text-blue-700 hover:text-blue-900 font-medium py-1 text-center bg-gray-50 hover:bg-gray-100 rounded">
                            {open ? 'Show less' : `+${daySessions.length - 1} more`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
          {sorted.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-1">No scheduled sessions</h4>
              <p className="text-gray-600">Plan your first session to get started.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sorted.map(s => {
                const dt = new Date(s.start_datetime);
                const past = dt.getTime() < Date.now();
                const todayFlag = sameDay(dt, today);
                return (
                  <li key={s.id} className={`border rounded-xl p-4 transition hover:shadow-sm ${s.completed ? 'border-green-200 bg-green-50' : past ? 'border-gray-100 opacity-60' : todayFlag ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium text-gray-900 truncate">{titleFor(s)}</h5>
                          {s.completed && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium inline-flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                              Done
                            </span>
                          )}
                          {todayFlag && !s.completed && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Today</span>
                          )}
                          {past && !s.completed && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Past</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} • {subtitleFor(s)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!past && !s.completed && (
                          <button onClick={() => startSession(s)} className="px-3 py-1 rounded-lg text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-1" style={{ color: BRAND.primary }}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg>
                            Start
                          </button>
                        )}
                        <button onClick={() => toggleDone(s.id)} className={`px-3 py-1 rounded-lg text-sm font-medium inline-flex items-center gap-1 ${s.completed ? 'text-orange-700 hover:bg-orange-50' : 'text-green-700 hover:bg-green-50'}`}>
                          {s.completed ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                              Unmark
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                              Mark done
                            </>
                          )}
                        </button>
                        <button onClick={() => removeItem(s.id)} className="px-3 py-1 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 inline-flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default Schedule;