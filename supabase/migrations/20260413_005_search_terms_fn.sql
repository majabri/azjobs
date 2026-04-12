-- Helper function used by the scraper to fetch top user search terms dynamically.
CREATE OR REPLACE FUNCTION get_top_search_terms(limit_count integer DEFAULT 10)
RETURNS TABLE(search_term text, location text, search_count bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    search_term,
    COALESCE(location, 'United States') AS location,
    COUNT(*) AS search_count
  FROM search_queries
  WHERE queried_at > now() - interval '7 days'
    AND search_term IS NOT NULL
    AND length(trim(search_term)) > 2
  GROUP BY search_term, location
  ORDER BY search_count DESC
  LIMIT limit_count;
$$;
