import express from 'express';
import { getAuthUrl, getTokens } from '../services/gmail.js';
import { supabaseAdmin } from '../db/supabase.js';

const router = express.Router();

/**
 * Route to kick off Google OAuth flow.
 * Expects user_id as a query parameter.
 */
router.get('/google', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }
  
  try {
    const authUrl = getAuthUrl(userId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).json({ error: 'Failed to initiate Google OAuth flow' });
  }
});

/**
 * Google OAuth redirect callback endpoint.
 * Exchanges auth code for refresh token and stores it in the database.
 */
router.get('/google/callback', async (req, res) => {
  const { code, state: userId, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  if (error) {
    console.error('Google OAuth callback error:', error);
    return res.redirect(`${frontendUrl}/dashboard?gmail_error=true`);
  }
  
  if (!code || !userId) {
    return res.status(400).json({ error: 'Missing code or state (userId)' });
  }
  
  try {
    const tokens = await getTokens(code);
    const refreshToken = tokens.refresh_token;
    
    if (!refreshToken) {
      // Sometimes Google only returns refresh token on the first authorization
      // prompt=consent in getAuthUrl forces Google to return it on every log in
      console.warn('Warning: Google did not return a refresh token.');
    }
    
    // Save the refresh token in public.users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ google_refresh_token: refreshToken })
      .eq('id', userId);
      
    if (dbError) {
      throw dbError;
    }
    
    res.redirect(`${frontendUrl}/dashboard?gmail_connected=true`);
  } catch (err) {
    console.error('Error during Google OAuth callback processing:', err);
    res.redirect(`${frontendUrl}/dashboard?gmail_error=true`);
  }
});

export default router;
