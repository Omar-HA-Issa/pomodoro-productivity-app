import React, { useState, useEffect, useCallback } from 'react';

interface TimerState {
  time: number; // Time remaining in seconds
  isRunning: boolean;
  isPaused: boolean;
  currentPhase: 'IDLE' | 'FOCUS' | 'BREAK';
  currentCycle: number;
  targetCycles: number;
}

interface TimerSettings {
  focusDuration: number; // in minutes
  breakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  longBreakInterval: number; // Every N cycles
}

// Stable settings (don’t recreate each render)
const SETTINGS: TimerSettings = {
  focusDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
};

const FocusSessionPage: React.FC = () => {
  // Timer state management
  const [timerState, setTimerState] = useState<TimerState>({
    time: SETTINGS.focusDuration * 60,
    isRunning: false,
    isPaused: false,
    currentPhase: 'IDLE',
    currentCycle: 0,
    targetCycles: 4,
  });

  /**
   * Handles transitions between focus, break, and completion phases
   */
  const handlePhaseTransition = useCallback((currentState: TimerState): TimerState => {
    if (currentState.currentPhase === 'FOCUS') {
      // Focus session completed - start break
      const isLongBreak =
        (currentState.currentCycle + 1) % SETTINGS.longBreakInterval === 0;
      const breakDuration = isLongBreak
        ? SETTINGS.longBreakDuration
        : SETTINGS.breakDuration;

      return {
        ...currentState,
        currentPhase: 'BREAK',
        time: breakDuration * 60,
        currentCycle: currentState.currentCycle + 1,
      };
    }

    if (currentState.currentPhase === 'BREAK') {
      // Break completed
      if (currentState.currentCycle >= currentState.targetCycles) {
        // All cycles completed - session finished
        return {
          ...currentState,
          currentPhase: 'IDLE',
          isRunning: false,
          time: SETTINGS.focusDuration * 60,
          currentCycle: 0,
        };
      } else {
        // Start next focus session
        return {
          ...currentState,
          currentPhase: 'FOCUS',
          time: SETTINGS.focusDuration * 60,
        };
      }
    }

    // Fallback - shouldn't reach here
    return currentState;
  }, []);

  /**
   * Timer countdown effect
   * Handles the core timer logic and phase transitions
   */
  useEffect(() => {
    let interval: number | undefined;

    if (timerState.isRunning && !timerState.isPaused && timerState.time > 0) {
      interval = window.setInterval(() => {
        setTimerState(prevState => {
          const newTime = prevState.time - 1;

          // Timer completed - handle phase transitions
          if (newTime <= 0) {
            return handlePhaseTransition(prevState);
          }

          return {
            ...prevState,
            time: newTime,
          };
        });
      }, 1000);
    }

    return () => {
      if (interval !== undefined) {
        clearInterval(interval);
      }
    };
  }, [timerState.isRunning, timerState.isPaused, timerState.time, handlePhaseTransition]);

  /**
   * Starts a focus session
   * TODO: Will call /api/timer/start endpoint
   */
  const startFocus = useCallback((): void => {
    setTimerState(prevState => ({
      ...prevState,
      currentPhase: 'FOCUS',
      time: SETTINGS.focusDuration * 60,
      isRunning: true,
      isPaused: false,
      currentCycle: 0,
    }));
  }, []);

  /**
   * Starts a break session
   * TODO: Will call /api/timer/start endpoint with break type
   */
  const startBreak = useCallback((): void => {
    setTimerState(prevState => ({
      ...prevState,
      currentPhase: 'BREAK',
      time: SETTINGS.breakDuration * 60,
      isRunning: true,
      isPaused: false,
    }));
  }, []);

  /**
   * Pauses or resumes the current timer
   * TODO: Will call /api/timer/pause or /api/timer/resume endpoints
   */
  const togglePauseResume = useCallback((): void => {
    setTimerState(prevState => ({
      ...prevState,
      isPaused: !prevState.isPaused,
    }));
  }, []);

  /**
   * Stops the current session and resets to idle
   * TODO: Will call /api/timer/stop endpoint
   */
  const stopSession = useCallback((): void => {
    setTimerState(prev => ({
      time: SETTINGS.focusDuration * 60,
      isRunning: false,
      isPaused: false,
      currentPhase: 'IDLE',
      currentCycle: 0,
      targetCycles: prev.targetCycles,
    }));
  }, []);

  /**
   * Resets the current timer to phase duration
   * TODO: Will call /api/timer/reset endpoint
   */
  const resetTimer = useCallback((): void => {
    const phaseDuration =
      timerState.currentPhase === 'FOCUS'
        ? SETTINGS.focusDuration
        : SETTINGS.breakDuration;

    setTimerState(prevState => ({
      ...prevState,
      time: phaseDuration * 60,
      isPaused: false,
    }));
  }, [timerState.currentPhase]);

  /**
   * Updates target cycles for the session
   */
  const updateTargetCycles = useCallback((newTarget: number): void => {
    const clampedTarget = Math.max(1, Math.min(10, newTarget)); // Limit between 1-10
    setTimerState(prevState => ({
      ...prevState,
      targetCycles: clampedTarget,
    }));
  }, []);

  /**
   * Formats seconds into MM:SS display format
   */
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Gets the appropriate color for the timer circle based on current phase
   */
  const getPhaseColor = useCallback((): string => {
    switch (timerState.currentPhase) {
      case 'FOCUS':
        return '#204972';
      case 'BREAK':
        return '#10b981';
      default:
        return '#e5e7eb';
    }
  }, [timerState.currentPhase]);

  /**
   * Calculates progress percentage for the circular progress indicator
   */
  const getProgressPercentage = useCallback((): number => {
    const phaseDuration =
      timerState.currentPhase === 'FOCUS'
        ? SETTINGS.focusDuration * 60
        : SETTINGS.breakDuration * 60;

    return ((phaseDuration - timerState.time) / phaseDuration) * 100;
  }, [timerState.time, timerState.currentPhase]);

  /**
   * Gets display text for current phase
   * (wrap declarations inside a block for ESLint no-case-declarations)
   */
  const getPhaseDisplayText = useCallback((): string => {
    switch (timerState.currentPhase) {
      case 'FOCUS':
        return 'FOCUS';
      case 'BREAK': {
        const isLongBreak =
          timerState.currentCycle % SETTINGS.longBreakInterval === 0 &&
          timerState.currentCycle !== 0;
        return isLongBreak ? 'LONG BREAK' : 'BREAK';
      }
      default:
        return 'IDLE';
    }
  }, [timerState.currentPhase, timerState.currentCycle]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Focus Session</h2>
        <p className="text-lg text-gray-600">
          Dedicated environment for deep work with automatic cycle switching
        </p>
      </div>

      {/* Main Timer Container */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8 text-center">
        {/* Timer Controls Header */}
        <div className="flex justify-center items-center gap-8 mb-8">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Target Cycles:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateTargetCycles(timerState.targetCycles - 1)}
                disabled={timerState.targetCycles <= 1 || timerState.isRunning}
                className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-600 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#204972]"
                aria-label="Decrease target cycles"
              >
                −
              </button>
              <span className="text-lg font-semibold text-gray-900 w-8 text-center">
                {timerState.targetCycles}
              </span>
              <button
                onClick={() => updateTargetCycles(timerState.targetCycles + 1)}
                disabled={timerState.targetCycles >= 10 || timerState.isRunning}
                className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-600 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#204972]"
                aria-label="Increase target cycles"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={resetTimer}
            disabled={!timerState.isRunning && timerState.currentPhase === 'IDLE'}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Reset
          </button>
        </div>

        {/* Timer Settings Display */}
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            {SETTINGS.focusDuration} min focus • {SETTINGS.breakDuration} min break • Auto-switching enabled
          </p>
        </div>

        {/* Circular Timer Display */}
        <div className="relative mx-auto mb-8" style={{ width: '320px', height: '320px' }}>
          <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle cx="50" cy="50" r="45" stroke="#f3f4f6" strokeWidth="2" fill="transparent" />
            {/* Progress circle */}
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

          {/* Timer Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-gray-600 mb-2">{getPhaseDisplayText()}</div>
            <div className="text-5xl font-bold text-gray-900 tracking-tight font-sans">
              {formatTime(timerState.time)}
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-4 mb-6">
          {!timerState.isRunning ? (
            <>
              <button
                onClick={startFocus}
                className="bg-gradient-to-r from-[#204972] to-[#142f4b] text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#204972] focus:ring-offset-2"
              >
                Start Focus
              </button>
              <button
                onClick={startBreak}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Start Break
              </button>
            </>
          ) : (
            <>
              <button
                onClick={togglePauseResume}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
              >
                {timerState.isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={stopSession}
                className="bg-white text-red-600 border border-red-200 px-8 py-3 rounded-xl font-medium hover:bg-red-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Stop
              </button>
            </>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="text-sm text-gray-600 mb-4">
          Cycle {timerState.currentCycle} of {timerState.targetCycles}
        </div>

        {/* Session Progress Bar */}
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

      {/* Focus Tips */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Focus Session Tips</h3>
        <ul className="space-y-2 text-gray-700">
          <li>• Turn off notifications and close distracting apps</li>
          <li>• Have water and necessary materials ready</li>
          <li>• Take breaks seriously - they help maintain focus</li>
          <li>• If interrupted, pause the timer and restart when ready</li>
        </ul>
      </div>
    </div>
  );
};

export default FocusSessionPage;
