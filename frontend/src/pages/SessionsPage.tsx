import React, { useState } from 'react';

interface Session {
  id: number;
  title: string;
  targetPomodoros: number;
  notes: string;
  createdAt: string;
}

interface SessionFormData {
  title: string;
  targetPomodoros: number;
  notes: string;
}

/**
 * SessionsPage component - CRUD operations for Pomodoro session templates
 * Allows users to create, view, update, and delete session templates
 */
const SessionsPage: React.FC = () => {
  // State for managing sessions list
  const [sessions, setSessions] = useState<Session[]>([]);

  // State for form data
  const [formData, setFormData] = useState<SessionFormData>({
    title: '',
    targetPomodoros: 4,
    notes: ''
  });

  // State for editing mode
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  /**
   * Handles creating a new session
   */
  const handleCreateSession = (): void => {
    if (!formData.title.trim()) {
      return;
    }

    const newSession: Session = {
      id: Date.now(), // Simple ID generation - in real app would use proper UUID
      title: formData.title.trim(),
      targetPomodoros: formData.targetPomodoros,
      notes: formData.notes.trim(),
      createdAt: new Date().toLocaleDateString()
    };

    setSessions(prevSessions => [...prevSessions, newSession]);
    resetForm();
  };

  /**
   * Handles updating an existing session
   */
  const handleUpdateSession = (): void => {
    if (!formData.title.trim() || !editingSession) {
      return;
    }

    const updatedSession: Session = {
      ...editingSession,
      title: formData.title.trim(),
      targetPomodoros: formData.targetPomodoros,
      notes: formData.notes.trim()
    };

    setSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === editingSession.id ? updatedSession : session
      )
    );

    cancelEdit();
  };

  /**
   * Handles deleting a session
   */
  const handleDeleteSession = (sessionId: number): void => {
    setSessions(prevSessions =>
      prevSessions.filter(session => session.id !== sessionId)
    );

    // If we're editing the session being deleted, cancel edit mode
    if (editingSession && editingSession.id === sessionId) {
      cancelEdit();
    }
  };

  /**
   * Starts editing a session
   */
  const startEdit = (session: Session): void => {
    setEditingSession(session);
    setFormData({
      title: session.title,
      targetPomodoros: session.targetPomodoros,
      notes: session.notes
    });
    setIsEditing(true);
  };

  /**
   * Cancels editing and resets form
   */
  const cancelEdit = (): void => {
    setEditingSession(null);
    setIsEditing(false);
    resetForm();
  };

  /**
   * Resets form to initial state
   */
  const resetForm = (): void => {
    setFormData({
      title: '',
      targetPomodoros: 4,
      notes: ''
    });
  };

  /**
   * Handles changes to form input fields
   */
  const handleInputChange = (field: keyof SessionFormData, value: string | number): void => {
    setFormData(prevData => ({
      ...prevData,
      [field]: value
    }));
  };

  /**
   * Adjusts target pomodoros count
   */
  const adjustPomodoros = (increment: boolean): void => {
    const newValue = increment
      ? formData.targetPomodoros + 1
      : Math.max(1, formData.targetPomodoros - 1);

    handleInputChange('targetPomodoros', newValue);
  };

  /**
   * Checks if form is valid for submission
   */
  const isFormValid = (): boolean => {
    return formData.title.trim().length > 0;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Create/Edit Session Form */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {isEditing ? 'Edit Session' : 'Create Session'}
          </h2>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">

            {/* Title Field */}
            <div>
              <label
                htmlFor="session-title"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="session-title"
                type="text"
                placeholder="e.g. Deep Work Session"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-colors"
                maxLength={100}
              />
            </div>

            {/* Target Pomodoros Field */}
            <div>
              <label
                htmlFor="target-pomodoros"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Target Pomodoros
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => adjustPomodoros(false)}
                  className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-[#204972]"
                  aria-label="Decrease target pomodoros"
                >
                  −
                </button>
                <span
                  className="text-xl font-semibold text-gray-900 w-8 text-center"
                  aria-label={`${formData.targetPomodoros} target pomodoros`}
                >
                  {formData.targetPomodoros}
                </span>
                <button
                  type="button"
                  onClick={() => adjustPomodoros(true)}
                  className="w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-[#204972]"
                  aria-label="Increase target pomodoros"
                >
                  +
                </button>
              </div>
            </div>

            {/* Notes Field */}
            <div>
              <label
                htmlFor="session-notes"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Notes
              </label>
              <textarea
                id="session-notes"
                placeholder="Optional notes about this session..."
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#204972] focus:border-transparent resize-none transition-colors"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.notes.length}/500 characters
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={isEditing ? handleUpdateSession : handleCreateSession}
                disabled={!isFormValid()}
                className="flex-1 bg-gradient-to-r from-[#204972] to-[#142f4b] text-white py-3 px-6 rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#204972] focus:ring-offset-2"
              >
                {isEditing ? 'Update Session' : 'Create Session'}
              </button>

              {isEditing && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Sessions</h2>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            {sessions.length === 0 ? (
              // Empty State
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl text-gray-400">+</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
                <p className="text-gray-600">Create your first session to get started with focused work.</p>
              </div>
            ) : (
              // Sessions List
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`border rounded-xl p-4 transition-all duration-200 hover:shadow-sm ${
                      editingSession?.id === session.id 
                        ? 'border-[#204972] bg-blue-50' 
                        : 'border-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">

                      {/* Session Details */}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{session.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {session.targetPomodoros} Pomodoro{session.targetPomodoros !== 1 ? 's' : ''} • Created {session.createdAt}
                        </p>
                        {session.notes && (
                          <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded-lg">
                            {session.notes}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => startEdit(session)}
                          className="text-[#204972] hover:bg-[#f5f7fa] px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#204972] focus:ring-offset-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
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