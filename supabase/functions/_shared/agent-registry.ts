/**
 * agent-registry.ts — Shared agent type registry
 *
 * The registry is CODE, not DB. Agent instances (state per user) live in
 * the user_agent_instances table. This module defines:
 *
 *   - AGENT_TYPES      — valid agent_type strings (matches DB CHECK constraint)
 *   - AGENT_FUNCTION_MAP — agent_type → edge function name
 *   - AGENT_SCHEDULES  — default TTL hours per agent type
 *   - AgentType        — TypeScript type
 *
 * Import this from any edge function that needs to know about other agents
 * (e.g. the wakeup logic, orchestrators, admin tools).
 */

// ── Agent type constants ──────────────────────────────────────────────────────

export const AGENT_TYPES = [
  "job_match",
  "salary_monitor",
  "market_intel",
  "interview_prep",
] as const;

export type AgentType = typeof AGENT_TYPES[number];

// ── Edge function names ───────────────────────────────────────────────────────

export const AGENT_FUNCTION_MAP: Record<AgentType, string> = {
  job_match:      "run-job-agent",
  salary_monitor: "run-salary-agent",
  market_intel:   "run-market-agent",
  interview_prep: "run-interview-agent",
};

// ── Default re-run schedules (hours between runs) ─────────────────────────────

export const AGENT_SCHEDULE_HOURS: Record<AgentType, number> = {
  job_match:      8,
  salary_monitor: 7 * 24,   // weekly
  market_intel:   30 * 24,  // monthly
  interview_prep: 0,         // on-demand only (triggered by job_applications INSERT)
};

// ── Which agents wake automatically on login ──────────────────────────────────
// interview_prep is excluded — it only fires when an application is saved.

export const WAKEUP_ON_LOGIN: AgentType[] = [
  "job_match",
  "salary_monitor",
  "market_intel",
];

// ── Helper: is an agent instance due for a run? ───────────────────────────────

export interface AgentInstance {
  agent_type: AgentType;
  status: "pending" | "running" | "idle" | "sleeping";
  next_run_at: string | null;
}

export function isAgentDue(instance: AgentInstance): boolean {
  if (instance.status === "running") return false;   // already in flight
  if (instance.status === "pending") return true;     // profile changed, run now
  if (!instance.next_run_at) return true;             // never run
  return new Date(instance.next_run_at) <= new Date();
}
