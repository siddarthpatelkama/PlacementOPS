# PlacementOps (Autonomous Placement Operations Agent)

PlacementOps is an autonomous background agent designed to streamline college placement preparation. It monitors incoming placement announcements in Gmail, extracts candidate eligibility criteria and job descriptions, cross-references requirements against a vector-embedded resume, calculates match scores, and drafts tailored application materials.

---

## 1. Project Architecture

The platform is split into a Next.js client application and a background Node.js service engine:

* **Frontend**: Next.js App Router, Tailwind CSS, Lucide Icons, Supabase Client. (Target: Vercel)
* **Backend Agent**: Node.js, Express, LangChain with Google Gemini, Supabase Admin Client. (Target: Render)
* **Database**: Supabase PostgreSQL with `pgvector` enabled for high-dimensional semantic search.
* **LLM Model**: Google Gemini (`gemini-1.5-flash` for details extraction and cover letter drafts, `text-embedding-004` for 768-dimensional text embeddings).

---

## 2. Database Schema Setup

To initialize the database, execute the SQL commands found in [supabase/schema.sql](file:///s:/PlacementOPS/supabase/schema.sql) in your Supabase SQL Editor. This script:
1. Enables the `pgvector` extension.
2. Creates the `users`, `student_profiles`, `job_opportunities`, and `applications` tables.
3. Configures triggers to synchronize new Supabase Auth users to the public profile table.
4. Adds Row Level Security (RLS) policies for user data isolation.

---

## 3. Environment Variables Configuration

Create a `.env` file in both directories using the templates provided:

### Backend Configuration (`backend/.env`):
Check `backend/.env.example` for details:
```env
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
LLM_API_KEY=your-gemini-api-key
FRONTEND_URL=http://localhost:3000
```

### Frontend Configuration (`frontend/.env.local`):
Check `frontend/.env.example` for details:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

---

## 4. Running the Project

### Start Backend Server:
```bash
cd backend
npm install
npm run dev
```

### Start Frontend Server:
```bash
cd frontend
npm install
npm run dev
```

---

## 5. Local Verification & Pipeline Dry-Runs

To verify the Gemini AI embeddings, LangChain JD extraction, and RAG matching pipeline without setting up Gmail OAuth or webhooks, we have written an integration test script.

1. Ensure your `LLM_API_KEY` is configured in `backend/.env`.
2. Run the following command in the `backend/` directory:
```bash
node src/tests/verify.js
```
This runs:
* **Embeddings Test**: Generates a 768-dimension vector using `text-embedding-004`.
* **Extraction Test**: Parses a sample campus placement email from Stripe and structures it into JSON.
* **Similarity Matching & Cover Letter**: Computes cosine similarity, checks CGPA cutoffs, identifies missing skills, and outputs a custom-written cover letter.
