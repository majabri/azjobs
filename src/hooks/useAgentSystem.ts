import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AgentRun {
  id: string;
  status: string;
  agents_completed: string[];
  agent_timings: Record<string, number>;
  jobs_found: number;
  jobs_matched: number;
  applications_sent: number;
  errors: string[];
  started_at: string;
  completed_at: string | null;
}

export type AgentMode = "manual" | "smart" | "full-auto";

export interface AgentPrefs {
  mode: AgentMode;
  threshold: number;
  dailyCap: number;
}

export function useAgentSystem() {
  const [prefs, setPrefs] = useState<AgentPrefs>({
    mode: "manual",
    threshold: 70,
    dailyCap: 10,
  });
  const [running, setRunning] = useState(false);
  const [recentRuns, setRecentRuns] = useState<AgentRun[]>([]);
  const [liveRun, setLiveRun] = useState<AgentRun | null>(null);

  const loadRecentRuns = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("user_id", session.user.id)
      .order("started_at", { ascending: false })
      .limit(5);
    setRecentRuns((data as unknown as AgentRun[]) || []);
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("job_seeker_profiles")
        .select(
          "automation_mode, match_threshold, daily_apply_cap, min_match_score",
        )
        .eq("user_id", session.user.id)
        .single();
      if (data) {
        setPrefs({
          mode: (data.automation_mode || "manual") as AgentMode,
          threshold: data.match_threshold || data.min_match_score || 70,
          dailyCap: data.daily_apply_cap || 10,
        });
      }
      loadRecentRuns();
    };
    init();
  }, [loadRecentRuns]);

  useEffect(() => {
    const channel = supabase
      .channel("agent-runs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_runs" },
        (payload) => {
          const run = payload.new as AgentRun;
          if (run.status === "running") {
            setLiveRun(run);
          } else {
            setLiveRun(null);
            loadRecentRuns();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRecentRuns]);

  const updatePrefs = useCallback(
    async (updates: Partial<AgentPrefs>) => {
      const next = { ...prefs, ...updates };
      setPrefs(next);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await supabase
        .from("job_seeker_profiles")
        .update({
          automation_mode: next.mode,
          match_threshold: next.threshold,
          daily_apply_cap: next.dailyCap,
        })
        .eq("user_id", session.user.id);
    },
    [prefs],
  );

  const runAgents = useCallback(
    async (agents: string[]) => {
      setRunning(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "agent-orchestrator",
          {
            body: { agents },
          },
        );
        if (error) throw error;
        loadRecentRuns();
        return data;
      } finally {
        setRunning(false);
      }
    },
    [loadRecentRuns],
  );

  return { prefs, updatePrefs, running, runAgents, recentRuns, liveRun };
}
