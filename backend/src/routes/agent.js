import express from 'express';
import { supabaseAdmin } from '../db/supabase.js';
import { extractJobDetails } from '../agents/extractor.js';
import { matchResumeWithJob } from '../agents/matcher.js';

const router = express.Router();

/**
 * Helper function to run the ingestion, extraction, and RAG matching pipeline.
 * Reusable for both direct manual API requests and Gmail background cron sync.
 */
export async function runAnalysisPipeline(userId, subject, body, sourceEmailId) {
  console.log(`Running pipeline for user: ${userId}, Email: ${subject}`);
  
  // 1. Extract job details from email via Gemini Extractor Agent
  const extracted = await extractJobDetails(subject, body);
  console.log('Extracted Job Details:', extracted);
  
  // 2. Save job details in job_opportunities table
  const { data: jobs, error: jobError } = await supabaseAdmin
    .from('job_opportunities')
    .upsert({
      company_name: extracted.company_name,
      role: extracted.role,
      required_skills: extracted.required_skills,
      deadline: extracted.deadline,
      source_email_id: sourceEmailId
    }, { onConflict: 'source_email_id' })
    .select();
    
  if (jobError) {
    throw jobError;
  }
  
  const job = jobs[0];
  
  // 3. Fetch student profile (containing resume text and embeddings)
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('student_profiles')
    .select('*')
    .eq('user_id', userId);
    
  if (profileError) {
    throw profileError;
  }
  
  const profile = profiles[0];
  
  // 4. Run RAG Matcher Agent if profile exists
  if (!profile) {
    console.log(`User ${userId} has not uploaded a resume yet. Skipping matcher evaluation.`);
    // Insert application with zero match score and status set to "needs_profile"
    const { data: appData, error: appError } = await supabaseAdmin
      .from('applications')
      .upsert({
        user_id: userId,
        job_id: job.id,
        match_score: 0,
        missing_skills: extracted.required_skills,
        generated_cover_letter: 'Please upload your resume to generate a tailored cover letter.',
        status: 'needs_profile'
      }, { onConflict: 'user_id,job_id' })
      .select();
      
    if (appError) throw appError;
    
    return {
      success: true,
      status: 'needs_profile',
      job,
      analysis: null
    };
  }
  
  console.log('Running matcher agent...');
  const matchResult = await matchResumeWithJob(profile, job);
  console.log('Match Result:', matchResult);
  
  // 5. Store match results in applications table
  const { data: appData, error: appError } = await supabaseAdmin
    .from('applications')
    .upsert({
      user_id: userId,
      job_id: job.id,
      match_score: matchResult.match_score,
      missing_skills: matchResult.missing_skills,
      generated_cover_letter: matchResult.generated_cover_letter,
      status: 'matched'
    }, { onConflict: 'user_id,job_id' })
    .select();
    
  if (appError) throw appError;
  
  return {
    success: true,
    status: 'matched',
    job,
    analysis: matchResult
  };
}

/**
 * POST /api/agent/analyze
 * Manually analyze an email payload.
 */
router.post('/analyze', async (req, res) => {
  const { userId, subject, body, sourceEmailId } = req.body;
  
  if (!userId || !subject || !body) {
    return res.status(400).json({ error: 'userId, subject, and body are required' });
  }
  
  const emailId = sourceEmailId || `manual-${Date.now()}`;
  
  try {
    const result = await runAnalysisPipeline(userId, subject, body, emailId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in manual agent analysis route:', error);
    res.status(500).json({ error: 'Agent analysis pipeline failed' });
  }
});

export default router;
