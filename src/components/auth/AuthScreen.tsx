'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/store/chatStore';
import { Eye, EyeOff } from 'lucide-react';

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setCurrentUser = useChatStore(state => state.setCurrentUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'User not found' && isLogin) {
          setError('No account found — want to create one?');
        } else {
          setError(data.error || 'Authentication failed');
        }
        return;
      }

      setCurrentUser(data.user);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Animated Gradient Orbs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-500/20 dark:bg-indigo-600/20 blur-[100px] rounded-full animate-pulse"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-purple-500/20 dark:bg-purple-600/20 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl sm:rounded-[2rem] shadow-2xl border border-white/40 dark:border-slate-700/50 p-6 sm:p-10 transition-all duration-500">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-6 shadow-lg shadow-indigo-500/30">
            <span className="text-3xl">💬</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 font-medium">
            Enter your details below to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Username
            </label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={loading}
              className="h-14 rounded-full bg-slate-900/50 dark:bg-slate-900/50 text-white placeholder:text-slate-400 border-white/10 focus-visible:ring-indigo-500/50 px-6 font-medium backdrop-blur-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                className="h-14 rounded-full bg-slate-900/50 dark:bg-slate-900/50 text-white placeholder:text-slate-400 border-white/10 focus-visible:ring-indigo-500/50 px-6 pr-12 font-medium backdrop-blur-md"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors focus:outline-none"
                tabIndex={-1}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {!isLogin && password.length < 6 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1 transition-all">
                <span className="opacity-70">ℹ</span> Password must be at least 6 characters
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              {error === 'No account found — want to create one?' && (
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setError(''); }}
                  className="font-medium underline decoration-red-300 underline-offset-2"
                >
                  Sign up
                </button>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-md mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 rounded-xl font-semibold"
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Log in' : 'Sign up')}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? (
            <p>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Log in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
