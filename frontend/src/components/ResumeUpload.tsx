'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Upload, Loader2, CheckCircle, AlertTriangle, FileText, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

/**
 * ResumeUpload — PDF resume upload component.
 *
 * Allows the authenticated user to select a PDF file and upload it to
 * the backend. The backend extracts text, generates embeddings, and
 * stores everything in Supabase.
 *
 * @param {{ onUploadSuccess?: () => void }} props
 */
export default function ResumeUpload({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setError(null);
    setSuccess(false);

    if (selected && selected.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      setFile(null);
      return;
    }

    if (selected && selected.size > 10 * 1024 * 1024) {
      setError('File size must be under 10 MB.');
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file first.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be signed in to upload a resume.');
        setIsUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user.id);

      const response = await fetch(`${API_URL}/api/resumes/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Upload failed. Please try again.');
        return;
      }

      setSuccess(true);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onUploadSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Network error. Could not reach the server.');
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors">
      <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4 tracking-tight">
        <Upload className="w-4 h-4 text-neutral-400" /> Upload Resume (PDF)
      </h3>

      {/* File Input Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          file
            ? 'border-neutral-400 dark:border-neutral-500 bg-neutral-50 dark:bg-neutral-800'
            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50/50 dark:bg-neutral-800/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-5 h-5 text-neutral-500" />
            <div className="text-left">
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate max-w-[200px]">{file.name}</p>
              <p className="text-[10px] text-neutral-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          </div>
        ) : (
          <div>
            <Upload className="w-6 h-6 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Click to select a <span className="font-semibold">PDF</span> file</p>
            <p className="text-[10px] text-neutral-400 mt-1">Max 10 MB</p>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-3 flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Resume uploaded and vectorized successfully.</p>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed py-2.5 rounded-xl text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-[0.98] transition-all"
      >
        {isUploading ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
        ) : (
          <><Upload className="w-3.5 h-3.5" /> Upload Resume</>
        )}
      </button>
    </div>
  );
}
