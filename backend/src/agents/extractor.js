import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.LLM_API_KEY;

/**
 * Initializes the ChatGoogleGenerativeAI model.
 */
function getLLM() {
  if (!apiKey) {
    console.warn('Warning: LLM_API_KEY is not defined in the environment.');
  }
  return new ChatGoogleGenerativeAI({
    model: 'gemini-1.5-flash',
    apiKey: apiKey || '',
    temperature: 0
  });
}

/**
 * Agent that parses an email payload and extracts Job Description details.
 * 
 * @param {string} subject Email subject
 * @param {string} body Email body content
 * @returns {Promise<object>} Extracted JD details
 */
export async function extractJobDetails(subject, body) {
  const model = getLLM();
  
  // Use today's date from current local time metadata: August 24, 2026
  const currentDate = '2026-08-24';
  
  const systemPrompt = `You are an AI placement coordinator. Your task is to analyze email notifications regarding job placements and extract key Job Description (JD) parameters.

Analyze the subject and body of the email and extract the following parameters in a JSON object:
- company_name: Name of the hiring company.
- role: Job title or role (e.g., Software Development Engineer, Business Analyst).
- required_skills: A list of key technical or soft skills requested (e.g. ["Python", "SQL", "React", "Communication"]). Keep it concise.
- deadline: The application deadline. Convert natural language dates (e.g. "next Monday", "by Friday 5pm", "30th Aug") into a standard ISO-8601 date string ("YYYY-MM-DD") based on the current system date which is ${currentDate}. If no deadline is found, return null.
- cgpa: Minimum CGPA required (on a 10-point scale, e.g. 7.5, 8.0). If no CGPA requirement is specified, return null.

You must respond ONLY with a valid JSON object. Do not include any Markdown styling, code blocks (e.g. \`\`\`json), or conversational filler.

Example Output:
{
  "company_name": "Google",
  "role": "Software Engineering Intern",
  "required_skills": ["C++", "Algorithms", "System Design"],
  "deadline": "2026-08-31",
  "cgpa": 8.0
}`;

  const userPrompt = `Subject: ${subject}\n\nBody:\n${body}`;

  try {
    const response = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);
    
    let text = response.content;
    
    // Clean up response if LLM returned markdown code blocks
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
    
    const parsedData = JSON.parse(text);
    
    return {
      company_name: parsedData.company_name || 'Unknown Company',
      role: parsedData.role || 'Unknown Role',
      required_skills: Array.isArray(parsedData.required_skills) ? parsedData.required_skills : [],
      deadline: parsedData.deadline || null,
      cgpa: parsedData.cgpa ? parseFloat(parsedData.cgpa) : null
    };
  } catch (error) {
    console.error('Error during job detail extraction agent execution:', error);
    return {
      company_name: 'Unknown Company',
      role: 'Unknown Role',
      required_skills: [],
      deadline: null,
      cgpa: null
    };
  }
}
