
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
