import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/supabase';
import { DEFAULT_CATEGORIES } from '../utils/helpers';
import { createCategory, seedDemoData } from '../services/api';

export function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      if (name) {
        await supabase.from('profiles').upsert({ id: data.user.id, display_name: name });
      }
      try {
        const cats = await Promise.all(DEFAULT_CATEGORIES.map(c => createCategory(c)));
        seedDemoData(cats).catch(() => {});
      } catch (_) {}
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      {/* Decorative bg */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-2xl shadow-primary-900/60 border-2 border-gold-400/40 bg-white mb-4">
            <img
              src="/SpendSheriff-Budget_Tracker-New-Logo-77KB.jpg"
              alt="SpendSheriff"
              className="w-full h-full object-cover"
              style={{ objectPosition: '50% 10%', transform: 'scale(1.25)', transformOrigin: '50% 15%' }}
            />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Spend<span className="text-gold-400">Sheriff</span>
          </h1>
          <p className="text-sm text-primary-200 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-gold-400" />
            Your budget is under protection.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-primary-900/40 p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Create your account</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Start protecting your budget today</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="input"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-error-600 text-sm bg-error-50 dark:bg-error-900/20 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2 font-semibold text-base">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-primary-200 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-gold-400 font-semibold hover:text-gold-300 hover:underline transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
