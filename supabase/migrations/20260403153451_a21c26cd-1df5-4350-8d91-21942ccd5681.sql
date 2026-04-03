-- Fix 1: Add INSERT policy on ticket_responses so authenticated users can only respond to their own tickets
CREATE POLICY "Users can insert responses on own tickets"
ON public.ticket_responses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_responses.ticket_id
    AND user_id = auth.uid()
  )
);

-- Fix 2: Replace anon SELECT on user_portfolio_items with authenticated-only
DROP POLICY IF EXISTS "Anyone can view portfolio items" ON public.user_portfolio_items;
CREATE POLICY "Authenticated users can view portfolio items"
ON public.user_portfolio_items
FOR SELECT
TO authenticated
USING (true);