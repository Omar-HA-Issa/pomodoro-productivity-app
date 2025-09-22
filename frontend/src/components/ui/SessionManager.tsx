import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Trash2, Pencil, Save, Plus } from "lucide-react";

type Session = {
  id: number;
  title: string;
  target_pomodoros: number;
  notes: string | null;
  created_at: string;
};

const emptyForm = { title: "", target_pomodoros: 1, notes: "" };

const SessionManager: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setSessions(await api<Session[]>("/sessions")); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim()) return;
    const body = { title: form.title.trim(), target_pomodoros: Number(form.target_pomodoros) || 1, notes: form.notes || null };
    const s = await api<Session>("/sessions", { method: "POST", body: JSON.stringify(body) });
    setSessions([s, ...sessions]);
    setForm(emptyForm);
  };

  const update = async (id: number) => {
    const sess = sessions.find(x => x.id === id);
    if (!sess) return;
    const body = { title: sess.title, target_pomodoros: sess.target_pomodoros, notes: sess.notes };
    const s = await api<Session>(`/sessions/${id}`, { method: "PUT", body: JSON.stringify(body) });
    setSessions(sessions.map(x => (x.id === id ? s : x)));
    setEditingId(null);
  };

  const remove = async (id: number) => {
    await api<void>(`/sessions/${id}`, { method: "DELETE" });
    setSessions(sessions.filter(x => x.id !== id));
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Create / Edit Form */}
      <div className="card">
        <h3 className="text-lg font-medium text-foreground mb-4">{editingId ? "Edit Session" : "New Session"}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-grey-600 mb-1">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Deep Work"
            />
          </div>
          <div>
            <label className="block text-sm text-grey-600 mb-1">Target Pomodoros</label>
            <input
              type="number"
              min={1}
              className="input"
              value={form.target_pomodoros}
              onChange={(e) => setForm({ ...form, target_pomodoros: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm text-grey-600 mb-1">Notes</label>
            <textarea
              className="textarea"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Save
            </button>
            <button onClick={() => setForm(emptyForm)} className="btn-secondary">Clear</button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-foreground">Sessions</h3>
          {loading && <span className="text-xs text-grey-500">Loading…</span>}
        </div>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-grey-200">
              <div className="flex-1 min-w-0">
                {editingId === s.id ? (
                  <div className="grid md:grid-cols-3 gap-2">
                    <input className="input" value={s.title}
                      onChange={(e) => setSessions(prev => prev.map(x => x.id === s.id ? { ...x, title: e.target.value } : x))}/>
                    <input type="number" min={1} className="input" value={s.target_pomodoros}
                      onChange={(e) => setSessions(prev => prev.map(x => x.id === s.id ? { ...x, target_pomodoros: Number(e.target.value) } : x))}/>
                    <input className="input" value={s.notes ?? ""}
                      onChange={(e) => setSessions(prev => prev.map(x => x.id === s.id ? { ...x, notes: e.target.value } : x))}/>
                  </div>
                ) : (
                  <>
                    <div className="font-medium text-foreground">{s.title}</div>
                    <div className="text-sm text-grey-600">
                      Target: {s.target_pomodoros} • {new Date(s.created_at).toLocaleString()}
                    </div>
                    {s.notes && <div className="text-sm text-grey-600 mt-1">{s.notes}</div>}
                  </>
                )}
              </div>
              {editingId === s.id ? (
                <button className="btn-secondary-sm flex items-center gap-1" onClick={() => update(s.id)}>
                  <Save size={14} /> Save
                </button>
              ) : (
                <button className="btn-secondary-sm flex items-center gap-1" onClick={() => setEditingId(s.id)}>
                  <Pencil size={14} /> Edit
                </button>
              )}
              <button className="btn-secondary-sm flex items-center gap-1" onClick={() => remove(s.id)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          ))}
          {sessions.length === 0 && <div className="text-sm text-grey-500">No sessions yet.</div>}
        </div>
      </div>
    </div>
  );
};

export default SessionManager;
