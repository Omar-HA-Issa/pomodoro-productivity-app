import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  duration: string;
  type: 'focus' | 'break';
}

interface SessionTemplate {
  id: string;
  title: string;
  description: string;
}

interface StatsData {
  totalFocusTime: string;
  sessionsCompleted: number;
  averageSession: string;
  streakDays: number;
}

/**
 * HomePage component - Dashboard overview for the Pomodoro application
 * Displays welcome message, quick actions, schedule, stats, and session templates
 */
const HomePage: React.FC = () => {
  const { user } = useAuth();
  const firstName =
    (user as any)?.user_metadata?.first_name ||
    (user as any)?.user_metadata?.firstName ||
    '';

  // Mock data
  const todaysSchedule: ScheduleItem[] = [
    { id: '1', time: '09:00', title: 'Morning Deep Work', duration: '50 min', type: 'focus' },
    { id: '2', time: '10:30', title: 'Code Review',        duration: '25 min', type: 'focus' },
    { id: '3', time: '11:00', title: 'Coffee Break',        duration: '15 min', type: 'break' }
  ];

  const sessionTemplates: SessionTemplate[] = [
    { id: '1', title: 'Deep Work',         description: '50m focus / 10m break' },
    { id: '2', title: 'Classic Pomodoro',  description: '25m focus / 5m break × 4' },
    { id: '3', title: 'Reading Session',   description: '25m focus / 5m break × 4' },
    { id: '4', title: 'Coding Sprint',     description: '45m focus / 15m break' },
    { id: '5', title: 'Quick Focus',       description: '15m focus / 3m break' },
    { id: '6', title: 'Long Study',        description: '90m focus / 20m break' }
  ];

  const stats: StatsData = {
    totalFocusTime: '340m',
    sessionsCompleted: 18,
    averageSession: '28m',
    streakDays: 5
  };

  const handleQuickAction = (action: string) => {
    console.log(`Quick action: ${action}`);
  };

  const handleStartSession = (sessionId: string) => {
    console.log(`Starting session: ${sessionId}`);
  };

  const handleTemplateClick = (templateId: string) => {
    console.log(`Template selected: ${templateId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="bg-gray-50 rounded-2xl p-8 mb-8">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          {firstName ? `Welcome, ${firstName}` : 'Welcome 👋'}
        </h2>
        <p className="text-xl text-gray-600">
          Boost your productivity with focused work sessions using the{' '}
          <span className="bg-gradient-to-r from-[#204972] to-[#142f4b] bg-clip-text text-transparent font-semibold">
            Pomodoro Technique
          </span>
        </p>
      </div>

      {/* Quick Start Section */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Start</h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => handleQuickAction('focus')}
            className="bg-gradient-to-r from-[#204972] to-[#142f4b] text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <span>▶</span>
            Start Focus
          </button>
          <button
            onClick={() => handleQuickAction('break')}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <span>☕</span>
            Start Break
          </button>
          <button
            onClick={() => handleQuickAction('new-session')}
            className="bg-white text-[#204972] px-6 py-3 rounded-xl font-medium border border-gray-200 hover:bg-[#f5f7fa] transition-all duration-200 flex items-center gap-2"
          >
            <span>+</span>
            New Session
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Schedule */}
        <div className="lg:col-span-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Today's Schedule</h3>
          <div className="space-y-3">
            {todaysSchedule.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${item.type === 'focus' ? 'bg-[#204972]' : 'bg-emerald-500'}`}></span>
                      <span className="text-sm text-gray-500">{item.time}</span>
                    </div>
                    <h4 className="font-medium text-gray-900">{item.title}</h4>
                    <p className="text-sm text-gray-600">
                      {item.duration} • {item.type === 'focus' ? 'Focus' : 'Break'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleStartSession(item.id)}
                    className="text-[#204972] hover:bg-[#f5f7fa] px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                  >
                    ▶ Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats & Session Templates */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Section */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">This Week</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Streak Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">{stats.streakDays}-day streak</h4>
                    <p className="text-sm text-gray-600">Keep it going! 💪</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full"
                    style={{ width: '83%' }}
                  ></div>
                </div>
              </div>

              {/* Weekly Stats */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <span className="w-2 h-2 bg-[#204972] rounded-full"></span>
                      Total focus time
                    </span>
                    <span className="font-semibold text-gray-900">{stats.totalFocusTime}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      Sessions completed
                    </span>
                    <span className="font-semibold text-gray-900">{stats.sessionsCompleted}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      Average session
                    </span>
                    <span className="font-semibold text-gray-900">{stats.averageSession}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Session Templates */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Session Templates</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sessionTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateClick(template.id)}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 cursor-pointer group"
                >
                  <h4 className="font-medium text-gray-900 mb-1">{template.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                  <span className="text-xs text-[#204972] group-hover:underline">▶</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
