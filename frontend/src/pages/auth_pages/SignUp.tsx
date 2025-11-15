import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from "../../hooks/useAuth";

const requirements = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [pw, setPw]               = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const passed = useMemo(() => requirements.filter(r => r.test(pw)), [pw]);
  const strengthPct = (passed.length / requirements.length) * 100;
  const strengthLabel = strengthPct < 40 ? 'Weak' : strengthPct < 80 ? 'Good' : 'Strong';
  const strengthColor = strengthPct < 40 ? 'bg-red-500' : strengthPct < 80 ? 'bg-yellow-500' : 'bg-emerald-500';
  const match = pw === confirm && confirm !== '';
  const allGood = !!firstName.trim() && passed.length === requirements.length && match;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allGood) {
      setErr('Please enter your first name and meet all password requirements.');
      return;
    }

    setLoading(true);
    setErr('');

    const { error } = await signUp(email, pw, {
      first_name: firstName.trim(),
      last_name: lastName.trim() === '' ? undefined : lastName.trim(),
    });

    setLoading(false);
    if (error) setErr(error);
    else setOk(true); // show success screen (no email confirmation)
  };

  // Success screen: "Thanks for Signing Up" → button routes to Login
  if (ok) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-emerald-600 text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Thanks for Signing Up!</h1>
            <p className="text-gray-600 mb-6">
              Your account has been created successfully. You can now log in and start using Pomodoro.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gradient-to-r from-[#204972] to-[#142f4b] text-white py-3 px-4 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            Join <span className="bg-gradient-to-r from-[#204972] to-[#142f4b] bg-clip-text text-transparent">Pomodoro</span>
          </h1>
          <p className="text-gray-600">Create your account to get started</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          {err && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{err}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">First name</label>
                <input
                  id="firstName"
                  type="text"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-all"
                  placeholder="Omar"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">Last name (optional)</label>
                <input
                  id="lastName"
                  type="text"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-all"
                  placeholder="Issa"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                id="email"
                type="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-all"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="pw" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  id="pw"
                  type={showPw ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-20 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-all"
                  placeholder="Create a password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>

              {!!pw && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Password strength</span>
                    <span className={`text-sm font-medium ${strengthPct < 40 ? 'text-red-500' : strengthPct < 80 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                      {strengthLabel}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${strengthColor}`} style={{ width: `${strengthPct}%` }} />
                  </div>
                </div>
              )}
            </div>

            {!!pw && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Password requirements:</p>
                {requirements.map((r) => {
                  const ok = r.test(pw);
                  return (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className={`inline-block w-4 text-center ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>{ok ? '✓' : '•'}</span>
                      <span className={`text-sm ${ok ? 'text-emerald-600' : 'text-gray-500'}`}>{r.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-20 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#204972] focus:border-transparent transition-all"
                  placeholder="Confirm your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>

              {!!confirm && (
                <div className="mt-2 text-sm">
                  {match ? <span className="text-emerald-600">Passwords match</span> : <span className="text-red-600">Passwords do not match</span>}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !allGood}
              className="w-full bg-gradient-to-r from-[#204972] to-[#142f4b] text-white py-3 px-4 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <span className="inline-block h-5 w-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />}
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-[#204972] hover:text-[#142f4b] font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
