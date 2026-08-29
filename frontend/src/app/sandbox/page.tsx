'use client';

import React, { useState } from 'react';
import { Loader2, FileText, Upload, AlertCircle } from 'lucide-react';

export default function SandboxPage() {
  const [selectedFile, setselectedFile] = useState<File | null>(null);
  const [rawJd, setRawJd] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [result, setResult] = useState<{
    matchScore: number;
    missingSkills: string[];
    coverLetter: string;
  } | null>(null);

  const handleRunPipeline = async () => {
    if (!selectedFile || !rawJd.trim()) {
      setError('Please provide both a PDF resume and a Job Description.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('rawJd', rawJd);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/sandbox`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process pipeline');
      }

      setResult({
        matchScore: data.matchScore,
        missingSkills: data.missingSkills || [],
        coverLetter: data.coverLetter || '',
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">AI Pipeline Sandbox</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2">Test the resume extraction, evaluation, and cover letter generation pipeline instantly.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ── Inputs Column ── */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-neutral-400" /> Inputs
            </h2>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Resume (PDF)</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-neutral-500">
                  <Upload className="w-6 h-6 mb-2 text-neutral-400" />
                  <p className="text-sm">{selectedFile ? selectedFile.name : 'Click to upload PDF'}</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf" 
                  onChange={(e) => setselectedFile(e.target.files?.[0] || null)} 
                />
              </label>
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Job Description</label>
              <textarea 
                className="flex-1 w-full p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[200px]"
                placeholder="Paste the raw job description here..."
                value={rawJd}
                onChange={(e) => setRawJd(e.target.value)}
              />
            </div>

            <button 
              onClick={handleRunPipeline} 
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isProcessing ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing Pipeline...</> : 'Run AI Pipeline'}
            </button>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg text-sm font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}
          </div>

          {/* ── AI Output Column ── */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-neutral-400" /> AI Output
            </h2>

            {isProcessing ? (
              <div className="animate-pulse space-y-6">
                <div className="h-20 bg-neutral-100 dark:bg-neutral-800 rounded-xl"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-1/4"></div>
                  <div className="flex gap-2">
                    <div className="h-6 bg-neutral-100 dark:bg-neutral-800 rounded-full w-20"></div>
                    <div className="h-6 bg-neutral-100 dark:bg-neutral-800 rounded-full w-24"></div>
                    <div className="h-6 bg-neutral-100 dark:bg-neutral-800 rounded-full w-16"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-full"></div>
                  <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-full"></div>
                  <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-5/6"></div>
                  <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-full"></div>
                  <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-4/5"></div>
                </div>
              </div>
            ) : result ? (
              <div className="space-y-8 animate-fade-in">
                
                {/* Match Score */}
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Match Score</h3>
                  <div className={`text-4xl font-bold tracking-tight ${getScoreColor(result.matchScore)}`}>
                    {result.matchScore}%
                  </div>
                </div>

                {/* Missing Skills */}
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-3">Missing Skills Identified</h3>
                  {result.missingSkills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.missingSkills.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-full text-xs font-semibold">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All required skills are present in the resume!</p>
                  )}
                </div>

                {/* Cover Letter */}
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-3">Generated Cover Letter</h3>
                  <div className="p-5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                    {result.coverLetter}
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-400">
                <FileText className="w-12 h-12 mb-3 text-neutral-300 dark:text-neutral-700" />
                <p>Upload a resume and job description to see the AI output here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
