import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { api } from "../../lib/api";

type Phase = "idle" | "focus" | "break";
type Status = { running: boolean; phase: Phase; remainingMs: number; cycle: number };

const FocusSession: React.FC = () => {
  const [status, setStatus] = useState<Status>({ running: false, phase: "idle", remainingMs: 0, cycle: 0 });
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const tickRef = useRef<number | null>(null);

  // initial load
  useEffect(() => {
    api<Status>("/timer/status").then((s) => {
      setStatus(s);
      setTimeLeft(Math.floor((s.remainingMs || 25 * 60_000) / 1000));
    }).catch(console.error);
  }, []);

  // drive local ticking based on server status
  useEffect(() => {
    if (!status.running) { if (tickRef.current) clearInterval(tickRef.current); return; }
    setTimeLeft(Math.floor((status.remainingMs || 0) / 1000));
    tickRef.current = window.setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [status.running, status.phase]);

  const start = async (phase: Phase) => {
    const s = await api<Status>("/timer/start", { method: "POST", body: JSON.stringify({ phase }) });
    setStatus(s);
  };
  const stop = async () => setStatus(await api<Status>("/timer/stop", { method: "POST" }));

  const format = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  const progress = (() => {
    const total = status.phase === "break" ? 5 * 60 : 25 * 60;
    return Math.min(100, Math.max(0, (1 - timeLeft / total) * 100));
  })();

  const ringClass =
    status.phase === "focus" ? "timer-ring-focus"
    : status.phase === "break" ? "timer-ring-break"
    : "timer-ring-idle";

  return (
    <div className="card">
      <h2 className="text-2xl font-semibold text-foreground mb-4">Focus Session</h2>

      <div className="flex flex-col items-center gap-8">
        {/* Timer Circle (SVG, keeps your design) */}
        <div className="w-80 h-80 relative flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="50%" cy="50%" r="45%" fill="none" stroke="hsl(var(--grey-200))" strokeWidth="4" />
            <circle
              cx="50%" cy="50%" r="45%" fill="none"
              className={ringClass}
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              style={{ transition: "stroke-dashoffset 0.3s ease" }}
            />
          </svg>

          <div className="text-center z-10">
            <div className="text-sm font-medium text-grey-600 mb-2 uppercase tracking-wider">
              {status.phase.toUpperCase()}
            </div>
            <div className="timer-display font-bold text-foreground text-5xl">
              {format(timeLeft)}
            </div>
            <div className="mt-1 text-xs text-grey-500">Cycle {status.cycle}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {status.phase === "idle" ? (
            <>
              <button onClick={() => start("focus")} className="btn-primary flex items-center gap-2">
                <Play size={18} fill="white" /> Start Focus
              </button>
              <button onClick={() => start("break")} className="btn-emerald flex items-center gap-2">
                <Play size={18} fill="white" /> Start Break
              </button>
            </>
          ) : status.running ? (
            <>
              <button onClick={() => setStatus({ ...status, running: false })} className="btn-primary flex items-center gap-2">
                <Pause size={18} fill="white" /> Pause (local)
              </button>
              <button onClick={stop} className="btn-secondary flex items-center gap-2">
                <Square size={18} /> Stop
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStatus({ ...status, running: true })} className="btn-primary flex items-center gap-2">
                <Play size={18} fill="white" /> Resume (local)
              </button>
              <button onClick={stop} className="btn-secondary flex items-center gap-2">
                <Square size={18} /> Stop
              </button>
            </>
          )}
          <button onClick={() => { setStatus({ running: false, phase: "idle", remainingMs: 0, cycle: 0 }); setTimeLeft(25 * 60); }} className="btn-secondary flex items-center gap-2">
            <RotateCcw size={18} /> Reset (local)
          </button>
        </div>
      </div>
    </div>
  );
};

export default FocusSession;
