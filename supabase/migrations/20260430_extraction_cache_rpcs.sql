-- Helper RPCs for adaptive extraction cache — atomic counter increments.

CREATE OR REPLACE FUNCTION increment_extraction_success(p_domain text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO domain_extraction_hints (domain, success_count, failure_count)
    VALUES (p_domain, 1, 0)
  ON CONFLICT (domain)
  DO UPDATE SET
    success_count = domain_extraction_hints.success_count + 1,
    last_seen_at  = now(),
    updated_at    = now();
END;
$$;

CREATE OR REPLACE FUNCTION increment_extraction_failure(p_domain text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO domain_extraction_hints (domain, success_count, failure_count)
    VALUES (p_domain, 0, 1)
  ON CONFLICT (domain)
  DO UPDATE SET
    failure_count = domain_extraction_hints.failure_count + 1,
    last_seen_at  = now(),
    updated_at    = now();
END;
$$;

GRANT EXECUTE ON FUNCTION increment_extraction_success(text) TO service_role;
GRANT EXECUTE ON FUNCTION increment_extraction_failure(text) TO service_role;
