'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  User,
  Briefcase,
  Mail,
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ChevronRight,
  Copy,
  PlusCircle,
  Loader2,
  UserCheck,
  Sparkles,
  Search,
  Check,
  Sun,
  Moon,
  X,
  BookOpen
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ResumeUpload from '@/components/ResumeUpload';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  // Session
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Dashboard states
  const [hasResume, setHasResume] = useState(false);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);

  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  const [copiedText, setCopiedText] = useState(false);
  const [messageAlert, setMessageAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Gmail callback URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('gmail_connected') === 'true') {
        showAlert('success', 'Gmail connected. Background monitoring active.');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlParams.get('gmail_error') === 'true') {
        showAlert('error', 'Gmail authorization failed. Please try again.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile + jobs when session ready
  useEffect(() => {
    if (session?.user) {
      fetchStudentProfile();
      fetchJobMatches();
    }
  }, [session]);

  const showAlert = (type: 'success' | 'error', text: string) => {
    setMessageAlert({ type, text });
    setTimeout(() => setMessageAlert(null), 5000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  /* ─── API: Student Profile ─── */
  const fetchStudentProfile = async () => {
    if (!session?.user) return;
    try {
      const { data: publicUser } = await supabase
        .from('users')
        .select('google_refresh_token')
        .eq('id', session.user.id)
        .maybeSingle();

      if (publicUser?.google_refresh_token) setGmailConnected(true);

      const { data: profile } = await supabase
        .from('student_profiles')
        .select('cgpa, raw_resume_text')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile) {
        setHasResume(true);
      } else {
        setHasResume(false);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
    }
  };

  /* ─── API: Job Matches ─── */
  const fetchJobMatches = async () => {
    if (!session?.user) return;
    setIsLoadingJobs(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/jobs/matched/${session.user.id}`);
      const data = await res.json();
      if (data.success) {
        setMatchedJobs(data.matches || []);
        if (selectedJob) {
          const updated = data.matches.find((m: any) => m.job_id === selectedJob.job_id);
          if (updated) setSelectedJob(updated);
        }
      }
    } catch (err: any) {
      console.error('Error fetching jobs:', err.message);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  /* ─── API: Gmail Sync ─── */
  const handleSyncGmail = async () => {
    if (!session?.user) return;
    if (!gmailConnected) {
      showAlert('error', 'Please connect your Google Account first.');
      return;
    }
    setIsSyncingGmail(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/webhooks/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        const syncResult = data.results?.find((r: any) => r.user === session.user.email);
        showAlert('success', `Gmail sync complete. ${syncResult?.synced_jobs || 0} new role(s).`);
        fetchJobMatches();
      } else {
        showAlert('error', data.error || 'Failed to sync Gmail.');
      }
    } catch (err: any) {
      showAlert('error', 'Network error during Gmail sync.');
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleCopyCoverLetter = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleConnectGmail = () => {
    if (!session?.user) return;
    window.location.href = `${BACKEND_URL}/api/auth/google?userId=${session.user.id}`;
  };

  const getMatchScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {score}%
        </span>
      );
    } else if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {score}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        {score}%
      </span>
    );
  };

  /* ─── LOADING ─── */
  if (loadingSession) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-white dark:bg-neutral-950">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        <p className="text-neutral-400 text-sm">Loading...</p>
      </div>
    );
  }

  /* ─── RENDER ─── */
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">

      {/* ─── TOAST ─── */}
      {messageAlert && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-down ${
          messageAlert.type === 'success'
            ? 'bg-white dark:bg-neutral-900 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-white dark:bg-neutral-900 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {messageAlert.type === 'success'
            ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
          <span className="text-sm font-medium">{messageAlert.text}</span>
          <button onClick={() => setMessageAlert(null)} className="ml-2 p-0.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/60 px-6 lg:px-10 py-4 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white dark:text-neutral-900" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">PlacementOps</h1>
            <p className="text-[10px] text-neutral-400 font-medium tracking-widest uppercase">Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all shadow-sm" aria-label="Toggle theme">
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-neutral-500" />}
          </button>

          {session?.user && (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                <User className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium max-w-[180px] truncate">{session.user.email}</span>
              </div>
              <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-200 dark:hover:border-red-900/40 transition-all">
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* ─── MAIN GRID ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-10 grid md:grid-cols-12 gap-6 lg:gap-8">

        {/* ── LEFT SIDEBAR ── */}
        <section className="md:col-span-4 flex flex-col gap-6">

          {/* Gmail Card */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors animate-fade-up">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4 tracking-tight">
              <Mail className="w-4 h-4 text-neutral-400" /> Gmail Monitoring
            </h3>
            {gmailConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Connected</p>
                    <p className="text-[10px] text-neutral-500">Autonomous polling active</p>
                  </div>
                </div>
                <button onClick={handleSyncGmail} disabled={isSyncingGmail} className="w-full flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 disabled:opacity-40 py-2.5 rounded-xl text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-[0.98] transition-all">
                  {isSyncingGmail ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...</> : <><RefreshCw className="w-3.5 h-3.5" /> Sync Inbox</>}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Not Connected</p>
                    <p className="text-[10px] text-neutral-500">Read-only Gmail access required</p>
                  </div>
                </div>
                <button onClick={handleConnectGmail} className="w-full flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2.5 rounded-xl text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-[0.98] transition-all">
                  Connect Google Account
                </button>
              </div>
            )}
          </div>

          {/* Resume Card */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors flex-1 flex flex-col animate-fade-up" style={{ animationDelay: '80ms' }}>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4 tracking-tight">
              <FileText className="w-4 h-4 text-neutral-400" /> Resume Profile
            </h3>
            {hasResume ? (
              <div className="mb-4 flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Vector Active</p>
                  <p className="text-[10px] text-neutral-400">Ready for job matching</p>
                </div>
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">No Resume</p>
                  <p className="text-[10px] text-neutral-500">Upload your PDF to start matching</p>
                </div>
              </div>
            )}
            
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ResumeUpload onUploadSuccess={() => { fetchStudentProfile(); fetchJobMatches(); }} />
            </div>
          </div>
        </section>

        {/* ── RIGHT PANELS ── */}
        <section className="md:col-span-8 grid md:grid-cols-2 gap-6 items-start">

          {/* Pipeline */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex flex-col h-[650px] shadow-sm dark:shadow-none transition-colors animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2 tracking-tight">
                <Briefcase className="w-4 h-4 text-neutral-400" /> Pipeline
              </h3>
              <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-md font-mono">{matchedJobs.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {isLoadingJobs ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin" /><span className="text-xs">Loading...</span>
                </div>
              ) : matchedJobs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                  <Search className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                  <div>
                    <p className="text-xs font-semibold text-neutral-500">No roles yet</p>
                    <p className="text-[10px] text-neutral-400 mt-1 max-w-[200px]">Connect Gmail and sync, or upload your resume to start matching.</p>
                  </div>
                </div>
              ) : (
                matchedJobs.map((job) => {
                  const isSelected = selectedJob?.job_id === job.job_id;
                  return (
                    <div key={job.job_id} onClick={() => setSelectedJob(job)}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white dark:text-neutral-900 shadow-md'
                          : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
                      }`}>
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <h4 className={`text-xs font-bold max-w-[170px] truncate ${isSelected ? 'text-white dark:text-neutral-900' : 'text-neutral-800 dark:text-neutral-200'}`}>{job.role}</h4>
                          <p className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-neutral-300 dark:text-neutral-500' : 'text-neutral-500'}`}>{job.company_name}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 dark:bg-neutral-900/20' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>{job.match_score}%</span>
                      </div>
                      <div className={`mt-3 flex items-center justify-between text-[9px] border-t pt-2.5 ${isSelected ? 'border-white/20 dark:border-neutral-900/20 text-neutral-300 dark:text-neutral-500' : 'border-neutral-200 dark:border-neutral-600 text-neutral-400'}`}>
                        <span>Deadline: {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'N/A'}</span>
                        <span className="flex items-center gap-0.5">Details <ChevronRight className="w-3 h-3" /></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Job Detail */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 h-[650px] flex flex-col shadow-sm dark:shadow-none transition-colors animate-fade-up" style={{ animationDelay: '160ms' }}>
            {selectedJob ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4 flex-shrink-0">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <div>
                      <h3 className="text-sm font-black text-neutral-900 dark:text-white tracking-tight">{selectedJob.role}</h3>
                      <p className="text-xs text-neutral-500 font-semibold mt-0.5">{selectedJob.company_name}</p>
                    </div>
                    {getMatchScoreBadge(selectedJob.match_score)}
                  </div>
                  {selectedJob.deadline && (
                    <p className="text-[10px] text-neutral-400">Deadline: <span className="text-neutral-700 dark:text-neutral-200">{new Date(selectedJob.deadline).toLocaleDateString()}</span></p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 min-h-0">
                  {/* Skills */}
                  <div>
                    <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2.5">Skills</h4>
                    {selectedJob.status === 'needs_profile' ? (
                      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl text-[10px] text-red-700 dark:text-red-400">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" /><span>Upload resume to compute skills.</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <span className="text-[9px] text-neutral-500 font-semibold block mb-1.5">Required:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {(selectedJob.required_skills || []).length === 0
                              ? <span className="text-xs text-neutral-400">None extracted.</span>
                              : (selectedJob.required_skills || []).map((skill: string) => {
                                  const isMissing = (selectedJob.missing_skills || []).includes(skill);
                                  return (
                                    <span key={skill} className={`px-2 py-0.5 rounded-md text-[9px] font-semibold border ${isMissing ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                                      {skill} {isMissing ? '✗' : '✓'}
                                    </span>
                                  );
                                })}
                          </div>
                        </div>
                        {(selectedJob.missing_skills || []).length > 0 && (
                          <div>
                            <span className="text-[9px] text-red-500 font-semibold block mb-1.5">Gaps:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedJob.missing_skills.map((skill: string) => (
                                <span key={skill} className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400">{skill}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Cover Letter */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Cover Letter</h4>
                      {selectedJob.generated_cover_letter && selectedJob.status !== 'needs_profile' && (
                        <button onClick={() => handleCopyCoverLetter(selectedJob.generated_cover_letter)} className="flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[9px] font-semibold text-neutral-600 dark:text-neutral-300 transition-all">
                          {copiedText ? <><Check className="w-3 h-3 text-emerald-500" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                        </button>
                      )}
                    </div>
                    <div className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 font-mono text-[10px] leading-relaxed text-neutral-600 dark:text-neutral-400 overflow-y-auto whitespace-pre-wrap min-h-[200px] transition-colors">
                      {selectedJob.generated_cover_letter || 'No cover letter generated.'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <FileText className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mb-3" />
                <p className="text-xs font-semibold text-neutral-500">No Role Selected</p>
                <p className="text-[10px] text-neutral-400 max-w-[220px] mt-1">Select a role from the pipeline to view details.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 text-center flex-shrink-0">
        <p className="text-[10px] text-neutral-400 font-medium">PlacementOps · Autonomous Placement Agent</p>
      </footer>
    </div>
  );
}
