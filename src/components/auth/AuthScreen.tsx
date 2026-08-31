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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-comic-bg">
      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-comic border-4 border-comic-ink p-6 sm:p-10 transition-all duration-500 -rotate-1 hover:rotate-0">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-comic-teal border-4 border-comic-ink text-comic-ink mb-6 shadow-comic rotate-6">
            <span className="text-4xl">🤡</span>
          </div>
          <h1 className="text-4xl font-heading font-black text-comic-ink tracking-tight -rotate-2">
            {isLogin ? 'Welcome Back!' : 'Join the Circus!'}
          </h1>
          <p className="text-lg text-comic-ink/80 mt-3 font-bold">
            Enter your details below to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-heading font-bold text-comic-ink mb-2 uppercase tracking-wider">
              Username
            </label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={loading}
              className="h-14 rounded-xl bg-white text-comic-ink font-bold placeholder:text-comic-ink/50 border-4 border-comic-ink focus-visible:ring-4 focus-visible:ring-comic-pink px-6 shadow-[4px_4px_0px_#2B1B3D] transition-all focus-visible:-translate-y-1"
            />
          </div>
          <div>
            <label className="block text-sm font-heading font-bold text-comic-ink mb-2 uppercase tracking-wider">
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
                className="h-14 rounded-xl bg-white text-comic-ink font-bold placeholder:text-comic-ink/50 border-4 border-comic-ink focus-visible:ring-4 focus-visible:ring-comic-pink px-6 pr-14 shadow-[4px_4px_0px_#2B1B3D] transition-all focus-visible:-translate-y-1"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-comic-ink hover:text-comic-pink transition-colors focus:outline-none"
                tabIndex={-1}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
              </button>
            </div>
            {!isLogin && password.length < 6 && (
              <p className="text-xs font-bold text-comic-pink mt-3 flex items-center gap-1 transition-all">
                <span className="text-lg">🚨</span> Password must be at least 6 characters
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm font-bold text-comic-ink bg-comic-pink/50 border-4 border-comic-ink p-3 rounded-xl flex justify-between items-center shadow-comic-sm">
              <span>{error}</span>
              {error === 'No account found — want to create one?' && (
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setError(''); }}
                  className="underline decoration-comic-ink underline-offset-4 hover:text-white transition-colors"
                >
                  Sign up
                </button>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-16 text-xl mt-6 bg-comic-orange hover:bg-comic-orange text-comic-ink border-4 border-comic-ink shadow-comic transition-all duration-200 rounded-full font-heading font-black hover:-translate-y-1 hover:shadow-comic-hover uppercase tracking-wider rotate-1"
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Log in 🚀' : 'Sign up 🎉')}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm font-bold text-comic-ink/70">
          {isLogin ? (
            <p>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className="text-comic-pink font-black text-lg hover:underline decoration-4 underline-offset-4"
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
                className="text-comic-teal font-black text-lg hover:underline decoration-4 underline-offset-4"
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
