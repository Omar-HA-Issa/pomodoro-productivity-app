import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import Schedule from './pages/Schedule';
import Focus from './pages/Focus';
import Login from './pages/auth_pages/Login';
import SignUp from './pages/auth_pages/SignUp';
import ForgotPassword from './pages/auth_pages/ForgotPassword';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import ResetPassword from "./pages/auth_pages/ResetPassword";
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
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/" replace />} />
        <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/" replace />} />
        <Route path="/reset-password" element={!user ? <ResetPassword /> : <Navigate to="/" replace />} />


        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Navigation />
              <main className="pb-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/sessions" element={<Templates />} />
                  <Route path="/calendar" element={<Schedule />} />
                  <Route path="/focus-session" element={<Focus />} />
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
