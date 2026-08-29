import express from 'express';
import { google } from 'googleapis';
import { supabaseAdmin } from '../db/supabase.js';

const router = express.Router();

const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/gmail/callback';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  redirectUri
);

// GET /api/gmail
router.get('/', (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).send('userId is required');
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state: userId
  });

  res.redirect(url);
});

// GET /api/gmail/callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const userId = state;

  if (!code || !userId) {
    return res.status(400).send('code and state are required');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (tokens.refresh_token) {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ google_refresh_token: tokens.refresh_token })
        .eq('id', userId);

      if (error) {
        console.error('Supabase update error:', error);
        return res.status(500).send('Failed to update credentials');
      }
    }

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

export default router;
