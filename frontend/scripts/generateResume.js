const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'public', 'demo-data');
const outputPath = path.join(outputDir, 'Siddarth_Tech_Resume.pdf');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create a document
const doc = new PDFDocument();

// Pipe its output somewhere, like to a file or HTTP response
// See below for browser usage
const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Set standard font
doc.font('Helvetica');

// Add text
doc.fontSize(16).text('Siddarth Patel Kama | Full-Stack AI Engineer', { align: 'center' });
doc.moveDown();

doc.fontSize(12).text('Education:', { underline: true });
doc.fontSize(10).text('Bachelor of Science in Computer Science Engineering (AI & Data Science), Vel Tech Rangarajan Dr. Sagunthala R & D Institute (Expected May 2028). NxtWave CCBP 4.0 Academy (Full-Stack & AI).');
doc.moveDown();

doc.fontSize(12).text('Skills:', { underline: true });
doc.fontSize(10).text('Next.js, Express.js, Node.js, React, Python, Java, SQL, Firebase, Supabase, pgvector, LangGraph, Google Gemini AI Integrations, Prompt Engineering.');
doc.moveDown();

doc.fontSize(12).text('Key Projects:', { underline: true });
doc.fontSize(10).text('PlacementOps: Autonomous AI agent built with LangGraph and Supabase pgvector for automated job matching and personalized cover letter generation.');
doc.moveDown();
doc.text('IdentityBridge: Multimodal AI system for emergency identification developed for the Idea2Impact Hackathon.');
doc.moveDown();
doc.text('UBA Attendance System: Engineered an anti-proxy dynamic QR code attendance management system using Next.js and Firebase.');
doc.moveDown();
doc.text('Smart Notes Hub: Full-stack application for automated AI summaries and flashcard generation.');
doc.moveDown();

doc.fontSize(12).text('Achievements:', { underline: true });
doc.fontSize(10).text("First Prize at Codeathon'25 (Vel Tech), Top 20 out of 900 participants at Hackelite 2025 (SRMIST), Completed 5-Day Kaggle & Google AI Agents Intensive.");

// Finalize PDF file
doc.end();

writeStream.on('finish', () => {
  console.log('Resume generated successfully');
});

writeStream.on('error', (err) => {
  console.error('Error generating resume:', err);
});
