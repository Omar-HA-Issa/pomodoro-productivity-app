import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const getActiveTab = () => {
    switch (location.pathname) {
      case '/': return 'home';
      case '/sessions': return 'sessions';
      case '/calendar': return 'calendar';
      case '/focus-session': return 'focus-session';
      default: return 'home';
    }
  };

  const handleTabClick = (tab: string) => {
    switch (tab) {
      case 'home': navigate('/'); break;
      case 'sessions': navigate('/sessions'); break;
      case 'calendar': navigate('/calendar'); break;
      case 'focus-session': navigate('/focus-session'); break;
    }
  };

  const handleSignOut = async () => { await signOut(); };

  const activeTab = getActiveTab();

  return (
    <nav className="sticky top-0 bg-white border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#204972] to-[#142f4b] bg-clip-text text-transparent">
              Pomodoro
            </h1>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1">
            {[
              { key: 'home', label: 'Home' },
              { key: 'sessions', label: 'Manage Sessions' },
              { key: 'calendar', label: 'Calendar' },
              { key: 'focus-session', label: 'Focus Session' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-[#204972] to-[#142f4b] text-white'
                    : 'text-[#204972] hover:bg-[#f5f7fa] border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center">
            <button
              onClick={handleSignOut}
              className="text-sm text-[#204972] hover:text-[#142f4b] font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;