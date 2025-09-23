import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);      // token processed & session ready
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  // Wait for Supabase to pick up the recovery token from the URL and create a temp session.
  useEffect(() => {
    let mounted = true;

    (async () => {

      // If detectSessionInUrl=true in your client (it is), supabase-js will handle the URL on mount.
      // We just wait a tick and confirm a session exists (or not).
      await new Promise((r) => setTimeout(r, 100)); // small delay so supabase can parse URL
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        setErr("Invalid or expired reset link. Please request a new password reset.");
      }
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    if (pw.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pw !== confirm) {
      setErr("Passwords do not match.");
      return;
    }


    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);

    if (error) {
      setErr(error.message);
    } else {
      setDone(true);
    }
  };

  // Success screen
  if (done) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-emerald-600 text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Password Updated</h1>
            <p className="text-gray-600 mb-6">
              You can now sign in with your new password.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-gradient-to-r from-[#204972] to-[#142f4b] text-white py-3 px-4 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for token/session
  if (!ready) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="inline-block h-6 w-6 border-2 border-gray-300 border-t-[#204972] rounded-full animate-spin" />
            <p className="text-gray-600 mt-3">Preparing secure reset…</p>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold mb-2"
            style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
          >
            Set New{" "}
            <span className="bg-gradient-to-r from-[#204972] to-[#142f4b] bg-clip-text text-transparent">
              Password
            </span>
          </h1>
          <p className="text-gray-600">Choose a strong new password</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          {err && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label htmlFor="pw" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="pw"
                  type={showPw ? "text" : "password"}
                  className="w-full px-4 py-3 pr-20 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-all"
                  placeholder="Create a new password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  className="w-full px-4 py-3 pr-20 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-all"
                  placeholder="Confirm your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#204972] to-[#142f4b] text-white py-3 px-4 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && (
                <span className="inline-block h-5 w-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
              )}
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-[#204972] hover:text-[#142f4b] font-medium transition-colors">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
