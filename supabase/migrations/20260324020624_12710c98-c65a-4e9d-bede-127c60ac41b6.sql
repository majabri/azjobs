
CREATE TABLE public.analysis_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_title text DEFAULT '',
  company text DEFAULT '',
  job_description text NOT NULL DEFAULT '',
  resume_text text NOT NULL DEFAULT '',
  overall_score integer NOT NULL DEFAULT 0,
  matched_skills jsonb DEFAULT '[]',
  gaps jsonb DEFAULT '[]',
  strengths jsonb DEFAULT '[]',
  improvement_plan jsonb DEFAULT '[]',
  summary text DEFAULT '',
  optimized_resume text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON public.analysis_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON public.analysis_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses" ON public.analysis_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_analysis_history_user_id ON public.analysis_history(user_id);
CREATE INDEX idx_analysis_history_created_at ON public.analysis_history(created_at DESC);
