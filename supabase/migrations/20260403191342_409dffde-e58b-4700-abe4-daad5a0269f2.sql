
ALTER TABLE public.job_seeker_profiles ADD COLUMN IF NOT EXISTS search_mode text DEFAULT 'balanced';

CREATE TABLE IF NOT EXISTS public.search_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.search_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own presets" ON public.search_presets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
