-- 20260420_add_skill_synonyms_and_job_interactions.sql
-- Add skill_synonyms table (skill normalization) and job_interactions table (user actions).
-- Both confirmed missing in Phase 0 diagnostics (2026-04-20).

-- skill_synonyms: normalizes variant skill names to canonical forms
CREATE TABLE IF NOT EXISTS public.skill_synonyms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical   text NOT NULL,
  synonym     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical, synonym)
);

CREATE INDEX IF NOT EXISTS skill_synonyms_synonym_idx ON public.skill_synonyms (lower(synonym));
CREATE INDEX IF NOT EXISTS skill_synonyms_canonical_idx ON public.skill_synonyms (lower(canonical));

-- Seed common synonyms
INSERT INTO public.skill_synonyms (canonical, synonym) VALUES
  ('javascript', 'js'),
  ('javascript', 'ecmascript'),
  ('typescript', 'ts'),
  ('python', 'py'),
  ('react', 'reactjs'),
  ('react', 'react.js'),
  ('node.js', 'nodejs'),
  ('node.js', 'node'),
  ('postgresql', 'postgres'),
  ('postgresql', 'psql'),
  ('kubernetes', 'k8s'),
  ('machine learning', 'ml'),
  ('artificial intelligence', 'ai'),
  ('amazon web services', 'aws'),
  ('google cloud platform', 'gcp'),
  ('microsoft azure', 'azure'),
  ('continuous integration', 'ci/cd'),
  ('devops', 'dev ops'),
  ('graphql', 'graph ql'),
  ('restful api', 'rest api'),
  ('restful api', 'rest'),
  ('sql', 'structured query language'),
  ('c++', 'cpp'),
  ('objective-c', 'objc')
ON CONFLICT (canonical, synonym) DO NOTHING;

-- job_interactions: tracks user actions on jobs (saved, applied, dismissed, etc.)
CREATE TABLE IF NOT EXISTS public.job_interactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id          uuid,
  external_job_id text,
  source_table    text NOT NULL DEFAULT 'job_postings',
  action          text NOT NULL CHECK (action IN ('viewed', 'saved', 'applied', 'dismissed', 'shared')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS job_interactions_user_id_idx ON public.job_interactions (user_id);
CREATE INDEX IF NOT EXISTS job_interactions_action_idx ON public.job_interactions (user_id, action);
CREATE INDEX IF NOT EXISTS job_interactions_job_id_idx ON public.job_interactions (job_id) WHERE job_id IS NOT NULL;

-- RLS
ALTER TABLE public.skill_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_interactions ENABLE ROW LEVEL SECURITY;

-- skill_synonyms: public read
CREATE POLICY "skill_synonyms_public_read" ON public.skill_synonyms
  FOR SELECT USING (true);

-- job_interactions: users see only their own
CREATE POLICY "job_interactions_user_select" ON public.job_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "job_interactions_user_insert" ON public.job_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "job_interactions_user_delete" ON public.job_interactions
  FOR DELETE USING (auth.uid() = user_id);
