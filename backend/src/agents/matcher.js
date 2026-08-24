import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.LLM_API_KEY;

/**
 * Initializes the embeddings client.
 */
export function getEmbeddingsClient() {
  if (!apiKey) {
    console.warn('Warning: LLM_API_KEY is not defined in the environment.');
  }
  return new GoogleGenerativeAIEmbeddings({
    apiKey: apiKey || '',
    modelName: 'text-embedding-004' // Outputs 768-dimensional vectors
  });
}

/**
 * Initializes the LLM client.
 */
function getLLM() {
  return new ChatGoogleGenerativeAI({
    model: 'gemini-1.5-flash',
    apiKey: apiKey || '',
    temperature: 0.2
  });
}

/**
 * Generates vector embeddings for a given text (e.g. resume).
 * 
 * @param {string} text Input text
 * @returns {Promise<number[]>} The vector embedding array
 */
export async function generateEmbedding(text) {
  const client = getEmbeddingsClient();
  return await client.embedQuery(text);
}

/**
 * Computes cosine similarity between two numeric vectors.
 */
function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Evaluates the student's resume against the Job Description.
 * It combines vector similarity with logical rules (CGPA, skill overlap) and drafts a cover letter.
 * 
 * @param {object} studentProfile The profile containing raw_resume_text, embedding, and cgpa
 * @param {object} jobOpportunity The job containing company_name, role, required_skills, and cgpa
 * @returns {Promise<object>} Match analysis containing match_score, missing_skills, and generated_cover_letter
 */
export async function matchResumeWithJob(studentProfile, jobOpportunity) {
  const model = getLLM();
  
  // 1. Calculate Vector Semantic Similarity
  let semanticScore = 0;
  try {
    const jobText = `${jobOpportunity.role} at ${jobOpportunity.company_name}. Required skills: ${jobOpportunity.required_skills.join(', ')}`;
    const jobEmbedding = await generateEmbedding(jobText);
    
    if (studentProfile.embedding && jobEmbedding) {
      // Vector DB embeddings are returned as strings in JSON sometimes, parse them if they are strings
      const studentVector = typeof studentProfile.embedding === 'string' 
        ? JSON.parse(studentProfile.embedding) 
        : studentProfile.embedding;
        
      const similarity = calculateCosineSimilarity(studentVector, jobEmbedding);
      // Map similarity (often 0.3 - 0.9 for text-embedding-004) to a 0-100 scale
      semanticScore = Math.min(100, Math.max(0, Math.round((similarity + 0.2) * 100)));
    }
  } catch (err) {
    console.error('Error calculating vector similarity:', err);
    semanticScore = 50; // Fallback score
  }

  // 2. Perform Detailed Rule and Generative Assessment
  const systemPrompt = `You are an expert HR agent evaluating a candidate for a job placement.

Evaluate the candidate's resume text against the Job Description. Identify skill gaps, check eligibility, calculate a comprehensive match score, and draft a cover letter.

Output your response ONLY as a JSON object matching this schema:
{
  "match_score": 85, // Integer between 0 and 100. Penalize if the candidate's CGPA is lower than required.
  "missing_skills": ["Kubernetes", "AWS"], // List of required skills not found or weak in the resume.
  "generated_cover_letter": "..." // A professionally written 3-paragraph cover letter highlighting how the candidate's actual skills align with the role, addressing the company by name, and bridging any gaps.
}

Ensure the output is valid JSON and nothing else.`;

  const userPrompt = `--- JOB DESCRIPTION ---
Company Name: ${jobOpportunity.company_name}
Role: ${jobOpportunity.role}
Required Skills: ${JSON.stringify(jobOpportunity.required_skills)}
Required CGPA: ${jobOpportunity.cgpa || 'None specified'}

--- CANDIDATE PROFILE ---
Candidate CGPA: ${studentProfile.cgpa || 'Not provided'}
Candidate Resume Text:
${studentProfile.raw_resume_text}

--- BASE SEMANTIC SCORE ---
Semantic Similarity Score: ${semanticScore}/100`;

  try {
    const response = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);
    
    let text = response.content;
    if (typeof text === 'string') {
      text = text.trim();
      if (text.startsWith('```json')) {
        text = text.substring(7);
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }
      text = text.trim();
    }
    
    const analysis = JSON.parse(text);
    
    // CGPA Hard Cutoff Check
    let finalScore = analysis.match_score || 50;
    if (jobOpportunity.cgpa && studentProfile.cgpa) {
      if (parseFloat(studentProfile.cgpa) < parseFloat(jobOpportunity.cgpa)) {
        // Candidate does not meet minimum CGPA requirement
        finalScore = Math.min(finalScore, 40); // Cap match score at 40% (ineligible)
      }
    }
    
    return {
      match_score: finalScore,
      missing_skills: Array.isArray(analysis.missing_skills) ? analysis.missing_skills : [],
      generated_cover_letter: analysis.generated_cover_letter || 'Cover letter generation failed.'
    };
  } catch (err) {
    console.error('Error during LLM resume matching:', err);
    return {
      match_score: semanticScore,
      missing_skills: [],
      generated_cover_letter: `Dear Hiring Team at ${jobOpportunity.company_name},\n\nI am writing to express my interest in the ${jobOpportunity.role} position. Given my background, I believe I can make a strong contribution to your team.\n\nBest regards,\nCandidate`
    };
  }
}
