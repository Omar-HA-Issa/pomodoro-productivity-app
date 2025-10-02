// src/pages/Insights.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Clock, RefreshCw, CheckCircle2, Search, ChevronRight } from 'lucide-react';
import { insightsAPI } from '../lib/api';

// ---------- Types ----------
export type SentimentLabel = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
export interface CompletedSession {
  id: string;
  date: string; // ISO
  title: string;
  duration: number; // minutes
  notes?: string;
  sentiment?: { label: SentimentLabel; score: number };
  analyzedAt?: string; // ISO
}

type AnalyzeResponse = { sentiment?: { label?: string; score?: number } };
const asSentimentLabel = (v: unknown): SentimentLabel => (v === 'POSITIVE' || v === 'NEGATIVE' || v === 'NEUTRAL' ? v : 'NEUTRAL');

const NAVY = '#204972';

// ---------- Tiny UI helpers ----------
const Count = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 rounded-lg bg-[rgba(32,73,114,0.08)] border border-[rgba(32,73,114,0.2)] flex items-center justify-center">{icon}</div>
    <div className="text-gray-800"><span className="font-semibold">{value}</span> {label}</div>
  </div>
);

const Pill: React.FC<{ label: SentimentLabel; score?: number }> = ({ label, score }) => {
  const cls = label === 'POSITIVE'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : label === 'NEGATIVE'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';
  return (
    <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-md border text-xs ${cls}`}>
      {label}
      {typeof score === 'number' && <span className="text-gray-500">{Math.round(score * 100)}%</span>}
    </span>
  );
};

// ---------- Page ----------
const Insights: React.FC = () => {
  const [sessions, setSessions] = useState<CompletedSession[]>([]);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load
  const fetchCompleted = async () => {
    setRefreshing(true);
    try {
      const data = await insightsAPI.getCompletedSessions();
      const list: CompletedSession[] = (data.sessions || []).sort(
        (a: CompletedSession, b: CompletedSession) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setSessions(list);
      const seed: Record<string, string> = {};
      for (const s of list) seed[s.id] = s.notes || '';
      setNotesDraft(seed);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    } finally { setRefreshing(false); }
  };
  useEffect(() => { fetchCompleted(); }, []);

  // Derive
  const analyzed = useMemo(() => sessions.filter(s => s.sentiment), [sessions]);
  const totals = { total: sessions.length, analyzed: analyzed.length };

  // One unified searchable/timeline list
  const listFiltered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return sessions;
    return sessions.filter(s =>
      (s.title || '').toLowerCase().includes(t) ||
      (s.notes || '').toLowerCase().includes(t) ||
      new Date(s.date).toLocaleDateString().toLowerCase().includes(t)
    );
  }, [sessions, q]);

  // Group by date (YYYY-MM-DD)
  const grouped = useMemo(() => {
    const map = new Map<string, CompletedSession[]>();
    for (const s of listFiltered) {
      const key = new Date(s.date).toISOString().slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [listFiltered]);

  const current = useMemo(() => sessions.find(s => s.id === selectedId) || null, [sessions, selectedId]);

  // Actions
  const handleAnalyze = async (session: CompletedSession) => {
    const id = session.id;
    const text = (notesDraft[id] || '').trim();
    if (!text) return;
    setBusy(p => ({ ...p, [id]: true }));
    try {
      setSessions(prev => prev.map(s => (s.id === id ? { ...s, notes: text } : s)));
      const raw: AnalyzeResponse = await insightsAPI.analyze(id, text);
      const label: SentimentLabel = asSentimentLabel(raw?.sentiment?.label);
      const score: number = typeof raw?.sentiment?.score === 'number' ? raw.sentiment!.score : 0.5;
      setSessions(prev => prev.map(s => (s.id === id ? { ...s, notes: text, sentiment: { label, score }, analyzedAt: new Date().toISOString() } : s)));
    } catch (e: any) {
      console.error('Analyze error:', e);
      setSessions(prev => prev.map(s => (s.id === id ? { ...s, sentiment: session.sentiment } : s)));
      alert(e?.message || 'Analysis failed');
    } finally { setBusy(p => ({ ...p, [id]: false })); }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Insights</h1>
          <p className="text-gray-600 max-w-3xl mx-auto">Add your reflections and watch AI highlight the sentiment behind them</p>
        </div>

        {/* Top stats */}
        <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Count icon={<Clock className="w-4 h-4" style={{ color: NAVY }} />} label="total" value={totals.total} />
            <Count icon={<Brain className="w-4 h-4" style={{ color: NAVY }} />} label="analyzed" value={totals.analyzed} />
          </div>
          <button onClick={fetchCompleted} disabled={refreshing} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 transition-all disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Split Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Timeline list (scroll) */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-200 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by title, notes, date…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[rgba(32,73,114,0.6)]"
                />
              </div>
            </div>
            <div className="max-h-[65vh] overflow-y-auto">
              {grouped.map(([dateKey, items]) => (
                <div key={dateKey} className="px-4 py-3 border-b border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 mb-2">
                    {new Date(dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="space-y-2">
                    {items.map((s) => {
                      const active = s.id === selectedId;
                      const isPending = !s.sentiment;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                            active ? 'border-[rgba(32,73,114,0.6)] bg-[rgba(32,73,114,0.05)]' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="truncate">
                              <div className="text-sm font-medium text-gray-900 truncate">{s.title || 'Session'}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 truncate">
                                <span>{s.duration} min</span>
                                {isPending ? (
                                  <span className="text-gray-400">Pending</span>
                                ) : (
                                  <Pill label={s.sentiment!.label} />
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!grouped.length && (
                <div className="p-6 text-sm text-gray-500">No sessions match your search.</div>
              )}
            </div>
          </div>

          {/* Right: Details panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 min-h-[65vh]">
            {!current ? (
              <div className="h-full flex items-center justify-center text-gray-500">Select a session from the left to view details.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{current.title || 'Session'}</h2>
                    <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                      <span>{new Date(current.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span>{current.duration} min</span>
                      {current.analyzedAt && <span>analyzed {new Date(current.analyzedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div>
                    {current.sentiment ? (
                      <Pill label={current.sentiment.label} score={current.sentiment.score} />
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-md border border-gray-200 text-gray-500">Pending</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-800">Notes</label>
                  <textarea
                    value={notesDraft[current.id] ?? current.notes ?? ''}
                    onChange={(e) => setNotesDraft(prev => ({ ...prev, [current.id]: e.target.value }))}
                    rows={8}
                    className="mt-2 w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[rgba(32,73,114,0.6)] focus:ring-1 focus:ring-[rgba(32,73,114,0.25)] transition-all"
                    placeholder="Reflect on what you did, what worked, and what blocked you."
                  />
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => handleAnalyze(current)}
                    disabled={!((notesDraft[current.id] ?? '').trim()) || !!busy[current.id]}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: `linear-gradient(90deg, ${NAVY}, #142f4b)` }}
                  >
                    {busy[current.id] ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {current.sentiment ? 'Reanalyzing…' : 'Analyzing…'}
                      </>
                    ) : (
                      <>
                        {current.sentiment ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Brain className="w-4 h-4 text-white" />}
                        {current.sentiment ? 'Reanalyze' : 'Analyze with AI'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 border border-gray-200">
              <Clock className="w-8 h-8" style={{ color: NAVY }} />
            </div>
            <h4 className="text-gray-900 font-semibold mb-1">No completed sessions yet</h4>
            <p className="text-gray-600 text-sm">Finish a session in Focus or Schedule and it will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Insights;
