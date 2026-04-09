-- Marketplace feature flags and admin settings for iCareerOS Gig Marketplace
-- Seeds new flags into admin_settings (existing table from admin_control_center migration)

INSERT INTO public.admin_settings (key, value, description)
VALUES
  ('marketplace_enabled',          'true'::jsonb,   'Enable the iCareerOS Gig Marketplace'),
  ('marketplace_commission_rate',  '10'::jsonb,     'Platform commission percentage on gig transactions'),
  ('marketplace_max_gig_price',    '10000'::jsonb,  'Maximum allowed gig listing price (USD)'),
  ('marketplace_auto_approve',     'false'::jsonb,  'Auto-approve new gig listings without admin review'),
  ('marketplace_featured_limit',   '12'::jsonb,     'Maximum number of featured listings on marketplace homepage'),
  ('marketplace_min_rating',       '3.5'::jsonb,    'Minimum provider rating to appear in search results'),
  ('marketplace_escrow_enabled',   'true'::jsonb,   'Enable escrow-based payment protection for gig transactions'),
  ('marketplace_categories',       '"career_coaching,resume_writing,interview_prep,linkedin_optimization,salary_negotiation,portfolio_review,networking_strategy,job_search_strategy"'::jsonb, 'Comma-separated list of marketplace service categories')
ON CONFLICT (key) DO NOTHING;
