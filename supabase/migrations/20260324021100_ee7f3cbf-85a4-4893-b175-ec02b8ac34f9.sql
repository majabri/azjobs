
CREATE POLICY "Users can update own analyses" ON public.analysis_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
