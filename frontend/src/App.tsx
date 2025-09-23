import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import SessionsPage from './pages/SessionsPage';
import CalendarPage from './pages/CalendarPage';
import FocusSessionPage from './pages/FocusSessionPage';
import LoginPage from './pages/auth_pages/LoginPage';
import SignupPage from './pages/auth_pages/SignUpPage';
import ForgotPasswordPage from './pages/auth_pages/ForgotPasswordPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import ResetPasswordPage from "./pages/auth_pages/ResetPasswordPage";
import './App.css';

const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#204972] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/signup" element={!user ? <SignupPage /> : <Navigate to="/" replace />} />
        <Route path="/forgot-password" element={!user ? <ForgotPasswordPage /> : <Navigate to="/" replace />} />
        <Route path="/reset-password" element={!user ? <ResetPasswordPage /> : <Navigate to="/" replace />} />


        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Navigation />
              <main className="pb-8">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/sessions" element={<SessionsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/focus-session" element={<FocusSessionPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
};

export default App;
