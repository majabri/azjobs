/**
 * Shared Agent Types — data contracts for the agent pipeline layer.
 *
 * Import EnrichedJob and OrchestratorResult from here when the consuming
 * module is outside the matching/orchestrator service boundary.
 * This avoids coupling UI components or other services to internal
 * service modules.
 */

export type { EnrichedJob } from "@/services/matching/api";
export type { OrchestratorResult } from "@/shell/orchestrator";
