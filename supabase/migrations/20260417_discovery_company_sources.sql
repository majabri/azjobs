-- =============================================================================
-- Discovery Company Sources
-- Migration: 20260417_discovery_company_sources.sql
--
-- Lookup table used by the greenhouse and lever adapters in discovery-agent.
-- Each row is one company board that the Discovery Agent will poll.
-- Add/remove rows to control which boards are scraped without code changes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.discovery_company_sources (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ats             text        NOT NULL CHECK (ats IN ('greenhouse','lever','ashby')),
  company_slug    text        NOT NULL,
  display_name    text,
  enabled         boolean     DEFAULT true,
  last_polled_at  timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (ats, company_slug)
);

CREATE INDEX IF NOT EXISTS idx_discovery_company_sources_ats_enabled
  ON public.discovery_company_sources (ats, enabled);

ALTER TABLE public.discovery_company_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discovery_company_sources readable by authenticated"
  ON public.discovery_company_sources FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── Greenhouse boards (top tech employers with public job APIs) ───────────────
INSERT INTO public.discovery_company_sources (ats, company_slug, display_name) VALUES
  ('greenhouse', 'stripe',          'Stripe'),
  ('greenhouse', 'airbnb',          'Airbnb'),
  ('greenhouse', 'lyft',            'Lyft'),
  ('greenhouse', 'coinbase',        'Coinbase'),
  ('greenhouse', 'robinhood',       'Robinhood'),
  ('greenhouse', 'brex',            'Brex'),
  ('greenhouse', 'figma',           'Figma'),
  ('greenhouse', 'notion',          'Notion'),
  ('greenhouse', 'airtable',        'Airtable'),
  ('greenhouse', 'reddit',          'Reddit'),
  ('greenhouse', 'doordash',        'DoorDash'),
  ('greenhouse', 'instacart',       'Instacart'),
  ('greenhouse', 'plaid',           'Plaid'),
  ('greenhouse', 'gusto',           'Gusto'),
  ('greenhouse', 'zendesk',         'Zendesk'),
  ('greenhouse', 'hubspot',         'HubSpot'),
  ('greenhouse', 'dropbox',         'Dropbox'),
  ('greenhouse', 'twilio',          'Twilio'),
  ('greenhouse', 'hashicorp',       'HashiCorp'),
  ('greenhouse', 'cloudflare',      'Cloudflare'),
  ('greenhouse', 'mongodb',         'MongoDB'),
  ('greenhouse', 'databricks',      'Databricks'),
  ('greenhouse', 'snowflakecomputing', 'Snowflake'),
  ('greenhouse', 'confluent',       'Confluent'),
  ('greenhouse', 'datadog',         'Datadog'),
  ('greenhouse', 'github',          'GitHub'),
  ('greenhouse', 'gitlab',          'GitLab')
ON CONFLICT (ats, company_slug) DO NOTHING;

-- ── Lever boards ─────────────────────────────────────────────────────────────
INSERT INTO public.discovery_company_sources (ats, company_slug, display_name) VALUES
  ('lever', 'netflix',          'Netflix'),
  ('lever', 'shopify',          'Shopify'),
  ('lever', 'square',           'Square'),
  ('lever', 'atlassian',        'Atlassian'),
  ('lever', 'canva',            'Canva'),
  ('lever', 'intercom',         'Intercom'),
  ('lever', 'pagerduty',        'PagerDuty'),
  ('lever', 'elastic',          'Elastic'),
  ('lever', 'cloudkitchens',    'CloudKitchens'),
  ('lever', 'benchling',        'Benchling')
ON CONFLICT (ats, company_slug) DO NOTHING;
