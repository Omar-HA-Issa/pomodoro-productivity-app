// src/components/ui/Navigation.tsx
import React from "react";
import { NavLink } from "react-router-dom";

const Navigation: React.FC = () => {
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1 rounded-md transition-colors ${
      isActive
        ? "text-white bg-gradient-to-r from-navy-600 to-navy-800"
        : "text-navy-700 hover:bg-slate-100"
    }`;

  return (
    <nav className="sticky top-0 bg-white border-b z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="text-lg font-semibold">
          <span className="bg-gradient-to-r from-navy-600 to-navy-800 bg-clip-text text-transparent">Pomodoro</span>
        </div>
        <div className="flex gap-2">
          <NavLink to="/" end className={link}>Dashboard</NavLink>
          <NavLink to="/sessions" className={link}>Sessions</NavLink>
          <NavLink to="/calendar" className={link}>Calendar</NavLink>
          <NavLink to="/focus-session" className={link}>Focus Session</NavLink>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
