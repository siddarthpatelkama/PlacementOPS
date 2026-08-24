'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  BookOpen, 
  Sparkles,
  Search,
  Check,
  Award
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function Home() {
  // Authentication states
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // Dashboard states
  const [cgpa, setCgpa] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const [currentCgpa, setCurrentCgpa] = useState<number | null>(null);
  
  const [gmailConnected, setGmailConnected] = useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  
  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  
  const [copiedText, setCopiedText] = useState(false);
  const [messageAlert, setMessageAlert] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Parse URL query parameters for Gmail connection callbacks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('gmail_connected') === 'true') {
        showAlert('success', 'Gmail account connected successfully! Background monitoring is active.');
        // Clean url query parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlParams.get('gmail_error') === 'true') {
        showAlert('error', 'Failed to authorize Gmail account. Please try again.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Monitor Supabase Auth Session
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

  // Fetch student profile and matches when session becomes available
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

  // Auth: Email/Password login or registration
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    
    if (!email || !password) {
      setAuthError('Please fill in all fields.');
      return;
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthMessage('Registration successful! Please check your email to confirm your account (or log in directly if auto-confirmed).');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication.');
    }
  };

  // Auth: Sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setMatchedJobs([]);
    setSelectedJob(null);
    setHasResume(false);
    setGmailConnected(false);
  };

  // Dashboard API: Fetch student profile (resume text and CGPA)
  const fetchStudentProfile = async () => {
    if (!session?.user) return;
    try {
      // Direct query public.users table to see if gmail refresh token is present
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      const { data: publicUser, error: publicUserError } = await supabase
        .from('users')
        .select('google_refresh_token')
        .eq('id', session.user.id)
        .maybeSingle();

      if (publicUser?.google_refresh_token) {
        setGmailConnected(true);
      }

      // Query student profiles
      const { data: profile, error: profileError } = await supabase
        .from('student_profiles')
        .select('cgpa, raw_resume_text')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile) {
        setHasResume(true);
        setCurrentCgpa(profile.cgpa ? parseFloat(profile.cgpa) : null);
        setCgpa(profile.cgpa ? profile.cgpa.toString() : '');
        setResumeText(profile.raw_resume_text || '');
      } else {
        setHasResume(false);
      }
    } catch (err: any) {
      console.error('Error fetching student profile:', err.message);
    }
  };

  // Dashboard API: Fetch job matches from backend
  const fetchJobMatches = async () => {
    if (!session?.user) return;
    setIsLoadingJobs(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/jobs/matched/${session.user.id}`);
      const data = await res.json();
      if (data.success) {
        setMatchedJobs(data.matches || []);
        // Maintain selection if already selected
        if (selectedJob) {
          const updatedSelected = data.matches.find((m: any) => m.job_id === selectedJob.job_id);
          if (updatedSelected) setSelectedJob(updatedSelected);
        }
      }
    } catch (err: any) {
      console.error('Error fetching job matches:', err.message);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Dashboard API: Upload resume text & CGPA to backend for vectorization
  const handleUploadResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user || !resumeText) {
      showAlert('error', 'Please enter your resume details.');
      return;
    }

    setIsUploadingResume(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/profile/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          cgpa: cgpa ? parseFloat(cgpa) : null,
          rawResumeText: resumeText
        })
      });

      const data = await response.json();
      if (data.success) {
        setHasResume(true);
        setCurrentCgpa(cgpa ? parseFloat(cgpa) : null);
        showAlert('success', 'Resume parsed and vectorized successfully!');
        fetchJobMatches(); // Re-trigger match evaluations
      } else {
        showAlert('error', data.error || 'Failed to process resume.');
      }
    } catch (err: any) {
      console.error('Error uploading resume:', err);
      showAlert('error', 'Network error. Could not connect to backend.');
    } finally {
      setIsUploadingResume(false);
    }
  };

  // Dashboard API: Trigger Gmail email polling manually
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
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        const syncResult = data.results?.find((r: any) => r.user === session.user.email);
        const count = syncResult?.synced_jobs || 0;
        showAlert('success', `Gmail sync complete! Discovered and analyzed ${count} new role(s).`);
        fetchJobMatches();
      } else {
        showAlert('error', data.error || 'Failed to sync Gmail.');
      }
    } catch (err: any) {
      console.error('Error syncing Gmail:', err);
      showAlert('error', 'Network error during Gmail sync.');
    } finally {
      setIsSyncingGmail(false);
    }
  };

  // Copy cover letter to clipboard
  const handleCopyCoverLetter = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Triggers OAuth redirection to Google consent screen
  const handleConnectGmail = () => {
    if (!session?.user) return;
    window.location.href = `${BACKEND_URL}/api/auth/google?userId=${session.user.id}`;
  };

  // Color mappings for match scores
  const getMatchScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" /> High Match ({score}%)
        </span>
      );
    } else if (score >= 50) {
      return (
        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Medium Match ({score}%)
        </span>
      );
    } else {
      return (
        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Low Match ({score}%)
        </span>
      );
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col justify-center items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-gray-400 text-sm font-medium tracking-wide">Syncing Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] text-gray-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Alert Banners */}
      {messageAlert && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border ${
          messageAlert.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200' 
            : 'bg-rose-950/80 border-rose-500/30 text-rose-200'
        } backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4`}>
          {messageAlert.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
          <span className="text-sm font-medium">{messageAlert.text}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#070709]/80 border-b border-gray-800/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/10">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              PlacementOps
            </h1>
            <p className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">Autonomous Placement Agent</p>
          </div>
        </div>
        
        {session?.user && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 border border-gray-800/50 rounded-lg">
              <User className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-gray-300 font-medium max-w-[200px] truncate">{session.user.email}</span>
            </div>
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-900/50 text-red-400 rounded-lg text-xs font-semibold transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </header>

      {/* LANDING PAGE (LOGGED OUT) */}
      {!session ? (
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-20 relative overflow-hidden">
          {/* Background Ambient Glows */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
          
          <div className="max-w-6xl w-full grid md:grid-cols-12 gap-12 md:gap-16 items-center">
            
            {/* Left Column: Copy & Value Prop */}
            <div className="md:col-span-7 flex flex-col gap-6 text-left">
              <span className="self-start px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-semibold text-indigo-400 tracking-wide">
                🔥 AI-Powered Career Autopilot
              </span>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-white">
                Never Miss a <br />
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Placement Offer.
                </span>
              </h2>
              <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-xl">
                PlacementOps runs autonomously in the background. It monitors your college inbox, extracts recruiter emails, matches JD criteria against your vector-embedded resume, checks your CGPA eligibility, and drafts tailored cover letters on the fly.
              </p>
              
              {/* Feature grid */}
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div className="flex gap-3 items-start">
                  <div className="mt-1 p-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md">
                    <Mail className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-200">Gmail Monitoring</h4>
                    <p className="text-xs text-gray-500">Autonomous email polling and keyword alerts.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="mt-1 p-1 bg-purple-500/10 border border-purple-500/20 rounded-md">
                    <FileText className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-200">RAG Vector Hub</h4>
                    <p className="text-xs text-gray-500">Resume parsed and stored as high-dimensional vectors.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="mt-1 p-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-200">Match Scores</h4>
                    <p className="text-xs text-gray-500">Cosine similarity matching with hard CGPA thresholds.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="mt-1 p-1 bg-pink-500/10 border border-pink-500/20 rounded-md">
                    <BookOpen className="w-4 h-4 text-pink-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-200">Tailored Cover Letters</h4>
                    <p className="text-xs text-gray-500">AI-generated materials bridging your specific skill gaps.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Authentication Card */}
            <div className="md:col-span-5">
              <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-8 backdrop-blur-lg shadow-2xl relative">
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-12 h-12 bg-indigo-500/10 rounded-full blur-xl" />
                
                <h3 className="text-xl font-bold text-white mb-2">
                  {isSignUp ? 'Create your Account' : 'Welcome Back'}
                </h3>
                <p className="text-xs text-gray-500 mb-6">
                  {isSignUp ? 'Get started with autonomous placement tracking' : 'Enter credentials to access your agent dashboard'}
                </p>

                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@college.edu"
                      className="w-full bg-gray-950 border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-gray-950 border border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all duration-200"
                    />
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-lg text-xs font-medium text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {authMessage && (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-900/30 rounded-lg text-xs font-medium text-emerald-400 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{authMessage}</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transform active:scale-[0.98] transition-all duration-200"
                  >
                    {isSignUp ? 'Sign Up' : 'Sign In'}
                  </button>
                </form>

                <div className="relative flex py-5 items-center">
                  <div className="flex-grow border-t border-gray-800/60"></div>
                  <span className="flex-shrink mx-4 text-gray-600 text-xs">or</span>
                  <div className="flex-grow border-t border-gray-800/60"></div>
                </div>

                <button 
                  onClick={() => {
                    setAuthError('');
                    setAuthMessage('');
                    setIsSignUp(!isSignUp);
                  }}
                  className="w-full bg-transparent hover:bg-gray-800/40 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white font-medium py-2 rounded-lg text-sm transition-all duration-200"
                >
                  {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                </button>
              </div>
            </div>
            
          </div>
        </main>
      ) : (
        /* AGENT DASHBOARD (LOGGED IN) */
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid md:grid-cols-12 gap-8 overflow-y-auto">
          
          {/* LEFT SIDEBAR: PROFILE & CONFIG (4 Columns) */}
          <section className="md:col-span-4 flex flex-col gap-6">
            
            {/* Gmail Connection Status Card */}
            <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-5 backdrop-blur-sm">
              <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2 mb-4">
                <Mail className="w-4 h-4 text-indigo-400" />
                Gmail Monitoring Service
              </h3>
              
              {gmailConnected ? (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/25 rounded-lg flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-semibold text-emerald-400">Connection Connected</h4>
                      <p className="text-[10px] text-gray-500">Autonomous polling for hiring emails is active.</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleSyncGmail}
                    disabled={isSyncingGmail}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-900/40 border border-indigo-500/30 disabled:border-indigo-900/20 text-white py-2 rounded-lg text-xs font-bold transition-all duration-200"
                  >
                    {isSyncingGmail ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Syncing Gmail Inbox...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Trigger Gmail Polling
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-500/5 border border-amber-500/25 rounded-lg flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="text-xs font-semibold text-amber-400">Gmail Access Required</h4>
                      <p className="text-[10px] text-gray-500">To check JDs, the agent needs read-only Gmail access.</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleConnectGmail}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-550 hover:to-purple-550 text-white py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-200"
                  >
                    Connect Google Account
                  </button>
                </div>
              )}
            </div>

            {/* Vectorized Resume Hub Card */}
            <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-5 backdrop-blur-sm flex-1 flex flex-col">
              <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-purple-400" />
                Vectorized Resume Hub
              </h3>

              {hasResume ? (
                <div className="mb-4 p-3 bg-indigo-500/5 border border-indigo-500/25 rounded-lg flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h4 className="text-xs font-semibold text-indigo-400">Resume Vector Embedding Active</h4>
                    <p className="text-[10px] text-gray-500">
                      CGPA: <span className="font-bold text-gray-200">{currentCgpa}</span> | Embeddings: 768-D pgvector
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-red-500/5 border border-red-500/25 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div>
                    <h4 className="text-xs font-semibold text-red-400">Resume Missing</h4>
                    <p className="text-[10px] text-gray-500">Provide resume text below to run match metrics.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleUploadResume} className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4 flex-1 flex flex-col">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Academic CGPA (10-point scale)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      max="10"
                      value={cgpa}
                      onChange={(e) => setCgpa(e.target.value)}
                      placeholder="e.g. 8.42"
                      className="w-full bg-gray-950 border border-gray-800/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-700 outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Raw Resume Text / Skills List</label>
                    <textarea 
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Paste your resume details, technical stack, internships, projects, and education text here..."
                      className="w-full flex-1 min-h-[220px] bg-gray-950 border border-gray-800/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-700 outline-none resize-none transition-all duration-200"
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  disabled={isUploadingResume}
                  className="w-full flex items-center justify-center gap-2 mt-4 bg-gray-800 hover:bg-gray-750 disabled:bg-gray-900 border border-gray-700 disabled:border-gray-800 text-gray-100 disabled:text-gray-600 py-2 rounded-lg text-xs font-bold transition-all duration-200"
                >
                  {isUploadingResume ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving & Vectorizing Resume...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5" />
                      Save & Embed Profile
                    </>
                  )}
                </button>
              </form>
            </div>

          </section>

          {/* RIGHT PANELS: PIPELINE & DETAILS (8 Columns) */}
          <section className="md:col-span-8 grid md:grid-cols-2 gap-6 items-start">
            
            {/* Pipeline List View (1 Column on grid) */}
            <div className="bg-gray-900/20 border border-gray-800/40 rounded-xl p-5 flex flex-col h-[650px]">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                  Active Roles Pipeline
                </h3>
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                  {matchedJobs.length} roles
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {isLoadingJobs ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-xs">Loading matches...</span>
                  </div>
                ) : matchedJobs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6 text-gray-600">
                    <Search className="w-8 h-8 text-gray-700" />
                    <div>
                      <p className="text-xs font-bold text-gray-500">No Roles Processed</p>
                      <p className="text-[10px] mt-1">Connect Gmail and trigger polling, or set up your resume to evaluate matches.</p>
                    </div>
                  </div>
                ) : (
                  matchedJobs.map((job) => {
                    const isSelected = selectedJob?.job_id === job.job_id;
                    return (
                      <div 
                        key={job.job_id}
                        onClick={() => setSelectedJob(job)}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                          isSelected 
                            ? 'bg-indigo-950/20 border-indigo-500/50 shadow-md shadow-indigo-500/5' 
                            : 'bg-gray-900/35 border-gray-800/60 hover:bg-gray-900/50 hover:border-gray-750'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <h4 className="text-xs font-bold text-gray-100 max-w-[170px] truncate">{job.role}</h4>
                            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{job.company_name}</p>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded-md">
                            {job.match_score}% Match
                          </span>
                        </div>
                        
                        <div className="mt-3 flex items-center justify-between text-[9px] text-gray-500 border-t border-gray-800/40 pt-2.5">
                          <span className="flex items-center gap-1 font-medium">
                            Deadline: {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'N/A'}
                          </span>
                          <span className="flex items-center gap-1 text-gray-400 capitalize hover:text-white">
                            Details <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected Match Details View (1 Column on grid) */}
            <div className="bg-gray-900/20 border border-gray-800/40 rounded-xl p-5 h-[650px] flex flex-col">
              {selectedJob ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Job Header */}
                  <div className="border-b border-gray-800/40 pb-4 flex-shrink-0">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div>
                        <h3 className="text-sm font-black text-white">{selectedJob.role}</h3>
                        <p className="text-xs text-indigo-400 font-semibold mt-0.5">{selectedJob.company_name}</p>
                      </div>
                      {getMatchScoreBadge(selectedJob.match_score)}
                    </div>
                    {selectedJob.deadline && (
                      <p className="text-[10px] text-gray-500 font-medium">
                        Deadline: <span className="text-gray-300">{new Date(selectedJob.deadline).toLocaleDateString()}</span>
                      </p>
                    )}
                  </div>

                  {/* Scrollable details */}
                  <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 min-h-0">
                    
                    {/* Skill Gap Analysis Matrix */}
                    <div>
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2.5">Skills Matrix</h4>
                      
                      {selectedJob.status === 'needs_profile' ? (
                        <div className="p-3 bg-red-950/20 border border-red-900/20 rounded-lg text-[10px] text-red-400 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>No resume vectorized yet. Paste resume to compute skill gaps.</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Required skills */}
                          <div>
                            <span className="text-[9px] text-gray-500 font-bold block mb-1">Required Skills:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedJob.required_skills.length === 0 ? (
                                <span className="text-xs text-gray-600">None extracted.</span>
                              ) : (
                                selectedJob.required_skills.map((skill: string) => {
                                  const isMissing = selectedJob.missing_skills.includes(skill);
                                  return (
                                    <span 
                                      key={skill} 
                                      className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${
                                        isMissing 
                                          ? 'bg-rose-950/20 border-rose-900/30 text-rose-400' 
                                          : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'
                                      }`}
                                    >
                                      {skill} {isMissing ? '✗' : '✓'}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Missing skills specifically */}
                          {selectedJob.missing_skills.length > 0 && (
                            <div>
                              <span className="text-[9px] text-rose-400/80 font-bold block mb-1">Key Gaps Identified:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedJob.missing_skills.map((skill: string) => (
                                  <span key={skill} className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Generated Cover Letter Assets */}
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tailored Application Assets</h4>
                        
                        {selectedJob.generated_cover_letter && selectedJob.status !== 'needs_profile' && (
                          <button 
                            onClick={() => handleCopyCoverLetter(selectedJob.generated_cover_letter)}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-650 rounded text-[9px] font-bold text-gray-300 hover:text-white transition-all duration-150"
                          >
                            {copiedText ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy Cover Letter
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex-1 bg-gray-950/60 border border-gray-800/80 rounded-xl p-4 font-mono text-[10px] leading-relaxed text-gray-400 overflow-y-auto whitespace-pre-wrap min-h-[220px]">
                        {selectedJob.generated_cover_letter || 'No asset generated.'}
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-650">
                  <FileText className="w-10 h-10 text-gray-800 mb-2" />
                  <p className="text-xs font-bold text-gray-500">No Job Selected</p>
                  <p className="text-[10px] max-w-xs mt-1">Select a matched role from the pipeline to inspect match analytics, skills matrix, and cover letters.</p>
                </div>
              )}
            </div>

          </section>

        </main>
      )}

      {/* FOOTER */}
      <footer className="bg-[#070709] border-t border-gray-800/30 px-6 py-4 text-center flex-shrink-0">
        <p className="text-[10px] text-gray-600 font-medium">
          PlacementOps Platform • Autonomous Hackathon Agent Tier: Outstanding
        </p>
      </footer>
    </div>
  );
}
