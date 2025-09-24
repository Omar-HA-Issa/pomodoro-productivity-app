import React, { useState, useEffect, useCallback } from 'react';

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

interface SessionTemplate {
  id: string;
  name: string;
  focus_duration: number;
  break_duration: number;
  long_break_duration: number;
  cycles_before_long_break: number;
}

const FocusSessionPage: React.FC = () => {
  const [timerState, setTimerState] = useState<TimerState>({
    time: 25 * 60,
    isRunning: false,
    isPaused: false,
    currentPhase: 'IDLE',
    currentCycle: 0,
    targetCycles: 4,
  });

  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SessionTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  const apiCall = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`http://localhost:8000${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  useEffect(() => {
    fetchSessionTemplates();
    checkActiveSession();
  }, []);

  // Update timer display when template changes
  useEffect(() => {
    if (selectedTemplate && timerState.currentPhase === 'IDLE') {
      setTimerState(prev => ({
        ...prev,
        time: selectedTemplate.focus_duration * 60
      }));
    }
  }, [selectedTemplate]);

  const fetchSessionTemplates = async () => {
    try {
      const data = await apiCall('/api/sessions');
      setSessionTemplates(data || []);
      if (data && data.length > 0) {
        setSelectedTemplate(data[0]);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const checkActiveSession = async () => {
    try {
      const data = await apiCall('/api/timer/active');

      if (data && data.id) {
        const elapsed = Math.floor((Date.now() - new Date(data.start_time).getTime()) / 1000);
        const remainingTime = Math.max(0, data.duration_minutes * 60 - elapsed);

        setTimerState({
          id: data.id,
          time: remainingTime,
          isRunning: !data.paused,
          isPaused: data.paused || false,
          currentPhase: data.phase as 'FOCUS' | 'BREAK',
          currentCycle: data.current_cycle || 0,
          targetCycles: data.target_cycles || 4,
          sessionTemplateId: data.session_template_id
        });
      }
    } catch (error) {
      console.error('Error checking active session:', error);
    }
  };

  const startTimer = async (phase: 'FOCUS' | 'BREAK') => {
    try {
      setLoading(true);
      const duration = phase === 'FOCUS'
        ? (selectedTemplate?.focus_duration || 25)
        : (selectedTemplate?.break_duration || 5);

      const data = await apiCall('/api/timer/start', {
        method: 'POST',
        body: JSON.stringify({
          session_template_id: selectedTemplate?.id,
          duration_minutes: duration,
          phase,
          current_cycle: phase === 'FOCUS' ? timerState.currentCycle : timerState.currentCycle,
          target_cycles: timerState.targetCycles
        })
      });

      setTimerState(prev => ({
        ...prev,
        id: data.id,
        time: duration * 60,
        isRunning: true,
        isPaused: false,
        currentPhase: phase,
        sessionTemplateId: selectedTemplate?.id
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
      await apiCall(`/api/timer/${timerState.isPaused ? 'resume' : 'pause'}`, {
        method: 'POST',
        body: JSON.stringify({ timer_id: timerState.id })
      });

      setTimerState(prev => ({
        ...prev,
        isPaused: !prev.isPaused
      }));
    } catch (error) {
      console.error('Error pausing timer:', error);
    }
  };

  const stopTimer = async () => {
    if (!timerState.id) return;

    try {
      await apiCall('/api/timer/stop', {
        method: 'POST',
        body: JSON.stringify({ timer_id: timerState.id })
      });

      setTimerState({
        time: selectedTemplate?.focus_duration ? selectedTemplate.focus_duration * 60 : 25 * 60,
        isRunning: false,
        isPaused: false,
        currentPhase: 'IDLE',
        currentCycle: 0,
        targetCycles: timerState.targetCycles,
      });
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  };

  const handlePhaseTransition = useCallback(async () => {
    if (!timerState.id) return;

    try {
      let nextPhase: 'FOCUS' | 'BREAK';
      let nextCycle = timerState.currentCycle;
      let duration: number;

      if (timerState.currentPhase === 'FOCUS') {
        nextPhase = 'BREAK';
        nextCycle = timerState.currentCycle + 1;

        const isLongBreak = nextCycle % (selectedTemplate?.cycles_before_long_break || 4) === 0;
        duration = isLongBreak
          ? (selectedTemplate?.long_break_duration || 15)
          : (selectedTemplate?.break_duration || 5);
      } else {
        if (nextCycle >= timerState.targetCycles) {
          await stopTimer();
          setShowCompletionMessage(true);
          setTimeout(() => setShowCompletionMessage(false), 5000);
          return;
        }
        nextPhase = 'FOCUS';
        duration = selectedTemplate?.focus_duration || 25;
      }

      await apiCall('/api/timer/complete', {
        method: 'POST',
        body: JSON.stringify({ timer_id: timerState.id })
      });

      const data = await apiCall('/api/timer/start', {
        method: 'POST',
        body: JSON.stringify({
          session_template_id: selectedTemplate?.id,
          duration_minutes: duration,
          phase: nextPhase,
          current_cycle: nextCycle,
          target_cycles: timerState.targetCycles
        })
      });

      setTimerState(prev => ({
        ...prev,
        id: data.id,
        time: duration * 60,
        currentPhase: nextPhase,
        currentCycle: nextCycle
      }));
    } catch (error) {
      console.error('Error transitioning phase:', error);
    }
  }, [timerState, selectedTemplate]);

  useEffect(() => {
    let interval: number | undefined;

    if (timerState.isRunning && !timerState.isPaused && timerState.time > 0) {
      interval = window.setInterval(() => {
        setTimerState(prevState => {
          const newTime = prevState.time - 1;
          if (newTime <= 0) {
            handlePhaseTransition();
            return prevState;
          }
          return { ...prevState, time: newTime };
        });
      }, 1000);
    }

    return () => {
      if (interval !== undefined) {
        clearInterval(interval);
      }
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
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {
        console.log('Fullscreen not supported');
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {
        console.log('Exit fullscreen failed');
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

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
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white overflow-y-auto' : 'max-w-4xl mx-auto'} px-4 sm:px-6 lg:px-8 py-8`}>
      {/* Session Completion Message */}
      {showCompletionMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-xl shadow-lg z-50 animate-bounce">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Session Complete!</p>
              <p className="text-sm opacity-90">Great work on completing {timerState.targetCycles} cycles</p>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Focus Session</h2>
        <p className="text-lg text-gray-600">
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
                onClick={() => setSelectedTemplate(template)}
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

      <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8 text-center">
        <div className="flex justify-center items-center gap-8 mb-8">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Target Cycles:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTimerState(prev => ({
                  ...prev,
                  targetCycles: Math.max(1, prev.targetCycles - 1)
                }))}
                disabled={timerState.targetCycles <= 1 || timerState.isRunning}
                className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-600 text-sm transition-colors"
              >
                −
              </button>
              <span className="text-lg font-semibold text-gray-900 w-8 text-center">
                {timerState.targetCycles}
              </span>
              <button
                onClick={() => setTimerState(prev => ({
                  ...prev,
                  targetCycles: Math.min(10, prev.targetCycles + 1)
                }))}
                disabled={timerState.targetCycles >= 10 || timerState.isRunning}
                className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-600 text-sm transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="relative mx-auto mb-8" style={{ width: '320px', height: '320px' }}>
          <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" stroke="#f3f4f6" strokeWidth="2" fill="transparent" />
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={getPhaseColor()}
              strokeWidth="2"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - getProgressPercentage() / 100)}`}
              className="transition-all duration-1000 ease-in-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-gray-600 mb-2">
              {timerState.currentPhase}
            </div>
            <div className="text-5xl font-bold text-gray-900 tracking-tight font-sans">
              {formatTime(timerState.time)}
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          {!timerState.isRunning ? (
            <>
              <button
                onClick={() => startTimer('FOCUS')}
                disabled={loading}
                className="bg-gradient-to-r from-[#204972] to-[#142f4b] text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
              >
                Start Focus
              </button>
              <button
                onClick={() => startTimer('BREAK')}
                disabled={loading}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
              >
                Start Break
              </button>
            </>
          ) : (
            <>
              <button
                onClick={pauseTimer}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200"
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

        {/* Fullscreen Toggle Button - Positioned between control buttons and cycle info */}
        <div className="flex justify-center mb-6">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
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

        <div className="text-sm text-gray-600 mb-4">
          Cycle {timerState.currentCycle} of {timerState.targetCycles}
        </div>

        <div className="max-w-xs mx-auto">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-[#204972] to-[#142f4b] h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(timerState.currentCycle / timerState.targetCycles) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Focus Tips - Hide in fullscreen for minimal distraction */}
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

export default FocusSessionPage;