import dotenv from 'dotenv';
import { extractJobDetails } from '../agents/extractor.js';
import { generateEmbedding, matchResumeWithJob } from '../agents/matcher.js';

dotenv.config();

async function runTests() {
  console.log('=== STARTING PLACEMENTOPS AGENT PIPELINE VERIFICATION ===');
  
  if (!process.env.LLM_API_KEY) {
    console.error('Error: LLM_API_KEY environment variable is not defined.');
    console.error('Please configure your API key in backend/.env to run LLM tests.');
    return;
  }
  
  try {
    // 1. Verify Embeddings API
    console.log('\n[1/3] Testing Gemini Embeddings API...');
    const sampleText = 'Siddharth is a Full Stack Software Developer specialized in React, Node.js and Postgres.';
    const embedding = await generateEmbedding(sampleText);
    console.log(`Success! Generated vector embedding of length: ${embedding.length} (Expected: 768)`);
    
    // 2. Verify Extraction Agent
    console.log('\n[2/3] Testing Gemini Job Detail Extraction Agent...');
    const subject = 'Campus Placement: Software Engineer at Stripe';
    const body = `Dear Students,
    Stripe is visiting campus to hire Software Engineering Interns.
    
    Requirements:
    - Branches: CSE, ECE
    - Cutoff Criteria: CGPA >= 8.5
    - Tech Stack: Ruby, React, TypeScript, APIs, SQL
    - Application Deadline: August 29, 2026
    
    Apply as soon as possible.
    Best,
    Placement Cell`;
    
    const extracted = await extractJobDetails(subject, body);
    console.log('Success! Extracted parameters:');
    console.log(JSON.stringify(extracted, null, 2));
    
    // 3. Verify Matcher Agent & Cover Letter Generation
    console.log('\n[3/3] Testing Resume Similarity Matching and Cover Letter Generation...');
    const mockStudentProfile = {
      cgpa: 8.9,
      raw_resume_text: `Siddharth
      Full Stack Software Engineering student.
      Skills: JavaScript, TypeScript, React, HTML, Node.js, Express, Postgres, SQL, REST APIs.
      Experience: Created telemetry dashboard platforms and built cross-device clipboard sync services.
      CGPA: 8.90`,
      embedding: embedding // Uses our generated test embedding
    };
    
    const analysis = await matchResumeWithJob(mockStudentProfile, extracted);
    console.log('Success! RAG Matching result:');
    console.log(`Match Score: ${analysis.match_score}%`);
    console.log(`Missing Skills: ${JSON.stringify(analysis.missing_skills)}`);
    console.log('\nGenerated Cover Letter Preview:');
    console.log('--------------------------------------------------');
    console.log(analysis.generated_cover_letter);
    console.log('--------------------------------------------------');
    
    console.log('\n=== ALL PIPELINE AGENT VERIFICATIONS PASSED ===');
  } catch (error) {
    console.error('\n❌ Verification test failed with error:', error);
  }
}

runTests();
