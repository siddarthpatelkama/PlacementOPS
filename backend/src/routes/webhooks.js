import express from 'express';
import { supabaseAdmin } from '../db/supabase.js';
import { fetchEmails } from '../services/gmail.js';
import { runAnalysisPipeline } from './agent.js';

const router = express.Router();

/**
 * POST /api/webhooks/ingest
 * Webhook triggered manually or via cron to ingest and analyze new placement emails.
 */
router.post('/ingest', async (req, res) => {
  console.log('--- GMAIL BACKGROUND INGESTION ENGINE STARTED ---');
  
  try {
    // 1. Fetch all users who have authorized Gmail access
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, google_refresh_token')
      .not('google_refresh_token', 'is', null);
      
    if (usersError) {
      throw usersError;
    }
    
    console.log(`Found ${users.length} users with Gmail access enabled.`);
    
    const results = [];
    
    // 2. Loop through users and ingest new emails
    for (const user of users) {
      console.log(`Processing Gmail sync for user: ${user.email} (${user.id})`);
      
      try {
        // Poll Gmail for the last 5 relevant emails
        const emails = await fetchEmails(user.google_refresh_token, 5);
        console.log(`Fetched ${emails.length} potential placement emails for ${user.email}`);
        
        let newJobsCount = 0;
        let errorsCount = 0;
        
        for (const email of emails) {
          try {
            // Check if this job opportunity is already in the database
            const { data: jobData, error: jobErr } = await supabaseAdmin
              .from('job_opportunities')
              .select('id')
              .eq('source_email_id', email.id)
              .maybeSingle();
              
            if (jobErr) throw jobErr;
            
            let isAlreadyProcessed = false;
            
            if (jobData) {
              // Job exists, check if application analysis already exists for this user
              const { data: appData, error: appErr } = await supabaseAdmin
                .from('applications')
                .select('id')
                .eq('user_id', user.id)
                .eq('job_id', jobData.id)
                .maybeSingle();
                
              if (appErr) throw appErr;
              if (appData) {
                isAlreadyProcessed = true; // Skip
              }
            }
            
            if (isAlreadyProcessed) {
              console.log(`Email ID ${email.id} already processed for user ${user.email}. Skipping.`);
              continue;
            }
            
            // Run analysis and matching pipeline
            await runAnalysisPipeline(user.id, email.subject, email.body, email.id);
            newJobsCount++;
            
          } catch (emailErr) {
            console.error(`Failed to ingest email ID ${email.id} for user ${user.email}:`, emailErr.message);
            errorsCount++;
          }
        }
        
        results.push({
          user: user.email,
          status: 'success',
          synced_jobs: newJobsCount,
          errors: errorsCount
        });
        
      } catch (userErr) {
        console.error(`Failed to sync Gmail for user ${user.email}:`, userErr.message);
        
        results.push({
          user: user.email,
          status: 'failed',
          error: userErr.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Ingestion task executed',
      results
    });
    
  } catch (error) {
    console.error('Fatal error in ingestion webhook route:', error);
    res.status(500).json({ error: 'Ingestion webhook execution failed' });
  }
});

export default router;
