/**
 * PlacementOps — Express Server & Cron Ingestion
 *
 * Main entry point. Sets up the Express API server, mounts all route
 * handlers, and starts a background cron job that polls Gmail for
 * unread emails every 5 minutes and feeds each one through the
 * LangGraph placement pipeline.
 *
 * @module server
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Route imports
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import agentRouter from './routes/agent.js';
import jobsRouter from './routes/jobs.js';
import webhooksRouter from './routes/webhooks.js';
import resumesRouter from './routes/resumes.js';

// Pipeline imports
import { pollJobEmails } from './services/gmail.js';
import { runPlacementPipeline } from './agents/graph.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ═══════════════════════════════════════════
   MIDDLEWARE
   ═══════════════════════════════════════════ */

// Enable CORS for frontend dashboard requests
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Request logger middleware
app.use(morgan('dev'));

// Parse incoming JSON body payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ═══════════════════════════════════════════
   ROUTES
   ═══════════════════════════════════════════ */

// Liveness check route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'PlacementOps API' });
});

// Bind API routes
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/agent', agentRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/resumes', resumesRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

/* ═══════════════════════════════════════════
   CRON — GMAIL INGESTION (every 5 minutes)
   ═══════════════════════════════════════════ */

cron.schedule('*/5 * * * *', async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n[cron] ── Polling cycle started at ${timestamp} ──`);

  try {
    const emails = await pollJobEmails();

    if (!emails || emails.length === 0) {
      console.log('[cron] No new unread emails. Sleeping until next cycle.');
      return;
    }

    console.log(`[cron] Received ${emails.length} unread email(s). Dispatching pipelines...`);

    for (const email of emails) {
      const initialState = {
        rawJd: email.body,
        userId: 'PLACEHOLDER_USER_ID',
      };

      console.log(
        `[cron] ▶ Pipeline dispatched — Subject: "${email.subject}" | From: ${email.sender}`
      );

      // Fire-and-forget: pipelines run concurrently in the background.
      // Errors are caught inside runPlacementPipeline and per-node handlers.
      runPlacementPipeline(initialState).catch((pipelineError) => {
        console.error(
          `[cron] Pipeline failed for "${email.subject}":`,
          pipelineError.message
        );
      });
    }

    console.log(`[cron] All ${emails.length} pipeline(s) dispatched.`);
  } catch (cronError) {
    // Catch-all so the server never crashes from a polling failure
    console.error('[cron] Polling cycle failed:', cronError.message);
  }
});

console.log('[cron] Gmail ingestion cron registered — runs every 5 minutes.');

/* ═══════════════════════════════════════════
   GLOBAL SAFETY NETS
   ═══════════════════════════════════════════ */

process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[server] Uncaught Exception:', error);
  // Keep server alive — do NOT call process.exit()
});

/* ═══════════════════════════════════════════
   START SERVER
   ═══════════════════════════════════════════ */

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] PlacementOps API running on port ${PORT}`);
});
