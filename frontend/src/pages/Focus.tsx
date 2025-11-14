import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sessionsAPI, timerAPI } from '../lib/api';

interface Session {
  id: string;
  name: string;
  focus_duration: number;
  break_duration: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface TimerState {
  id?: string;
  time: number;
  isRunning: boolean;
  isPaused: boolean;
  currentPhase: 'IDLE' | 'FOCUS' | 'BREAK';
  currentCycle: number;
  targetCycles: number;
  sessionTemplateId?: string;
}

type SessionTemplate = Session;

const Focus: React.FC = () => {
  const hasLoadedTemplates = useRef(false);

  const [timerState, setTimerState] = useState<TimerState>({
    time: 25 * 60,
    isRunning: false,
    isPaused: false,
    currentPhase: 'IDLE',
    currentCycle: 0,
    targetCycles: 2,
  });

  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SessionTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  // NEW: single group id per run
  const [sessionGroupId, setSessionGroupId] = useState<string | null>(null);
  const ensureGroupId = () => {
    if (sessionGroupId) return sessionGroupId;
    const id =
      (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
        ? globalThis.crypto.randomUUID()
        : `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSessionGroupId(id);
    return id;
  };

  useEffect(() => {
    if (!hasLoadedTemplates.current) {
      hasLoadedTemplates.current = true;
      fetchSessionTemplates();
    }
  }, []);

  const fetchSessionTemplates = async () => {
    try {
      const data = await sessionsAPI.getAll();
      const sessions = (data || []) as Session[];
      setSessionTemplates(sessions);

      if (sessions.length === 0) {
        await checkActiveSession();
        return;
      }

      const savedTemplate = localStorage.getItem('selectedTemplate');
      let templateToSelect = sessions[0];

      if (savedTemplate) {
        try {
          const parsed = JSON.parse(savedTemplate);
          const found = sessions.find(t => t.id === parsed.id);
          if (found) {
            templateToSelect = found;
          }
          localStorage.removeItem('selectedTemplate');
        } catch (e) {
          console.error('Error parsing selected template:', e);
          localStorage.removeItem('selectedTemplate');
        }
      }

      setSelectedTemplate(templateToSelect);
      setTimerState((prev) => ({
        ...prev,
        time: templateToSelect.focus_duration * 60
      }));

      await checkActiveSession();
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const checkActiveSession = async () => {
    try {
      const data = await timerAPI.getActive();

      if (data && data.id) {
        console.log('Restoring active session:', data);

        const startTime = new Date(data.start_time).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalSeconds = data.duration_minutes * 60;
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

        if (remainingSeconds <= 0) {
          console.log('Active session expired, cleaning up');
          await timerAPI.stop(data.id);
          return;
        }

        const frontendPhase = data.phase === 'focus' ? 'FOCUS' : 'BREAK';

        setTimerState({
          id: data.id,
          time: remainingSeconds,
          isRunning: !data.paused,
          isPaused: data.paused || false,
          currentPhase: frontendPhase,
          currentCycle: data.current_cycle || 0,
          targetCycles: data.target_cycles || 2,
          sessionTemplateId: data.session_template_id?.toString(),
        });

        // NEW: restore session_group_id if backend returns it
        if (data.session_group_id) {
          setSessionGroupId(data.session_group_id);
        }

        if (data.session_template_id && sessionTemplates.length > 0) {
          const matchingTemplate = sessionTemplates.find(
              t => t.id === data.session_template_id?.toString()
          );
          if (matchingTemplate) {
            setSelectedTemplate(matchingTemplate);
          }
        }

        return;
      }
    } catch (error) {
      console.error('Error checking active session:', error);
    }
  };

  const stopTimer = useCallback(async () => {
    if (!timerState.id) return;

    try {
      await timerAPI.stop(timerState.id);

      setTimerState((prev) => ({
        ...prev,
        id: undefined,
        time: selectedTemplate?.focus_duration ? selectedTemplate.focus_duration * 60 : 25 * 60,
        isRunning: false,
        isPaused: false,
        currentPhase: 'IDLE',
        currentCycle: 0,
      }));

      // NEW: clear group id on manual stop
      setSessionGroupId(null);
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  }, [timerState.id, selectedTemplate?.focus_duration]);

  const handlePhaseTransition = useCallback(async () => {
    if (!timerState.id) return;

    try {
      let nextPhase: 'FOCUS' | 'BREAK';
      let nextCycle = timerState.currentCycle;
      let duration: number;

      if (timerState.currentPhase === 'FOCUS') {
        // finishing a focus → increment cycle first
        nextCycle = timerState.currentCycle + 1;

        // if we reached the goal, end here (no break)
        if (nextCycle >= timerState.targetCycles) {
          await timerAPI.complete(timerState.id);
          await stopTimer();
          setShowCompletionMessage(true);
          setTimeout(() => setShowCompletionMessage(false), 5000);

          // NEW: clear group id when a run fully completes
          setSessionGroupId(null);
          return;
        }

        // otherwise go to a break
        nextPhase = 'BREAK';
        duration = selectedTemplate?.break_duration ?? 5;
      } else {
        // coming from a break → start next focus (do NOT increment here)
        nextPhase = 'FOCUS';
        duration = selectedTemplate?.focus_duration ?? 25;
      }

      await timerAPI.complete(timerState.id);

      const payload = {
        session_template_id: selectedTemplate?.id,
        duration_minutes: duration,
        phase: nextPhase === 'FOCUS' ? 'focus' : 'short_break' as const,
        current_cycle: nextCycle,           // note: cycles count finished focuses
        target_cycles: timerState.targetCycles,
        // NEW: keep the same group id across the whole run
        session_group_id: ensureGroupId(),
      };

      const data = await timerAPI.start(payload);

      setTimerState((prev) => ({
        ...prev,
        id: data.id,
        time: duration * 60,
        currentPhase: nextPhase,
        currentCycle: nextCycle,
        isRunning: true,
        isPaused: false,
      }));
    } catch (error) {
      console.error('Error transitioning phase:', error);
    }
  }, [timerState, selectedTemplate, stopTimer, sessionGroupId]);

  const startTimer = async (phase: 'FOCUS' | 'BREAK') => {
    try {
      setLoading(true);

      if (timerState.id && timerState.isRunning) {
        await timerAPI.stop(timerState.id);
      }

      const duration = phase === 'FOCUS'
        ? (selectedTemplate?.focus_duration || 25)
        : (selectedTemplate?.break_duration || 5);

      const payload = {
        session_template_id: selectedTemplate?.id,
        duration_minutes: duration,
        phase: phase === 'FOCUS' ? 'focus' : 'short_break',
        current_cycle: 0,
        target_cycles: timerState.targetCycles,
        // NEW: start of run → set or reuse group id
        session_group_id: ensureGroupId(),
      };

      const data = await timerAPI.start(payload);

      setTimerState((prev) => ({
        ...prev,
        id: data.id,
        time: duration * 60,
        isRunning: true,
        isPaused: false,
        currentPhase: phase,
        currentCycle: 0,
        sessionTemplateId: selectedTemplate?.id,
      }));
    } catch (error) {
      console.error('Error starting timer:', error);
    } finally {
      setLoading(false);
    }
  };

  const pauseTimer = async () => {
    if (!timerState.id) return;

    try {
      if (timerState.isPaused) {
        await timerAPI.resume(timerState.id);
      } else {
        await timerAPI.pause(timerState.id);
      }

      setTimerState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
    } catch (error) {
      console.error('Error pausing timer:', error);
    }
  };

  useEffect(() => {
    let interval: number | undefined;

    if (timerState.isRunning && !timerState.isPaused && timerState.time > 0) {
      interval = window.setInterval(() => {
        setTimerState((prevState) => {
          const newTime = prevState.time - 1;
          if (newTime === 0) {
            handlePhaseTransition();
            return { ...prevState, time: 0 };
          }
          return { ...prevState, time: newTime };
        });
      }, 1000);
    }

    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, [timerState.isRunning, timerState.isPaused, timerState.time, handlePhaseTransition]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseColor = (): string => {
    switch (timerState.currentPhase) {
      case 'FOCUS': return '#204972';
      case 'BREAK': return '#10b981';
      default: return '#e5e7eb';
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
        console.log('Fullscreen not supported');
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {
        console.log('Exit fullscreen failed');
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const getProgressPercentage = (): number => {
    const phaseDuration = timerState.currentPhase === 'FOCUS'
      ? (selectedTemplate?.focus_duration || 25) * 60
      : (selectedTemplate?.break_duration || 5) * 60;
    return ((phaseDuration - timerState.time) / phaseDuration) * 100;
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-gradient-to-br from-[#204972] to-[#142f4b] overflow-y-auto' : 'max-w-4xl mx-auto'} px-4 sm:px-6 lg:px-8 py-8`}>
      {showCompletionMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-12 py-8 rounded-2xl shadow-2xl max-w-md mx-4 animate-scaleIn">
            <div className="text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">Session Complete!</h3>
              <p className="text-lg opacity-90">
                Great work completing {timerState.targetCycles} focus {timerState.targetCycles === 1 ? 'cycle' : 'cycles'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={`text-center mb-8 ${isFullscreen ? 'text-white' : ''}`}>
        <h2 className={`text-3xl font-bold mb-2 ${isFullscreen ? 'text-white' : 'text-gray-900'}`}>Focus Session</h2>
        <p className={`text-lg ${isFullscreen ? 'text-white/80' : 'text-gray-600'}`}>
          Dedicated environment for deep work with automatic cycle switching
        </p>
      </div>

      {sessionTemplates.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Template</h3>
          <div className="flex flex-wrap gap-2">
            {sessionTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  if (!timerState.isRunning) {
                    setTimerState(prev => ({
                      ...prev,
                      time: template.focus_duration * 60
                    }));
                  }
                }}
                disabled={timerState.isRunning}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'bg-[#204972] text-white border-[#204972]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                {template.name}
              </button>
            ))}
          </div>
          {selectedTemplate && (
            <p className="text-sm text-gray-600 mt-2">
              {selectedTemplate.focus_duration}min focus • {selectedTemplate.break_duration}min break
            </p>
          )}
        </div>
      )}

      <div className={`${isFullscreen ? 'bg-white/10 backdrop-blur-sm border-white/20' : 'bg-white border-gray-200'} border rounded-2xl p-8 mb-8 text-center`}>
        <div className="flex justify-center items-center gap-8 mb-8">
          <div className="flex items-center gap-4">
            <span className={`text-sm font-medium ${isFullscreen ? 'text-white' : 'text-gray-700'}`}>Target Cycles:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTimerState((prev) => ({ ...prev, targetCycles: Math.max(1, prev.targetCycles - 1) }))}
                disabled={timerState.targetCycles <= 2 || timerState.isRunning}
                className={`w-8 h-8 rounded-lg border ${isFullscreen ? 'border-white/40 hover:bg-white/10 text-white' : 'border-gray-200 hover:bg-gray-50 text-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm transition-colors`}
              >
                −
              </button>
              <span className={`text-lg font-semibold w-8 text-center ${isFullscreen ? 'text-white' : 'text-gray-900'}`}>{timerState.targetCycles}</span>
              <button
                onClick={() => setTimerState((prev) => ({ ...prev, targetCycles: Math.min(10, prev.targetCycles + 1) }))}
                disabled={timerState.targetCycles >= 10 || timerState.isRunning}
                className={`w-8 h-8 rounded-lg border ${isFullscreen ? 'border-white/40 hover:bg-white/10 text-white' : 'border-gray-200 hover:bg-gray-50 text-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm transition-colors`}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="relative mx-auto mb-8" style={{ width: '320px', height: '320px' }}>
          <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" stroke={isFullscreen ? 'rgba(255,255,255,0.2)' : '#f3f4f6'} strokeWidth="2" fill="transparent" />
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={isFullscreen ? '#ffffff' : getPhaseColor()}
              strokeWidth="2"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - getProgressPercentage() / 100)}`}
              className="transition-all duration-1000 ease-in-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-sm font-medium mb-2 ${isFullscreen ? 'text-white' : 'text-gray-600'}`}>
              {timerState.currentPhase}
            </div>
            <div className={`text-5xl font-bold tracking-tight font-mono ${isFullscreen ? 'text-white' : 'text-gray-900'}`}>
              {formatTime(timerState.time)}
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          {!timerState.isRunning ? (
            <button
              onClick={() => startTimer('FOCUS')}
              disabled={loading}
              className="bg-gradient-to-r from-[#204972] to-[#142f4b] hover:from-[#142f4b] hover:to-[#0d1f2d] text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
            >
              Start Focus Session
            </button>
          ) : (
            <>
              <button
                onClick={pauseTimer}
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200"
              >
                {timerState.isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={stopTimer}
                className="bg-white text-red-600 border border-red-200 px-8 py-3 rounded-xl font-medium hover:bg-red-50 transition-all duration-200"
              >
                Stop
              </button>
            </>
          )}
        </div>

        <div className="flex justify-center mb-6">
          <button
            onClick={toggleFullscreen}
            className={`flex items-center gap-2 ${isFullscreen ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} px-6 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Exit Focus Mode
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Focus Mode
              </>
            )}
          </button>
        </div>

        <div className={`text-sm mb-4 ${isFullscreen ? 'text-white' : 'text-gray-600'}`}>
          Cycle {timerState.currentCycle} of {timerState.targetCycles}
        </div>

        <div className="max-w-xs mx-auto">
          <div className={`w-full rounded-full h-2 ${isFullscreen ? 'bg-white/20' : 'bg-gray-200'}`}>
            <div
              className={`${isFullscreen ? 'bg-white' : 'bg-gradient-to-r from-[#204972] to-[#142f4b]'} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${(timerState.currentCycle / timerState.targetCycles) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {!isFullscreen && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Focus Session Tips</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• Turn off notifications and close distracting apps</li>
            <li>• Have water and necessary materials ready</li>
            <li>• Take breaks seriously - they help maintain focus</li>
            <li>• If interrupted, pause the timer and restart when ready</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default Focus;
