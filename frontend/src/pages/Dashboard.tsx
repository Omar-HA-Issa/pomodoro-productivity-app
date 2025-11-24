import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, TrendingUp, Award, Play, Plus } from 'lucide-react';

interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  duration: string;
  type: 'focus' | 'break';
}

interface SessionTemplate {
  id: number;
  name: string;
  focus_duration: number;
  break_duration: number;
  description?: string;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  lastLoginDate: string;
}

/**
 * Dashboard component - Main overview for the Pomodoro application
 * Features: Daily login streak tracker, quick start, today's schedule, and session templates
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate] = useState(new Date());
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [todaysSchedule, setTodaysSchedule] = useState<ScheduleItem[]>([]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');

  // API Configuration
  const API_BASE = process.env.NODE_ENV === 'production'
    ? 'https://pomodoroapp-hyekcsauhufjdgbd.westeurope-01.azurewebsites.net'
    : 'http://localhost:8000';

  // Fetch dashboard data on mount
  useEffect(() => {
    fetchUserName();
    fetchDashboardData();
  }, []);

  const fetchUserName = async () => {
    try {
      // Get user data from Supabase - use auth_token not access_token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('No auth token found');
        return;
      }

      // Fetch user profile from auth endpoint
      const response = await fetch(`${API_BASE}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUserName(userData.first_name || userData.firstName || '');
      } else {
        console.error('Failed to fetch user profile:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user name:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Check if user is authenticated - use auth_token not access_token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found - user not authenticated');
        setLoading(false);
        return;
      }

      // Fetch all dashboard data in one API call
      const response = await fetch(`${API_BASE}/api/dashboard/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStreakData(data.streak);
        setTodaysSchedule(data.todaysSchedule);
        setTemplates(data.templates);
      } else {
        console.error('Failed to fetch dashboard data:', response.status, response.statusText);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate streak calendar (last 7 days)
  const getStreakDays = () => {
    if (!streakData) return [];

    const days = [];
    const today = new Date();

    // Get current day of week (0 = Sunday, 6 = Saturday)
    const currentDayOfWeek = today.getDay();

    // Calculate days from last Sunday to today
    for (let i = currentDayOfWeek; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      days.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        active: i < streakData.currentStreak && i <= currentDayOfWeek
      });
    }

    // Add remaining days until Saturday if needed
    const daysUntilSaturday = 6 - currentDayOfWeek;
    for (let i = 1; i <= daysUntilSaturday; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      days.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        active: false // Future days can't be active
      });
    }

    return days;
  };

  const streakDays = getStreakDays();

  const handleQuickStart = (type: 'focus' | 'break') => {
    console.log(`Starting ${type} session`);
    navigate('/focus-session');
  };

  const handleTemplateSelect = (templateId: number) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      localStorage.setItem('selectedTemplate', JSON.stringify(template));
    }
    navigate('/focus-session');
  };

  const handleScheduleStart = (itemId: string) => {
    console.log(`Starting scheduled session: ${itemId}`);
    navigate('/focus-session');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#204972]"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome{userName ? `, ${userName}` : ''}!
          </h1>
          <p className="text-lg text-gray-600">
            {currentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Streak Section - Featured */}
        {streakData && (
          <div className="bg-gradient-to-r from-[#204972] to-[#142f4b] rounded-2xl p-8 mb-8 text-white shadow-lg">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                    <Award className="w-8 h-8" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-bold leading-tight">{streakData.currentStreak} Day Streak! 🔥</h2>
                    <p className="text-white/90 text-sm">Keep the momentum going</p>
                  </div>
                </div>

                {/* Mini Stats */}
                <div className="flex flex-wrap gap-6 mt-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                    <p className="text-white/80 text-xs mb-1">Longest Streak</p>
                    <p className="text-2xl font-bold">{streakData.longestStreak} days</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                    <p className="text-white/80 text-xs mb-1">Total Active Days</p>
                    <p className="text-2xl font-bold">{streakData.totalDays} days</p>
                  </div>
                </div>
              </div>

              {/* Last 7 Days Visualization */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <p className="text-white/90 text-sm font-medium mb-4">Last 7 Days</p>
                <div className="flex gap-2">
                  {streakDays.map((day, index) => (
                    <div key={index} className="flex flex-col items-center gap-2">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm transition-all ${
                          day.active 
                            ? 'bg-white text-[#204972] shadow-lg scale-110' 
                            : 'bg-white/20 text-white/60'
                        }`}
                      >
                        {day.dayName.charAt(0)}
                      </div>
                      {day.active && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-[#204972]" />
            Quick Start
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleQuickStart('focus')}
              className="bg-gradient-to-r from-[#204972] to-[#142f4b] hover:from-[#142f4b] hover:to-[#0d1f2d] text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <Clock className="w-8 h-8" />
              </div>
              <h4 className="font-semibold text-lg mb-1">Start Focus Session</h4>
              <p className="text-blue-200 text-sm">Stay on task, distraction free</p>
            </button>

            <button
              onClick={() => navigate('/calendar')}
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <Calendar className="w-8 h-8" />
              </div>
              <h4 className="font-semibold text-lg mb-1">Schedule a Session</h4>
              <p className="text-yellow-200 text-sm">Plan your focus time ahead</p>
            </button>

            <button
              onClick={() => navigate('/sessions')}
              className="bg-white hover:bg-gray-50 text-gray-900 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 text-left border-2 border-gray-200 group"
            >
              <div className="flex items-center justify-between mb-3">
                <Plus className="w-8 h-8 text-[#204972]" />
              </div>
              <h4 className="font-semibold text-lg mb-1">Create Session</h4>
              <p className="text-gray-600 text-sm">Design your custom routine</p>
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Today's Schedule */}
          <div className="lg:col-span-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#204972]" />
              Today's Schedule
            </h3>
            <div className="space-y-3">
              {todaysSchedule.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">No sessions scheduled</p>
                  <button
                    onClick={() => navigate('/calendar')}
                    className="text-[#204972] hover:text-[#142f4b] text-sm font-medium"
                  >
                    Schedule a session →
                  </button>
                </div>
              ) : (
                todaysSchedule.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-5 border border-gray-200 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-3 h-3 rounded-full ${
                            item.type === 'focus' ? 'bg-[#204972]' : 'bg-emerald-500'
                          }`}></div>
                          <span className="text-sm font-medium text-gray-500">{item.time}</span>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                        <p className="text-sm text-gray-600">
                          {item.duration} • {item.type === 'focus' ? 'Focus' : 'Break'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleScheduleStart(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#204972] hover:bg-[#142f4b] text-white p-2 rounded-lg"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Session Templates */}
          <div className="lg:col-span-2">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#204972]" />
              Session Templates
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.length === 0 ? (
                <div className="col-span-2 bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                  <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">No templates yet</p>
                  <button
                    onClick={() => window.location.href = '/sessions'}
                    className="text-[#204972] hover:text-[#142f4b] text-sm font-medium"
                  >
                    Create your first template →
                  </button>
                </div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-md hover:border-[#204972] transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h4 className="font-semibold text-gray-900 text-lg">{template.name}</h4>
                      <div className="bg-blue-100 group-hover:bg-[#204972] text-[#204972] group-hover:text-white rounded-full p-2 transition-colors">
                        <Play className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#204972]" />
                        <span>{template.focus_duration}m focus / {template.break_duration}m break</span>
                      </div>
                      {template.description && (
                        <p className="text-gray-500 text-xs mt-2">{template.description}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;