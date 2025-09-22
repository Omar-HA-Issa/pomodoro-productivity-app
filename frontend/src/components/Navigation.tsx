import React from 'react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface Tab {
  id: string;
  label: string;
}

/**
 * Navigation component for the Pomodoro application
 * Full-width gradient background with centered inner content
 */
const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const tabs: Tab[] = [
    { id: 'home', label: 'Home' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'focus-session', label: 'Focus Session' },
  ];

  return (
    <nav className="w-full bg-gradient-to-r from-[#204972] to-[#142f4b] border-b border-white/20 sticky top-0 z-50">
      {/* Inner content centered + padded */}
      <div className="mx-auto max-w-7xl flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex-shrink-0">
          <h1 className="text-xl font-bold text-white">FocusFlow</h1>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-[#204972] shadow-md'
                  : 'text-white hover:bg-white/10 border border-white/20'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
