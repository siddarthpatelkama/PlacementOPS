import express from 'express';
import multer from 'multer';
import os from 'os';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { supabaseAdmin } from '../db/supabase.js';
import { runPlacementPipeline } from '../agents/graph.js';

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('file');

router.post('/', (req, res, next) => {
  upload(req, res, function (err) {
    if (err) {
      console.error("SANDBOX CRASH: Multer error:", err);
      return res.status(500).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Check FormData field name." });
    }

    if (!req.body.rawJd) {
      return res.status(400).json({ error: "No Job Description provided." });
    }

    const buffer = fs.readFileSync(req.file.path);
    fs.unlinkSync(req.file.path); // immediately delete to prevent memory leaks

    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (parseError) {
      console.error("SANDBOX CRASH: PDF Parse failed:", parseError);
      return res.status(500).json({ error: "Failed to parse the PDF file. Ensure it is a valid, text-based PDF." });
    }

    const rawText = pdfData.text;

    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: 'text-embedding-004',
      apiKey: process.env.GEMINI_API_KEY,
    });
    
    const vector = await embeddings.embedQuery(rawText);

    const DEMO_USER_ID = 'demo-user-123';
    
    // Upsert demo user just in case
    await supabaseAdmin.from('users').upsert({ id: DEMO_USER_ID, email: 'demo@placementops.local' });

    await supabaseAdmin
      .from('resumes')
      .upsert({
        user_id: DEMO_USER_ID,
        raw_text: rawText,
        embedding: vector,
      }, { onConflict: 'user_id' });

    const initialState = {
      rawJd: req.body.rawJd,
      userId: DEMO_USER_ID,
      matchScore: null,
      missingSkills: [],
      coverLetter: null,
    };

    const result = await runPlacementPipeline(initialState);
    
    return res.json({
      matchScore: result.matchScore,
      missingSkills: result.missingSkills,
      coverLetter: result.coverLetter,
    });

  } catch (error) {
    console.error("SANDBOX CRASH:", error);
    return res.status(500).json({ error: error.message || "Pipeline failed" });
  }
});

export default router;
