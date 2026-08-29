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
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { supabaseAdmin } from '../db/supabase.js';

const router = express.Router();

/** Multer configured for in-memory storage (no disk writes). */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted.'));
    }
  },
});

/** Gemini embedding model — 768-D vectors matching pgvector column. */
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: 'text-embedding-004',
});

/**
 * POST /api/resumes/upload
 *
 * Expects multipart/form-data with:
 *   - file: PDF resume (field name "resume")
 *   - user_id: Supabase UUID of the student (text field)
 *
 * Returns: { success, resumeId, resumeUrl }
 */
router.post('/upload', upload.single('resume'), async (req, res) => {
  const { user_id } = req.body;
  const file = req.file;

  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required.' });
  }

  if (!file) {
    return res.status(400).json({ success: false, error: 'A PDF file is required.' });
  }

  try {
    /* ── Step 1: Extract raw text from PDF ── */
    let rawText;
    try {
      const parsed = await pdfParse(file.buffer);
      rawText = parsed.text;

      if (!rawText || rawText.trim().length === 0) {
        return res.status(422).json({
          success: false,
          error: 'Could not extract text from the PDF. The file may be image-based or empty.',
        });
      }
    } catch (parseError) {
      console.error('[resumes] PDF parse failed:', parseError.message);
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
      .upload(fileName, file.buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

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
    console.error('[resumes] Unexpected error:', error.message);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while processing the resume.',
    });
  }
});

export default router;
