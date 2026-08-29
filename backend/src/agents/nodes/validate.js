/**
 * PlacementOps AI Pipeline — Validation Node
 *
 * LangGraph node that embeds the extracted skills, queries the student's
 * resume via Supabase pgvector RPC, computes a match score, and uses
 * Gemini 2.5 Flash to identify which required skills are missing from
 * the student's resume.
 *
 * @module agents/nodes/validate
 */

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Embedding model — Gemini text-embedding-004 produces 768-D vectors
 * that match the pgvector column dimension in Supabase.
 */
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
});

/**
 * Chat model for skill-gap analysis — low temperature for consistency.
 */
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0,
});

/**
 * Zod schema enforcing the LLM's structured output for missing skills.
 */
const MissingSkillsSchema = z.object({
  missingSkills: z
    .array(z.string())
    .describe(
      "An array of technical skills from the required list that are " +
        "NOT present in the student's resume. Return an empty array " +
        "if all skills are covered."
    ),
});

/** LLM instance bound to the missing-skills schema. */
const structuredLlm = llm.withStructuredOutput(MissingSkillsSchema);

/**
 * Initialise the Supabase admin client using the service-role key
 * so we can call RPC functions without row-level security restrictions.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * LangGraph node — validates the student's resume against extracted JD skills.
 *
 * Flow:
 *  1. Join extracted skills into a single string and embed it.
 *  2. Call the `match_resumes` pgvector RPC to find the student's resume.
 *  3. If no resume found → score 0, all skills marked missing.
 *  4. If resume found → extract similarity score, then ask the LLM to
 *     cross-reference required skills against the resume text and return
 *     only the skills that are genuinely missing.
 *
 * @param {object} state  Current graph state.
 * @returns {object}      State update: `{ matchScore, missingSkills }`.
 */
export const validateResume = async (state) => {
  const { extractedData, userId } = state;

  if (!extractedData || !extractedData.skills || extractedData.skills.length === 0) {
    console.warn("[validate] No extracted skills — skipping validation.");
    return { matchScore: 0, missingSkills: [] };
  }

  if (!userId) {
    console.warn("[validate] No userId provided — skipping validation.");
    return { matchScore: 0, missingSkills: extractedData.skills };
  }

  try {
    /* ── Step 1: Embed the skills string ── */
    const skillsString = extractedData.skills.join(", ");
    const vector = await embeddings.embedQuery(skillsString);

    console.log(
      `[validate] Embedded ${extractedData.skills.length} skills → ${vector.length}-D vector`
    );

    /* ── Step 2: Query Supabase pgvector RPC ── */
    const { data: matches, error: rpcError } = await supabase.rpc(
      "match_resumes",
      {
        query_embedding: vector,
        match_threshold: 0.0,
        match_count: 1,
        filter_user_id: userId,
      }
    );

    if (rpcError) {
      console.error("[validate] Supabase RPC error:", rpcError.message);
      return { matchScore: 0, missingSkills: extractedData.skills };
    }

    /* ── Step 3: Handle no-match case ── */
    if (!matches || matches.length === 0) {
      console.warn("[validate] No resume found for user:", userId);
      return { matchScore: 0, missingSkills: extractedData.skills };
    }

    /* ── Step 4: Extract similarity score ── */
    const topMatch = matches[0];
    const similarity = parseFloat(topMatch.similarity);
    const matchScore = Math.round(similarity * 100 * 100) / 100; // e.g. 0.847 → 84.70

    console.log(
      `[validate] Resume matched — raw similarity: ${similarity}, score: ${matchScore}%`
    );

    /* ── Step 5: LLM skill-gap analysis ── */
    const resumeText = topMatch.raw_text || topMatch.raw_resume_text || "";

    if (!resumeText) {
      console.warn("[validate] Matched resume has no text — all skills marked missing.");
      return { matchScore, missingSkills: extractedData.skills };
    }

    const result = await structuredLlm.invoke([
      {
        role: "system",
        content: [
          "You are a precise technical skill-gap analyser.",
          "You will receive two inputs:",
          "  1. A list of REQUIRED technical skills for a job.",
          "  2. The student's RESUME text.",
          "",
          "Your task:",
          "  • Cross-reference each required skill against the resume.",
          "  • A skill is PRESENT if the resume mentions it explicitly, or mentions",
          "    a clearly equivalent technology (e.g. 'PostgreSQL' covers 'SQL').",
          "  • A skill is MISSING if there is no evidence of it in the resume.",
          "  • Return ONLY the missing skills. If all skills are present, return [].",
          "  • Preserve the original casing of skill names from the required list.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `REQUIRED SKILLS:\n${extractedData.skills.join(", ")}`,
          "",
          `STUDENT RESUME:\n${resumeText}`,
        ].join("\n"),
      },
    ]);

    console.log(
      `[validate] Skill gap: ${result.missingSkills.length} missing out of ${extractedData.skills.length}`
    );

    return {
      matchScore,
      missingSkills: result.missingSkills,
    };
  } catch (error) {
    console.error("[validate] Validation failed:", error.message);
    return {
      matchScore: 0,
      missingSkills: extractedData.skills,
    };
  }
};
