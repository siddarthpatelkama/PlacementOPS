/**
 * PlacementOps AI Pipeline — Execution Node (Cover Letter Drafting)
 *
 * LangGraph node that reads the match score, extracted job data, and
 * missing skills from state, then generates a tailored cover letter
 * using Gemini 2.5 Flash. The tone and strategy adapt based on the
 * match score threshold (50%).
 *
 * @module agents/nodes/execute
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

/**
 * Gemini 2.5 Flash — slightly elevated temperature for natural,
 * human-sounding prose while still maintaining professionalism.
 */
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.7,
  maxRetries: 2,
});

/** Match score threshold that determines cover letter strategy. */
const CONFIDENCE_THRESHOLD = 50;

/**
 * Build the system prompt based on the match score bracket.
 *
 * @param {number}   matchScore     Percentage score (0–100).
 * @param {string}   companyName    Hiring company name.
 * @param {string}   role           Job title.
 * @param {string[]} missingSkills  Skills the student lacks.
 * @returns {string} System prompt for the LLM.
 */
function buildSystemPrompt(matchScore, companyName, role, missingSkills) {
  const missingList =
    missingSkills.length > 0 ? missingSkills.join(", ") : "none identified";

  if (matchScore < CONFIDENCE_THRESHOLD) {
    return [
      "You are an expert career coach and cover letter writer.",
      "",
      "Context:",
      `  • The student is applying to ${companyName} for the ${role} position.`,
      `  • Their resume match score is ${matchScore}% — below the confidence threshold.`,
      `  • Skills they are missing: ${missingList}.`,
      "",
      "Instructions:",
      "  Write a polite, realistic, and professional cover letter that:",
      "  1. Acknowledges this is a stretch or transitional opportunity for the student.",
      "  2. Emphasises high adaptability, fast learning ability, and genuine enthusiasm.",
      "  3. Highlights any transferable skills or adjacent technologies they may have.",
      "  4. Frames the missing skills as areas the student is actively learning or eager to develop.",
      "  5. Keeps a humble but confident tone — not desperate, not arrogant.",
      "  6. Is concise — 3 to 4 paragraphs maximum.",
      "  7. Does NOT include placeholder brackets like [Your Name] — write it generically.",
      "",
      "Output: Return ONLY the cover letter text, no extra commentary.",
    ].join("\n");
  }

  return [
    "You are an expert career coach and cover letter writer.",
    "",
    "Context:",
    `  • The student is applying to ${companyName} for the ${role} position.`,
    `  • Their resume match score is ${matchScore}% — strong alignment.`,
    `  • Skills they are missing: ${missingList}.`,
    "",
    "Instructions:",
    "  Write a highly confident, professional cover letter that:",
    "  1. Opens with a strong, compelling statement of fit for the role.",
    "  2. Explicitly highlights the student's strong alignment with the position based on their high match score.",
    "  3. Strategically minimises or compensates for any missing skills by:",
    "     a. Pointing to adjacent or closely related technologies the student likely knows.",
    "     b. Expressing a clear willingness and plan to upskill rapidly.",
    "     c. Framing gaps as minor relative to overall technical strength.",
    "  4. Projects confidence and competence throughout.",
    "  5. Is concise and impactful — 3 to 4 paragraphs maximum.",
    "  6. Does NOT include placeholder brackets like [Your Name] — write it generically.",
    "",
    "Output: Return ONLY the cover letter text, no extra commentary.",
  ].join("\n");
}

/**
 * LangGraph node — drafts a tailored cover letter based on match results.
 *
 * @param {object} state  Current graph state.
 * @returns {object}      State update: `{ coverLetter }`.
 */
export const draftApplication = async (state) => {
  const { extractedData, matchScore, missingSkills } = state;

  /* ── Guard: missing data ── */
  if (!extractedData) {
    console.warn("[execute] No extractedData — cannot draft cover letter.");
    return { coverLetter: "" };
  }

  const companyName = extractedData.companyName || "the company";
  const role = extractedData.role || "the position";
  const score = typeof matchScore === "number" ? matchScore : 0;
  const gaps = Array.isArray(missingSkills) ? missingSkills : [];

  try {
    const systemPrompt = buildSystemPrompt(score, companyName, role, gaps);

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Write the cover letter for the ${role} role at ${companyName}.`,
      },
    ]);

    const coverLetter =
      typeof response.content === "string"
        ? response.content.trim()
        : String(response.content).trim();

    if (!coverLetter) {
      console.warn("[execute] LLM returned empty cover letter.");
      return { coverLetter: "" };
    }

    console.log(
      `[execute] Cover letter drafted — ${coverLetter.length} chars ` +
        `(strategy: ${score < CONFIDENCE_THRESHOLD ? "transitional" : "confident"})`
    );

    return { coverLetter };
  } catch (error) {
    /* Handle API timeouts and transient failures gracefully */
    if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      console.error("[execute] API timeout while drafting cover letter:", error.message);
    } else {
      console.error("[execute] Cover letter generation failed:", error.message);
    }

    return {
      coverLetter:
        "Unable to generate a cover letter at this time. Please try again later.",
    };
  }
};
