/**
 * Learning Service — Core logic.
 * Owns: learning events, outcome tracking.
 * No imports from other services.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { logger } from '@/lib/logger';

export interface LearningEvent {
  id: string;
  outcome: string;
  features: Record<string, unknown>;
  insights: Record<string, unknown> | null;
  created_at: string;
}

export async function loadLearningEvents(userId: string): Promise<LearningEvent[]> {
  const { data, error } = await supabase
    .from("learning_events")
    .select("id, outcome, features, insights, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) { logger.error("[LearningService]", error); return []; }
  return (data || []) as unknown as LearningEvent[];
}

export async function recordLearningEvent(
  userId: string,
  outcome: string,
  features: Record<string, unknown>,
  applicationId?: string,
  jobId?: string,
): Promise<void> {
  await supabase.from("learning_events").insert({
    user_id: userId,
    outcome,
    features: features as Json,
    application_id: applicationId || null,
    job_id: jobId || null,
  });
}
