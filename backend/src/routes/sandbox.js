import express from 'express';
import multer from 'multer';
import os from 'os';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { supabaseAdmin } from '../db/supabase.js';
import { runPlacementPipeline } from '../agents/graph.js';

const router = express.Router();

// Configure multer for disk storage with a 2MB limit
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.post('/', upload.single('resume'), async (req, res) => {
  try {
    const file = req.file;
    const { rawJd } = req.body;
    const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000'; // Hardcoded demo user ID

    if (!file) {
      return res.status(400).json({ error: 'A PDF resume is required.' });
    }

    if (!rawJd) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Job description (rawJd) is required.' });
    }

    // Read the uploaded file from disk and extract text
    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    const rawText = pdfData.text;

    // Delete the temporary file from disk immediately
    fs.unlinkSync(file.path);

    // Generate embedding
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: 'text-embedding-004',
      apiKey: process.env.GEMINI_API_KEY,
    });
    const vector = await embeddings.embedQuery(rawText);

    // Upsert demo user just in case (since resumes might have a foreign key to users)
    await supabaseAdmin.from('users').upsert({ id: DEMO_USER_ID, email: 'demo@placementops.local' });

    // Insert a temporary record into the Supabase resumes table
    const { error: insertError } = await supabaseAdmin
      .from('resumes')
      .upsert({
        user_id: DEMO_USER_ID,
        raw_text: rawText,
        embedding: vector,
      });

    if (insertError) {
      console.error('[sandbox] Insert Error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    // Construct the initialState object
    const initialState = {
      rawJd: rawJd,
      userId: DEMO_USER_ID,
    };

    // Await the pipeline
    const finalState = await runPlacementPipeline(initialState);

    // Return strict JSON response
    return res.json({
      matchScore: finalState.matchScore || 0,
      missingSkills: finalState.missingSkills || [],
      coverLetter: finalState.coverLetter || '',
    });
  } catch (error) {
    console.error('[sandbox] Pipeline Error:', error);
    
    // Attempt to clean up file if it still exists due to an error before unlink
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default router;
