/**
 * PlacementOps AI Pipeline — LangGraph State Definition
 *
 * Defines the shared state schema for the multi-step placement agent graph.
 * Each channel uses an overwrite reducer (x, y) => y so that every node
 * simply writes its output and the latest value wins.
 *
 * @module agents/state
 */

import { Annotation } from "@langchain/langgraph";

/**
 * Root state schema for the PlacementOps agent graph.
 *
 * Channels:
 *  - rawJd           Raw text of the incoming job-description email.
 *  - userId          Supabase UUID of the student.
 *  - extractedData   Structured JSON extracted by the LLM (companyName, role, skills[]).
 *  - jdEmbedding     768-dimensional vector from Gemini text-embedding-004.
 *  - matchScore      Cosine-similarity score returned by Supabase pgvector RPC.
 *  - missingSkills   Skills the student's resume lacks for this role.
 *  - coverLetter     Final LLM-generated cover letter / application asset.
 */
const PlacementGraphState = Annotation.Root({
  /** Raw job-description email body text. */
  rawJd: Annotation({
    reducer: (x, y) => y,
    default: () => "",
  }),

  /** Supabase auth UUID of the current student. */
  userId: Annotation({
    reducer: (x, y) => y,
    default: () => "",
  }),

  /**
   * Structured data extracted from the JD by the LLM.
   * Shape: { companyName: string, role: string, skills: string[] }
   */
  extractedData: Annotation({
    reducer: (x, y) => y,
    default: () => null,
  }),

  /** 768-D embedding vector produced by Gemini text-embedding-004. */
  jdEmbedding: Annotation({
    reducer: (x, y) => y,
    default: () => null,
  }),

  /** Cosine-similarity match score (0–100) from pgvector RPC. */
  matchScore: Annotation({
    reducer: (x, y) => y,
    default: () => 0,
  }),

  /** Skills present in the JD but absent from the student's resume. */
  missingSkills: Annotation({
    reducer: (x, y) => y,
    default: () => [],
  }),

  /** LLM-generated cover letter tailored to this role and skill gaps. */
  coverLetter: Annotation({
    reducer: (x, y) => y,
    default: () => "",
  }),
});

export { PlacementGraphState };
