/**
 * useAgentWakeup — Unified agent wakeup hook
 *
 * Called once per session after the user successfully authenticates.
 * Checks which agent instances are pending or overdue, then fires their
 * corresponding edge functions in parallel (fire-and-forget).
 *
 * Rules:
 *  - Never blocks login or page load
 *  - Only wakes agents registered in WAKEUP_ON_LOGIN (excludes interview_prep)
 *  - interview_prep is triggered by DB trigger on job_applications INSERT,
 *    but will still be picked up here if it arrives in a 'pending' state
 *  - Does not double-fire: skips agents with status='running'
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Agent registry (mirrors _shared/agent-registry.ts) ───────────────────────

const AGENT_FUNCTION_MAP: Record<string, string> = {
  job_match: "run-job-agent",
  salary_monitor: "run-salary-agent",
  market_intel: "run-market-agent",
  interview_prep: "run-interview-agent",
};

// Agents woken automatically at login (interview_prep is on-demand)
const WAKEUP_ON_LOGIN = [
  "job_match",
  "salary_monitor",
  "market_intel",
  "interview_prep",
];

// ── Core wakeup function ──────────────────────────────────────────────────────

export async function wakeAgents(userId: string): Promise<void> {
  // Load all agent instances for this user
  let instances: any[] = [];
  try {
    const { data, error } = await supabase
      .from("user_agent_instances")
      .select("agent_type, status, next_run_at")
      .eq("user_id", userId);
    if (!error) instances = data ?? [];
  } catch (_) {
    // user_agent_instances table may not exist yet (migrations pending)
    return;
  }

  // Build a map of existing instances
  const instanceMap = new Map(instances.map((a: any) => [a.agent_type, a]));

  // Determine which agents to wake
  const toWake: string[] = [];

  for (const agentType of WAKEUP_ON_LOGIN) {
    const inst = instanceMap.get(agentType);

    if (!inst) {
      // No instance row yet — treat as pending (will be created on first run)
      toWake.push(agentType);
      continue;
    }

    if (inst.status === "running") continue; // already in flight

    const isDue =
      inst.status === "pending" ||
      !inst.next_run_at ||
      new Date(inst.next_run_at) <= new Date();

    if (isDue) toWake.push(agentType);
  }

  if (toWake.length === 0) return;

  // Fire-and-forget in parallel — don't await, don't block UI
  for (const agentType of toWake) {
    const fnName = AGENT_FUNCTION_MAP[agentType];
    if (!fnName) continue;
    supabase.functions.invoke(fnName, { body: {} }).catch((err: unknown) => {
      // Silently swallow — agents are best-effort, never block the user
      console.debug(`[useAgentWakeup] ${agentType} wakeup failed:`, err);
    });
  }
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * Call inside AuthenticatedLayout or any component that mounts after login.
 * Runs once per session (guarded by hasFiredRef).
 */
export function useAgentWakeup(userId: string | null | undefined): void {
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!userId || hasFiredRef.current) return;
    hasFiredRef.current = true;

    // Slight delay so the UI renders before background work starts
    const timer = setTimeout(() => {
      wakeAgents(userId).catch(() => {
        // Silently ignore — background agents must never crash the app
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [userId]);
}
