import { google } from 'googleapis';
import { supabaseAdmin } from '../db/supabase.js';
import { runPlacementPipeline } from '../agents/graph.js';

dotenv.config();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;

/**
 * Creates a new Google OAuth2 client.
 */
export function getOAuthClient() {
  if (!googleClientId || !googleClientSecret || !googleRedirectUri) {
    console.warn(
      'Warning: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI is missing.'
    );
  }
  return new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    googleRedirectUri
  );
}

/**
 * Generates the Google OAuth authorization URL requesting gmail.readonly scope.
 * We store the user ID in the state parameter to map it in the callback.
 */
export function getAuthUrl(userId) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Requests a refresh token
    prompt: 'consent',     // Forces consent screen to ensure refresh token is returned
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state: userId          // Round-trips the user's Supabase UID
  });
}

/**
 * Exchanges the OAuth authorization code for credentials tokens.
 */
export async function getTokens(code) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Decodes base64url string to utf-8.
 */
function decodeBase64(data) {
  if (!data) return '';
  const buffer = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return buffer.toString('utf-8');
}

/**
 * Recursively parses email payload to extract plain text or HTML body.
 */
function getEmailBody(payload) {
  if (!payload) return '';
  
  if (payload.body && payload.body.data) {
    return decodeBase64(payload.body.data);
  }
  
  if (payload.parts) {
    // 1. Try to find text/plain
    const plainPart = payload.parts.find(part => part.mimeType === 'text/plain');
    if (plainPart && plainPart.body && plainPart.body.data) {
      return decodeBase64(plainPart.body.data);
    }
    
    // 2. Try to find text/html
    const htmlPart = payload.parts.find(part => part.mimeType === 'text/html');
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      return decodeBase64(htmlPart.body.data);
    }
    
    // 3. Recurse into nested parts
    for (const part of payload.parts) {
      const body = getEmailBody(part);
      if (body) return body;
    }
  }
  
  return '';
}

/**
 * Polls the Gmail API for emails matching "placement" or "hiring" keywords.
 */
export async function fetchEmails(refreshToken, maxResults = 10) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // Search query to fetch placement-related emails in the last 7 days or generally
  const query = 'placement OR hiring OR recruitment';
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: maxResults
  });
  
  const messages = response.data.messages || [];
  const fetchedEmails = [];
  
  for (const msg of messages) {
    try {
      const emailDetail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id
      });
      
      const headers = emailDetail.data.payload.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown';
      const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
      
      const snippet = emailDetail.data.snippet || '';
      const body = getEmailBody(emailDetail.data.payload);
      
      fetchedEmails.push({
        id: msg.id,
        subject,
        from,
        date,
        snippet,
        body: body || snippet // Fallback to snippet if body extraction fails
      });
    } catch (err) {
      console.error(`Error fetching email details for message ID ${msg.id}:`, err.message);
    }
  }
  
  return fetchedEmails;
}

/**
 * Polls the Gmail inbox for all unread emails, extracts their content,
 * marks each as read, and returns structured email objects.
 *
 * NOTE: This function requires the `gmail.modify` scope (or `gmail.readonly`
 * if you remove the mark-as-read step). The OAuth consent flow in
 * `getAuthUrl()` should request the appropriate scope.
 *
 * @param {string} refreshToken  The user's stored Google OAuth refresh token.
 * @param {number} [maxResults=20]  Maximum number of unread emails to process.
 * @returns {Promise<Array<{ messageId: string, sender: string, subject: string, body: string }>>}
 */
export async function pollJobEmails(maxResults = 20) {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, google_refresh_token')
      .not('google_refresh_token', 'is', null);

    if (error) {
      console.error('[gmail] Failed to fetch users from Supabase:', error.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('[gmail] No users with Gmail credentials found.');
      return;
    }

    for (const user of users) {
      const { id: userId, google_refresh_token: refreshToken } = user;
      
      try {
        const oauth2Client = getOAuthClient();
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const listResponse = await gmail.users.messages.list({
          userId: "me",
          q: "is:unread",
          maxResults,
        });

        const messageRefs = listResponse.data.messages || [];
        if (messageRefs.length === 0) continue;

        console.log(`[gmail] Found ${messageRefs.length} unread message(s) for user ${userId}.`);

        for (const ref of messageRefs) {
          try {
            const emailResponse = await gmail.users.messages.get({
              userId: "me",
              id: ref.id,
              format: "full",
            });

            const payload = emailResponse.data.payload;
            const body = getEmailBody(payload);
            const headers = payload?.headers || [];
            const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "(No Subject)";
            const sender = headers.find((h) => h.name.toLowerCase() === "from")?.value || "Unknown Sender";

            await gmail.users.messages.modify({
              userId: "me",
              id: ref.id,
              requestBody: { removeLabelIds: ["UNREAD"] },
            });

            const initialState = {
              rawJd: body || emailResponse.data.snippet || "",
              userId,
            };

            console.log(`[cron] ▶ Pipeline dispatched — Subject: "${subject}" | From: ${sender} | User: ${userId}`);
            
            runPlacementPipeline(initialState).catch((pipelineError) => {
              console.error(`[cron] Pipeline failed for "${subject}":`, pipelineError.message);
            });
          } catch (msgError) {
            console.error(`[gmail] Failed to process message ${ref.id} for user ${userId}:`, msgError.message);
          }
        }
      } catch (userError) {
        if (userError.code === 401 || userError.message?.includes("invalid_grant")) {
          console.error(`[gmail] Invalid/expired refresh token for user ${userId}.`);
        } else if (userError.code === 403) {
          console.error(`[gmail] Insufficient permissions for user ${userId}.`);
        } else {
          console.error(`[gmail] Polling failed for user ${userId}:`, userError.message);
        }
      }
    }
  } catch (err) {
    console.error("[gmail] Global polling error:", err.message);
  }
}
