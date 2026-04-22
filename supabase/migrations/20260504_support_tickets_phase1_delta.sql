-- ============================================================
-- Phase 1 delta: bring existing support_tickets up to spec
-- and add ticket_messages + is_staff() + triggers
-- (support_agent enum value committed in prior migration)
-- ============================================================

-- ────────────────────────────────────────────
-- 1. Alter support_tickets — add missing columns
-- ────────────────────────────────────────────

-- Make user_id nullable for email-sourced guest tickets
ALTER TABLE public.support_tickets
  ALTER COLUMN user_id DROP NOT NULL;

-- category (alongside existing request_type)
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general','account','billing','bug','feature_request','other'));

-- source to distinguish web vs inbound email (bugs@icareeros.com)
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web','email'));

-- guest_email for non-registered inbound email senders
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

-- ────────────────────────────────────────────
-- 2. Sequence-based ticket numbering
-- ────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START 1;

CREATE OR REPLACE FUNCTION public.set_ticket_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TKT-' || LPAD(nextval('public.support_ticket_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ticket_number ON public.support_tickets;
CREATE TRIGGER trg_set_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();

-- ────────────────────────────────────────────
-- 3. ticket_messages table
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        UUID        NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  body             TEXT        NOT NULL,
  is_internal_note BOOLEAN     NOT NULL DEFAULT FALSE,
  is_staff_reply   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);

-- ────────────────────────────────────────────
-- 4. Bump ticket updated_at on new message
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bump_ticket_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_tickets SET updated_at = NOW() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_ticket_updated_at ON public.ticket_messages;
CREATE TRIGGER trg_bump_ticket_updated_at
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_ticket_updated_at();

-- ────────────────────────────────────────────
-- 5. is_staff() — uses existing has_role() + user_roles
--    Grants access for admin or support_agent
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'support_agent'::public.app_role);
$$;

-- ────────────────────────────────────────────
-- 6. Refresh support_tickets RLS — clean slate
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage all tickets"   ON public.support_tickets;
DROP POLICY IF EXISTS "Service role can manage tickets"  ON public.support_tickets;
DROP POLICY IF EXISTS "admins can manage tickets"        ON public.support_tickets;
DROP POLICY IF EXISTS "users can read own tickets"       ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view own tickets"       ON public.support_tickets;
DROP POLICY IF EXISTS "Users can insert own tickets"     ON public.support_tickets;
DROP POLICY IF EXISTS "Users can update own tickets"     ON public.support_tickets;
DROP POLICY IF EXISTS "tickets_select"                   ON public.support_tickets;
DROP POLICY IF EXISTS "tickets_insert"                   ON public.support_tickets;
DROP POLICY IF EXISTS "tickets_update"                   ON public.support_tickets;

CREATE POLICY "tickets_select"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff());

CREATE POLICY "tickets_insert"
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id AND user_id IS NOT NULL)
    OR public.is_staff()
  );

CREATE POLICY "tickets_update"
  ON public.support_tickets FOR UPDATE
  USING (public.is_staff());

-- ────────────────────────────────────────────
-- 7. RLS — ticket_messages
-- ────────────────────────────────────────────
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select"
  ON public.ticket_messages FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = ticket_id AND t.user_id = auth.uid()
      )
      AND NOT is_internal_note
    )
    OR public.is_staff()
  );

CREATE POLICY "messages_insert_user"
  ON public.ticket_messages FOR INSERT
  WITH CHECK (
    NOT is_internal_note
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.user_id = auth.uid()
        AND t.status NOT IN ('resolved', 'closed')
    )
  );

CREATE POLICY "messages_insert_staff"
  ON public.ticket_messages FOR INSERT
  WITH CHECK (public.is_staff());

-- ────────────────────────────────────────────
-- 8. Additional indexes
-- ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_tickets_source  ON public.support_tickets(source);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status  ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
