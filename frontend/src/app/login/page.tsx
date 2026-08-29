'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) setError(error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4 transition-colors duration-300">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm dark:shadow-none transition-colors duration-300">
        <div>
          <h2 className="text-center text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Sign in to PlacementOps
          </h2>
          <p className="text-center text-sm text-neutral-400 dark:text-neutral-500 mt-2">
            Enter your credentials to access your dashboard
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleEmailLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                required
                className="block w-full rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:border-neutral-900 dark:focus:border-neutral-400 px-4 py-3 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 transition-all duration-200"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                required
                className="block w-full rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:border-neutral-900 dark:focus:border-neutral-400 px-4 py-3 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 transition-all duration-200"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-3 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-[0.98] transition-all duration-200 shadow-sm"
          >
            Sign in with Email
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200 dark:border-neutral-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white dark:bg-neutral-900 px-3 text-neutral-400">or</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full rounded-xl bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all duration-200"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
