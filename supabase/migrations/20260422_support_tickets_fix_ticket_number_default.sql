-- Fix ticket_number generation: drop UUID-based column default so the
-- trg_set_ticket_number trigger fires and produces sequential TKT-0001 numbers.
-- Previously the column default ('TKT-' || substr(gen_random_uuid(), 1, 8))
-- ran before the BEFORE INSERT trigger could see a NULL, preventing the
-- sequence from ever being used.

ALTER TABLE public.support_tickets ALTER COLUMN ticket_number DROP DEFAULT;
