import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import agentRouter from './routes/agent.js';
import jobsRouter from './routes/jobs.js';
import webhooksRouter from './routes/webhooks.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start listening for connections
app.listen(PORT, () => {
  console.log(`PlacementOps server running on http://localhost:${PORT}`);
});
