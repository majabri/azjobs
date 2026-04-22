-- Must be a separate committed transaction before support_agent can be referenced in is_staff()
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_agent';
