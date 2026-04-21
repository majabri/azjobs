/**
 * Analytics Service — Core logic.
 * Owns: analysis history, dashboard data.
 * No imports from other services.
 */

import { supabase } from "@/integrations/supabase/client";
import type { AnalysisRecord } from "./types";
import { logger } from '@/lib/logger';

export async function loadAnalysisHistory(userId: string): Promise<AnalysisRecord[]> {
  const { data, error } = await supabase
    .from("analysis_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) { logger.error("[AnalyticsService]", error); return []; }
  return (data || []) as AnalysisRecord[];
}

export async function updateLastActive(userId: string): Promise<void> {
  await supabase.from("job_seeker_profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", userId);
}
