import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Trash2, CalendarPlus } from "lucide-react";

type Scheduled = {
  id: number;
  session_id: number | null;
  title: string | null;
  start_datetime: string; // ISO
  duration_min: number;
};

const CalendarView: React.FC = () => {
  const [items, setItems] = useState<Scheduled[]>([]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState<string>("");
  const [duration, setDuration] = useState<number>(25);

  const load = async () => setItems(await api<Scheduled[]>("/schedule"));

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!start || (!title?.trim())) return;
    const body = { title: title.trim(), start_datetime: start, duration_min: duration };
    const created = await api<Scheduled>("/schedule", { method: "POST", body: JSON.stringify(body) });
    setItems([...items, created]);
    setTitle(""); setStart(""); setDuration(25);
  };

  const remove = async (id: number) => {
    await api<void>(`/schedule/${id}`, { method: "DELETE" });
    setItems(items.filter(x => x.id !== id));
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card">
        <h3 className="text-lg font-medium text-foreground mb-4">Schedule a Session</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-grey-600 mb-1">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Morning Deep Work"/>
          </div>
          <div>
            <label className="block text-sm text-grey-600 mb-1">Start</label>
            <input type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-grey-600 mb-1">Duration (min)</label>
            <input type="number" min={5} className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}/>
          </div>
          <button onClick={add} className="btn-primary flex items-center gap-2">
            <CalendarPlus size={16} /> Add to schedule
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-foreground mb-4">Upcoming</h3>
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between p-3 rounded-lg border border-grey-200">
              <div>
                <div className="font-medium text-foreground">{it.title || `Session #${it.session_id}`}</div>
                <div className="text-sm text-grey-600">
                  {new Date(it.start_datetime).toLocaleString()} • {it.duration_min} min
                </div>
              </div>
              <button onClick={() => remove(it.id)} className="btn-secondary-sm flex items-center gap-1">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          ))}
          {items.length === 0 && <div className="text-sm text-grey-500">Nothing scheduled yet.</div>}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
