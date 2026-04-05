
-- Add is_public flag to portfolio items (default true to preserve existing public profile behavior)
ALTER TABLE public.user_portfolio_items ADD COLUMN is_public boolean NOT NULL DEFAULT true;

-- Drop the overly permissive SELECT policy
DROP POLICY "Authenticated users can view portfolio items" ON public.user_portfolio_items;

-- New policy: users can view their own items OR items marked as public
CREATE POLICY "Users can view own or public portfolio items"
ON public.user_portfolio_items FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_public = true);

-- Allow anonymous users to view public items (for the public profile page)
CREATE POLICY "Anyone can view public portfolio items"
ON public.user_portfolio_items FOR SELECT TO anon
USING (is_public = true);
