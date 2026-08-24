import express from 'express';
import { supabaseAdmin } from '../db/supabase.js';
import { generateEmbedding } from '../agents/matcher.js';

const router = express.Router();

/**
 * Endpoint to upload resume, generate embeddings, and save to student profile.
 * Expects { userId, cgpa, rawResumeText } in body.
 */
router.post('/upload', async (req, res) => {
  const { userId, cgpa, rawResumeText } = req.body;
  
  if (!userId || !rawResumeText) {
    return res.status(400).json({ error: 'userId and rawResumeText are required' });
  }
  
  try {
    console.log(`Generating embedding for user profile: ${userId}...`);
    
    // 1. Generate embedding using Gemini Agent
    const embedding = await generateEmbedding(rawResumeText);
    
    // 2. Upsert profile in Supabase student_profiles table
    const { data, error } = await supabaseAdmin
      .from('student_profiles')
      .upsert({
        user_id: userId,
        cgpa: cgpa ? parseFloat(cgpa) : null,
        raw_resume_text: rawResumeText,
        embedding: embedding
      }, { onConflict: 'user_id' })
      .select();
      
    if (error) {
      throw error;
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Resume profile processed and vectorized successfully',
      profile: data[0]
    });
  } catch (error) {
    console.error('Error uploading profile & generating embeddings:', error);
    res.status(500).json({ error: 'Failed to process resume profile and embeddings' });
  }
});

export default router;
