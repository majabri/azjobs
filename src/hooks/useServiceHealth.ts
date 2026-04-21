/**
 * useServiceHealth — fetches service health status for admin dashboard.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/lib/logger';

export interface ServiceHealthEntry {
  id: string;
  service_name: string;
  status: string;
  last_check: string;
  error_count: number;
  circuit_breaker_open: boolean;
  last_error: string | null;
}

export function useServiceHealth() {
  const [services, setServices] = useState<ServiceHealthEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("service_health")
        .select("*")
        .order("service_name");
      setServices((data || []) as ServiceHealthEntry[]);
    } catch (e) {
      logger.error("[useServiceHealth]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { services, loading, refresh };
}
