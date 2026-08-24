import express from 'express';
import { supabaseAdmin } from '../db/supabase.js';

const router = express.Router();

/**
 * GET /api/jobs/matched/:user_id
 * Retrieves the scored list of job applications and associated JD assets.
 */
router.get('/matched/:user_id', async (req, res) => {
  const userId = req.params.user_id;
  
  if (!userId) {
    return res.status(400).json({ error: 'user_id parameter is required' });
  }
  
  try {
    console.log(`Fetching matched roles for user: ${userId}`);
    
    // Fetch applications and join related job opportunity details
    const { data, error } = await supabaseAdmin
      .from('applications')
      .select(`
        id,
        match_score,
        missing_skills,
        generated_cover_letter,
        status,
        created_at,
        job_opportunities:job_id (
          id,
          company_name,
          role,
          required_skills,
          deadline,
          source_email_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      throw error;
    }
    
    // Flatten output slightly for cleaner frontend consumption
    const formattedMatches = data.map(app => ({
      application_id: app.id,
      match_score: parseFloat(app.match_score),
      missing_skills: app.missing_skills || [],
      generated_cover_letter: app.generated_cover_letter,
      status: app.status,
      created_at: app.created_at,
      job_id: app.job_opportunities?.id || null,
      company_name: app.job_opportunities?.company_name || 'Unknown Company',
      role: app.job_opportunities?.role || 'Unknown Role',
      required_skills: app.job_opportunities?.required_skills || [],
      deadline: app.job_opportunities?.deadline || null,
      source_email_id: app.job_opportunities?.source_email_id || null
    }));
    
    res.status(200).json({
      success: true,
      matches: formattedMatches
    });
  } catch (error) {
    console.error('Error fetching matched jobs:', error);
    res.status(500).json({ error: 'Failed to retrieve matched job applications' });
  }
});

export default router;
