import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import Navigation from "./components/Navigation";
import ProtectedRoute from "./components/ProtectedRoute";
import FullScreenLoader from "./components/FullScreenLoader";

import { useAuth } from "./hooks/useAuth";

// Public pages
import Login from "./pages/auth_pages/Login";
import SignUp from "./pages/auth_pages/SignUp";
import ForgotPassword from "./pages/auth_pages/ForgotPassword";
import ResetPassword from "./pages/auth_pages/ResetPassword";

// Private pages
import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import Schedule from "./pages/Schedule";
import Focus from "./pages/Focus";
import Insights from "./pages/Insights";

import "./App.css";

const App: React.FC = () => {
  return (
    <Routes>
      {/* PUBLIC ROUTES */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* PRIVATE ROUTES */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions" element={<Templates />} />
          <Route path="/calendar" element={<Schedule />} />
          <Route path="/focus-session" element={<Focus />} />
          <Route path="/insights" element={<Insights />} />
        </Route>
      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const PublicRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

const AppLayout: React.FC = () => (
  <>
    <Navigation />
    <main className="pb-8">
      <Outlet />
    </main>
  </>
);

export default App;
