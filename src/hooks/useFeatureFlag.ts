/**
 * useFeatureFlag — checks if a feature is enabled via the feature_flags table.
 * Returns { enabled, loading } for gating UI sections.
 * Falls back to enabled=true if query fails (fail-open for UX).
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeatureFlagResult {
  enabled: boolean;
  loading: boolean;
}

const cache = new Map<string, boolean>();

export function useFeatureFlag(key: string): FeatureFlagResult {
  const [enabled, setEnabled] = useState<boolean>(cache.get(key) ?? true);
  const [loading, setLoading] = useState(!cache.has(key));

  useEffect(() => {
    if (cache.has(key)) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("feature_flags")
          .select("enabled")
          .eq("key", key)
          .maybeSingle();

        if (!cancelled && !error && data) {
          const val = data.enabled ?? true;
          cache.set(key, val);
          setEnabled(val);
        }
      } catch {
        // Fail-open: feature stays enabled
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { enabled, loading };
}

/** Invalidate all cached flags (call after admin toggles) */
export function invalidateFeatureFlags() {
  cache.clear();
}
