/**
 * PlacementOps AI Pipeline — Extraction Node
 *
 * LangGraph node that takes the raw job-description text from state,
 * sends it to Gemini 2.5 Flash with structured output enforcement,
 * and returns the extracted { companyName, role, skills[] } object
 * into the extractedData state channel.
 *
 * @module agents/nodes/extract
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

/**
 * Zod schema that defines the exact JSON shape the LLM must return.
 * Used by .withStructuredOutput() to enforce type-safe extraction.
 */
const JobExtractionSchema = z.object({
  companyName: z
    .string()
    .describe("The name of the hiring company or organisation."),
  role: z
    .string()
    .describe("The job title or role being offered (e.g. 'Backend Engineer')."),
  skills: z
    .array(z.string())
    .describe(
      "A list of hard technical skills, programming languages, frameworks, " +
        "and tools explicitly mentioned in the job description. " +
        "Exclude soft skills, benefits, and generic qualifications."
    ),
});



/**
 * LangGraph node — extracts structured job data from raw JD text.
 *
 * @param {object} state  Current graph state (must contain `rawJd`).
 * @returns {object}      State update: `{ extractedData }`.
 */
export const extractJobDetails = async (state) => {
  const { rawJd } = state;

  if (!rawJd || rawJd.trim().length === 0) {
    console.warn("[extract] rawJd is empty — skipping extraction.");
    return {
      extractedData: {
        companyName: "Unknown",
        role: "Unknown",
        skills: [],
      },
    };
  }

  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  });
  
  const structuredLlm = llm.withStructuredOutput(JobExtractionSchema);

  try {
    const result = await structuredLlm.invoke([
      {
        role: "system",
        content: [
          "You are an expert technical recruiter and job-description analyst.",
          "Given the raw text of a job posting or recruiter email, extract exactly three fields:",
          "  1. companyName — the hiring company's name.",
          "  2. role — the specific job title or position.",
          "  3. skills — an array of hard technical skills, programming languages,",
          "     frameworks, and tools explicitly required or preferred.",
          "",
          "Rules:",
          "  • Only include hard technical skills (e.g. Python, React, Docker, SQL).",
          "  • Exclude soft skills (e.g. communication, teamwork, leadership).",
          "  • Exclude generic qualifications (e.g. Bachelor's degree, 3+ years experience).",
          "  • Exclude benefits, salary, or location information.",
          "  • De-duplicate skills — list each skill only once.",
          "  • Preserve the original casing of skill names (e.g. 'TypeScript' not 'typescript').",
        ].join("\n"),
      },
      {
        role: "user",
        content: `Extract the company name, role, and technical skills from this job description:\n\n${rawJd}`,
      },
    ]);

    console.log(
      `[extract] Extracted: ${result.companyName} — ${result.role} (${result.skills.length} skills)`
    );

    return { extractedData: result };
  } catch (error) {
    console.error("[extract] LLM extraction failed:", error.message);

    return {
      extractedData: {
        companyName: "Unknown",
        role: "Unknown",
        skills: [],
      },
    };
  }
};
