
-- Ticket responses / conversation thread
CREATE TABLE public.ticket_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  is_admin_response boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket owners can view responses"
  ON public.ticket_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all responses"
  ON public.ticket_responses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage responses"
  ON public.ticket_responses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ticket_responses_ticket ON public.ticket_responses (ticket_id, created_at);

-- Add assignment column to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to uuid;
