import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, Eye, EyeOff, Atom, FlaskConical, Calculator, Dna, Download } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isInstallable, installApp } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const success = await login(email, password);
      if (!success) {
        setError('Invalid email or password. Access is restricted to authorized accounts.');
      }
    } catch (err) {
      setError('Login failed. Please check your connection or credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        {/* Floating icons */}
        <div className="absolute top-16 left-10 text-blue-400/20 animate-bounce" style={{ animationDelay: '0.5s' }}><Atom size={40} /></div>
        <div className="absolute top-24 right-16 text-indigo-400/20 animate-bounce" style={{ animationDelay: '1.2s' }}><FlaskConical size={36} /></div>
        <div className="absolute bottom-24 left-16 text-cyan-400/20 animate-bounce" style={{ animationDelay: '0.8s' }}><Calculator size={38} /></div>
        <div className="absolute bottom-16 right-12 text-purple-400/20 animate-bounce" style={{ animationDelay: '1.5s' }}><Dna size={42} /></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl shadow-2xl shadow-orange-500/30 mb-4">
            <BookOpen size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">VidyaSphere</h1>
          <p className="text-blue-300 mt-1 text-sm font-medium">JEE • NEET Coaching Management System</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs font-medium">System Online</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-white font-semibold text-lg mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-blue-200 text-sm font-medium block mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value.toLowerCase().trim()); setError(''); }}
                placeholder="Enter your email"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
              />
            </div>
            <div>
              <label className="text-blue-200 text-sm font-medium block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing In...
                </>
              ) : 'Sign In →'}
            </button>
          </form>

          {/* Demo Login Shortcuts */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-blue-300 text-xs font-medium uppercase tracking-wider mb-3">Institutional Access</p>
            <div className="grid grid-cols-1 gap-2 text-center p-3 rounded-xl bg-white/5 border border-white/10">
               <p className="text-white/60 text-[10px] leading-relaxed">
                 Use your assigned unique credentials to access your dashboard. 
                 Master Admin control is restricted to authorized personnel.
               </p>
            </div>
          </div>
        </div>

        {isInstallable && (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <button
              onClick={installApp}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white font-medium transition-all group"
            >
              <Download size={18} className="text-orange-400 group-hover:scale-110 transition-transform" />
              <span>Install VidyaSphere App</span>
            </button>
          </div>
        )}

        <p className="text-center text-white/20 text-xs mt-6">
          © 2025 VidyaSphere • India's Premier Coaching Management Platform
        </p>
      </div>
    </div>
  );
};
