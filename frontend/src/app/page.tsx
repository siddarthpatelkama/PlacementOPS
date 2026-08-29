'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Briefcase,
  Mail,
  FileText,
  Sparkles,
  BookOpen,
  Sun,
  Moon,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LandingPage() {
  const supabase = createClient();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Theme
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('placementops-theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('placementops-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('placementops-theme', 'light');
    }
  };

  // Redirect if already authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      } else {
        setChecking(false);
      }
    });
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/60 px-6 lg:px-10 py-4 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white dark:text-neutral-900" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">PlacementOps</h1>
            <p className="text-[10px] text-neutral-400 font-medium tracking-widest uppercase">Autonomous Agent</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all shadow-sm" aria-label="Toggle theme">
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-neutral-500" />}
          </button>
          <Link href="/login" className="px-4 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-[0.98] transition-all shadow-sm">
            Sign In
          </Link>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 md:py-28">
        <div className="max-w-3xl w-full text-center animate-fade-up">
          <span className="inline-block px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide mb-6">
            AI-Powered Placement Agent
          </span>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] text-neutral-900 dark:text-white mb-6">
            Never miss a{' '}
            <span className="text-neutral-400 dark:text-neutral-500">placement offer.</span>
          </h2>

          <p className="text-neutral-500 dark:text-neutral-400 text-base md:text-lg leading-relaxed max-w-xl mx-auto mb-10">
            PlacementOps monitors your inbox, extracts recruiter emails, matches JD criteria against your resume, and drafts tailored cover letters — autonomously.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link href="/login" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-[0.98] transition-all shadow-sm">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Feature Grid */}
          <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto stagger">
            {[
              { icon: Mail, title: 'Gmail Monitoring', desc: 'Autonomous email polling and alerts' },
              { icon: FileText, title: 'Vector Resume', desc: 'Parsed and stored as embeddings' },
              { icon: Sparkles, title: 'Match Scoring', desc: 'Cosine similarity + CGPA checks' },
              { icon: BookOpen, title: 'Cover Letters', desc: 'AI-generated, gap-aware materials' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 items-start p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-none transition-colors animate-fade-up">
                <div className="mt-0.5 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                  <Icon className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{title}</h4>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 text-center flex-shrink-0">
        <p className="text-[10px] text-neutral-400 font-medium">PlacementOps · Autonomous Placement Agent</p>
      </footer>
    </div>
  );
}
