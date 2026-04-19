-- Marketplace feature flags
-- Adds the 4 feature flags required by the remediation plan (TASK 2.2 / HIGH-009).
-- All are disabled by default — enable via /admin/settings once marketplace features are ready.

INSERT INTO feature_flags (key, enabled, description)
VALUES
  ('service_catalog',  false, 'Enable Fiverr-style talent service catalog for freelance offerings'),
  ('proposal_system',  false, 'Enable project proposal and bidding system'),
  ('contracts',        false, 'Enable contract lifecycle management (offers, milestones, completion)'),
  ('localization',     false, 'Enable multi-language support (i18n — en, es, fr, de)')
ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description;
