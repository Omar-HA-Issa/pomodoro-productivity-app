import React, { useState } from 'react';

interface ScheduledSession {
  id: number;
  title: string;
  date: string;
  time: string;
  duration: number;
}

interface ScheduleFormData {
  title: string;
  date: string;
  time: string;
  duration: number;
}

/**
 * CalendarPage component - Scheduling functionality for Pomodoro sessions
 * Allows users to schedule sessions on specific dates and times
 */
const CalendarPage: React.FC = () => {
  // State for managing scheduled sessions
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);

  // State for schedule form data
  const [scheduleData, setScheduleData] = useState<ScheduleFormData>({
    title: '',
    date: '',
    time: '',
    duration: 25
  });

  /**
   * Handles scheduling a new session
   */
  const handleScheduleSession = (): void => {
    if (!isFormValid()) {
      return;
    }

    const newSchedule: ScheduledSession = {
      id: Date.now(), // Simple ID generation - in real app would use proper UUID
      title: scheduleData.title.trim(),
      date: scheduleData.date,
      time: scheduleData.time,
      duration: scheduleData.duration
    };

    setScheduledSessions(prevSessions => [...prevSessions, newSchedule]);
    resetForm();
  };

  /**
   * Handles deleting a scheduled session
   */
  const handleDeleteScheduledSession = (sessionId: number): void => {
    setScheduledSessions(prevSessions =>
      prevSessions.filter(session => session.id !== sessionId)
    );
  };

  /**
   * Resets the form to initial state
   */
  const resetForm = (): void => {
    setScheduleData({
      title: '',
      date: '',
      time: '',
      duration: 25
    });
  };

  /**
   * Handles changes to form input fields
   */
  const handleInputChange = (field: keyof ScheduleFormData, value: string | number): void => {
    setScheduleData(prevData => ({
      ...prevData,
      [field]: value
    }));
  };

  /**
   * Adjusts duration in 5-minute increments
   */
  const adjustDuration = (increment: boolean): void => {
    const step = 5;
    const minDuration = 5;
    const maxDuration = 180; // 3 hours max

    let newDuration: number;
    if (increment) {
      newDuration = Math.min(maxDuration, scheduleData.duration + step);
    } else {
      newDuration = Math.max(minDuration, scheduleData.duration - step);
    }

    handleInputChange('duration', newDuration);
  };

  /**
   * Validates if the form is ready for submission
   */
  const isFormValid = (): boolean => {
    return scheduleData.title.trim().length > 0 &&
           scheduleData.date !== '' &&
           scheduleData.time !== '';
  };

  /**
   * Formats date for display
   */
  const formatDisplayDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  /**
   * Formats time for display (converts 24h to 12h format)
   */
  const formatDisplayTime = (timeString: string): string => {
    const [hours, minutes] = timeString.split(':');
    const hour12 = parseInt(hours) % 12 || 12;
    const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  /**
   * Sorts sessions by date and time
   */
  const getSortedSessions = (): ScheduledSession[] => {
    return scheduledSessions.sort((a, b) => {
      const dateTimeA = new Date(`${a.date}T${a.time}`);
      const dateTimeB = new Date(`${b.date}T${b.time}`);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });
  };

  /**
   * Handles starting a scheduled session
   */
  const handleStartSession = (sessionId: number): void => {
    // In a real app, this would navigate to Focus Session tab with the session data
    console.log(`Starting scheduled session: ${sessionId}`);
  };

  /**
   * Gets today's date in YYYY-MM-DD format for date input min attribute
   */
  const getTodaysDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  /**
   * Checks if a session is happening today
   */
  const isToday = (dateString: string): boolean => {
    const sessionDate = new Date(dateString);
    const today = new Date();
    return sessionDate.toDateString() === today.toDateString();
  };

  /**
   * Checks if a session is in the past
   */
  const isPast = (dateString: string, timeString: string): boolean => {
    const sessionDateTime = new Date(`${dateString}T${timeString}`);
    return sessionDateTime < new Date();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Schedule Session Form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Schedule a Session</h2>

        {/* Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

          {/* Session Title */}
          <div>
            <label
              htmlFor="session-title"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Session Title
            </label>
            <input
              id="session-title"
              type="text"
              placeholder="e.g. Morning Deep Work"
              value={scheduleData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-colors"
              maxLength={100}
            />
          </div>

          {/* Date Picker */}
          <div>
            <label
              htmlFor="session-date"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Date
            </label>
            <input
              id="session-date"
              type="date"
              value={scheduleData.date}
              min={getTodaysDate()}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-colors"
            />
          </div>

          {/* Time Picker */}
          <div>
            <label
              htmlFor="session-time"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Time
            </label>
            <input
              id="session-time"
              type="time"
              value={scheduleData.time}
              onChange={(e) => handleInputChange('time', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-colors"
            />
          </div>
        </div>

        {/* Duration Control */}
        <div className="flex items-center gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => adjustDuration(false)}
                className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-[#204972]"
                aria-label="Decrease duration"
              >
                −
              </button>
              <span
                className="text-xl font-semibold text-gray-900 w-12 text-center"
                aria-label={`${scheduleData.duration} minutes duration`}
              >
                {scheduleData.duration}
              </span>
              <button
                type="button"
                onClick={() => adjustDuration(true)}
                className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-[#204972]"
                aria-label="Increase duration"
              >
                +
              </button>
            </div>
          </div>

          {/* Duration Helper Text */}
          <div className="text-sm text-gray-600">
            <p>Suggested: 25min (Focus), 5min (Break), 50min (Deep Work)</p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleScheduleSession}
          disabled={!isFormValid()}
          className="bg-gradient-to-r from-[#204972] to-[#142f4b] text-white py-3 px-8 rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#204972] focus:ring-offset-2"
        >
          <span>📅</span>
          Add to Schedule
        </button>
      </div>

      {/* Upcoming Sessions */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Upcoming Sessions</h3>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          {scheduledSessions.length === 0 ? (
            // Empty State
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl text-gray-400">📅</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No scheduled sessions</h4>
              <p className="text-gray-600">Schedule your first session to stay organized and focused.</p>
            </div>
          ) : (
            // Sessions List
            <div className="space-y-4">
              {getSortedSessions().map((session) => {
                const isSessionToday = isToday(session.date);
                const isSessionPast = isPast(session.date, session.time);

                return (
                  <div
                    key={session.id}
                    className={`border rounded-xl p-4 transition-all duration-200 hover:shadow-sm ${
                      isSessionPast 
                        ? 'border-gray-100 opacity-60' 
                        : isSessionToday 
                          ? 'border-emerald-200 bg-emerald-50' 
                          : 'border-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">

                      {/* Session Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-gray-900">{session.title}</h5>
                          {isSessionToday && (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                              Today
                            </span>
                          )}
                          {isSessionPast && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                              Past
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {formatDisplayDate(session.date)} at {formatDisplayTime(session.time)} • {session.duration} minutes
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {!isSessionPast && (
                          <button
                            onClick={() => handleStartSession(session.id)}
                            className="text-[#204972] hover:bg-[#f5f7fa] px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#204972] focus:ring-offset-1"
                          >
                            ▶ Start
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteScheduledSession(session.id)}
                          className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;