-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Create users table (synchronized with auth.users)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  google_refresh_token text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.users enable row level security;

-- Create student_profiles table
create table public.student_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade unique not null,
  cgpa numeric(3, 2),
  raw_resume_text text,
  embedding vector(768), -- Dimension matches Gemini text-embedding-004
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.student_profiles enable row level security;

-- Create job_opportunities table
create table public.job_opportunities (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  role text not null,
  required_skills text[] default '{}'::text[] not null,
  deadline timestamptz,
  source_email_id text unique,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.job_opportunities enable row level security;

-- Create applications table
create table public.applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  job_id uuid references public.job_opportunities(id) on delete cascade not null,
  match_score numeric(5, 2) not null,
  missing_skills text[] default '{}'::text[] not null,
  generated_cover_letter text,
  status text default 'applied' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (user_id, job_id)
);

-- Enable Row Level Security
alter table public.applications enable row level security;

--------------------------------------------------------------------------------
-- Trigger for automatic user synchronization from auth.users to public.users
--------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to execute the function on auth user creation
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

--------------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
--------------------------------------------------------------------------------

-- public.users policies
create policy "Allow individual read of own user data"
  on public.users for select
  using (auth.uid() = id);

create policy "Allow individual update of own user data"
  on public.users for update
  using (auth.uid() = id);

-- public.student_profiles policies
create policy "Allow individual read of own student profile"
  on public.student_profiles for select
  using (auth.uid() = user_id);

create policy "Allow individual insert of own student profile"
  on public.student_profiles for insert
  with check (auth.uid() = user_id);

create policy "Allow individual update of own student profile"
  on public.student_profiles for update
  using (auth.uid() = user_id);

-- public.job_opportunities policies
create policy "Allow authenticated users to read all job opportunities"
  on public.job_opportunities for select
  to authenticated
  using (true);

-- public.applications policies
create policy "Allow individual read of own applications"
  on public.applications for select
  using (auth.uid() = user_id);

create policy "Allow individual insert of own applications"
  on public.applications for insert
  with check (auth.uid() = user_id);

create policy "Allow individual update of own applications"
  on public.applications for update
  using (auth.uid() = user_id);
