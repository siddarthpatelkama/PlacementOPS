/**
 * PlacementOps — Resume Upload & Extraction Route
 *
 * Handles PDF resume uploads via multipart form data. Extracts raw text
 * using pdf-parse, generates a 768-D vector embedding via Gemini, stores
 * the raw PDF in Supabase Storage, and inserts a record into the resumes
 * table with the text, URL, and embedding.
 *
 * @module routes/resumes
 */

import express from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const multer = require('multer');
const os = require('os');
const fs = require('fs');
global.DOMMatrix = global.DOMMatrix || class DOMMatrix {};
const pdfParse = require('pdf-parse');
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { supabaseAdmin } from '../db/supabase.js';

const router = express.Router();

const upload = multer({ 
  dest: os.tmpdir(),
  limits: { fileSize: 2 * 1024 * 1024 } 
}).single('file'); 

router.post('/upload', upload, async (req, res) => {
  if (!req.file) {
    return res.status(422).json({ error: "Missing file payload. Ensure FormData uses key 'file'." });
  }
  if (!req.body.user_id) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(422).json({ error: "Missing user_id parameter." });
  }
  
  const user_id = req.body.user_id;
  const file = req.file;

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: 'text-embedding-004',
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  });

  try {
    /* ── Step 1: Extract raw text from PDF ── */
    const dataBuffer = fs.readFileSync(file.path);
    
    let rawText;
    try {
      const parsed = await pdfParse(dataBuffer);
      rawText = parsed.text;

      if (!rawText || rawText.trim().length === 0) {
        fs.unlinkSync(file.path);
        return res.status(422).json({
          success: false,
          error: 'Could not extract text from the PDF. The file may be image-based or empty.',
        });
      }
    } catch (parseError) {
      console.error('[resumes] PDF parse failed:', parseError.message);
      fs.unlinkSync(file.path);
      return res.status(422).json({
        success: false,
        error: 'Failed to parse the PDF file. Ensure it is a valid, text-based PDF.',
      });
    }

    console.log(`[resumes] Extracted ${rawText.length} chars from PDF for user ${user_id}`);

    /* ── Step 2: Generate 768-D vector embedding ── */
    const vector = await embeddings.embedQuery(rawText);
    console.log(`[resumes] Generated ${vector.length}-D embedding`);

    /* ── Step 3: Upload raw PDF to Supabase Storage ── */
    const fileName = `${user_id}/${Date.now()}_${file.originalname}`;
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('resumes')
      .upload(fileName, dataBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    // We no longer need the file on disk
    fs.unlinkSync(file.path);

    if (storageError) {
      console.error('[resumes] Storage upload failed:', storageError.message);
      // Non-fatal — continue without the URL
    }

    const resumeUrl = storageData
      ? supabaseAdmin.storage.from('resumes').getPublicUrl(storageData.path).data.publicUrl
      : null;

    console.log(`[resumes] PDF stored at: ${resumeUrl || 'N/A'}`);

    /* ── Step 4: Insert record into resumes table ── */
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('resumes')
      .insert({
        user_id,
        raw_text: rawText,
        resume_url: resumeUrl,
        embedding: vector,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[resumes] DB insert failed:', insertError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to save resume record to database.',
      });
    }

    console.log(`[resumes] Resume saved — ID: ${insertData.id}`);

    res.status(201).json({
      success: true,
      resumeId: insertData.id,
      resumeUrl,
      textLength: rawText.length,
    });
  } catch (error) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error('[resumes] Unexpected error:', error.message);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while processing the resume.',
    });
  }
});

export default router;
