# spec.md - PlacementOps (Autonomous Placement Operations Agent)

## 1. Project Overview & Problem Statement
* **Problem Statement**: College placement preparation is highly fragmented across emails, company PDFs, and distinct application portals. Students miss deadlines and fail to tailor resumes due to the manual overhead of tracking and analyzing Job Descriptions (JDs).
* **Solution**: PlacementOps is an autonomous background agent that connects to a user's Gmail, monitors incoming placement announcements, extracts requirements, cross-references them against the user's vector-embedded resume, identifies skill gaps, and auto-generates tailored application materials.
* **Target Completion Level**: Outstanding (Advanced features + strong AI integration + security + distinct microservice architecture).

## 2. Technology Stack & Deployment Architecture
Match the required hackathon deployment model strictly.

| Component | Technology | Target Deployment |
| :--- | :--- | :--- |
| **Frontend** | Next.js (React), Tailwind CSS, Lucide Icons | Vercel |
| **Backend/Agent** | Node.js, Express, LangChain | Render |
| **Database** | Supabase (PostgreSQL + pgvector) | Supabase |
| **Authentication** | Supabase Auth (Google OAuth provider) | Supabase |
| **AI/LLM** | Gemini API / OpenAI API | N/A |

## 3. Core Features (Must-Have & Outstanding Tier)
* **Google OAuth Integration**: Secure login requesting strictly `https://www.googleapis.com/auth/gmail.readonly` scope.
* **Vectorized Resume Hub**: Users upload their resume/skills. The system parses and stores this as vector embeddings in Supabase using pgvector.
* **Background Ingestion Engine (Backend)**: A Node.js cron job polls the Gmail API for authorized users, filtering for "placement" or "hiring" keywords.
* **Agentic Analysis Pipeline**:
  * Extracts JD parameters (CGPA, skills, deadline) from the email payload.
  * Runs a semantic similarity check against the user's vector profile.
  * Calculates a "Match Score".
* **Action Generation**: Automatically drafts a targeted cover letter bridging the gap between the JD and the user's actual skills.
* **Dashboard UI**: A responsive Next.js frontend displaying an active pipeline of "New Roles", "Matched Roles", "Missing Skills", and "Generated Assets".

## 4. Database Schema (Supabase)
### Table Name: `users`
* Core Columns: `id` (UUID, primary key, links to Supabase Auth `users.id`), `email` (text), `google_refresh_token` (text), `created_at` (timestamptz)
* Notes: Handled via Supabase Auth + Trigger

### Table Name: `student_profiles`
* Core Columns: `id` (UUID, primary key), `user_id` (UUID, references `users(id)`), `cgpa` (numeric), `raw_resume_text` (text), `embedding` (vector(1536) or other dimension depending on model)
* Notes: 1-to-1 with `users`

### Table Name: `job_opportunities`
* Core Columns: `id` (UUID, primary key), `company_name` (text), `role` (text), `required_skills` (text[]), `deadline` (timestamp), `source_email_id` (text)
* Notes: Stores extracted JD data

### Table Name: `applications`
* Core Columns: `id` (UUID, primary key), `user_id` (UUID, references `users(id)`), `job_id` (UUID, references `job_opportunities(id)`), `match_score` (numeric), `missing_skills` (text[]), `generated_cover_letter` (text), `status` (text)
* Notes: Links users to `job_opportunities`

## 5. API Routes (Render Backend)
* `POST /api/webhooks/ingest` - Triggered manually or via cron to fetch new emails using stored refresh tokens.
* `POST /api/agent/analyze` - Receives email payload, extracts JD, and triggers the RAG matching sequence against `student_profiles`.
* `GET /api/jobs/matched/:user_id` - Retrieves the scored list of jobs and generated assets for the frontend dashboard.
* `POST /api/profile/upload` - Handles raw resume text ingestion, generates embeddings via LLM, and inserts into `student_profiles`.

## 6. Repository Structure
Ensure the `.gitignore` strictly excludes all `.env` files.

```
project/
│
├── frontend/                  # Next.js Application (Vercel)
│   ├── src/
│   │   ├── app/               # App Router pages (Dashboard, Login)
│   │   ├── components/        # UI components (JobCards, SkillMatrix)
│   │   └── lib/               # Supabase client setup
│   ├── package.json
│   └── .env.example
│
├── backend/                   # Node.js Agent Engine (Render)
│   ├── src/
│   │   ├── agents/            # LangChain/LLM logic (Planner, Extractor)
│   │   ├── routes/            # Express API endpoints
│   │   ├── services/          # Gmail API polling logic
│   │   └── db/                # Supabase server admin client
│   ├── package.json
│   └── .env.example
│
├── README.md                  # Project documentation
└── .gitignore                 # Blocks .env, node_modules
```

## 7. Security & Environment Variables
The application requires strict separation of public and private keys. Do not hardcode these.

### Frontend (`frontend/.env.example`):
* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Backend (`backend/.env.example`):
* `SUPABASE_SERVICE_ROLE_KEY` (Required for bypassing RLS during background agent tasks)
* `SUPABASE_URL`
* `GOOGLE_CLIENT_ID`
* `GOOGLE_CLIENT_SECRET`
* `GOOGLE_REDIRECT_URI`
* `LLM_API_KEY` (Gemini API key or OpenAI key)
