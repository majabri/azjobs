import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface AgentHealth {
  agent: string;
  runs: number;
  successes: number;
  failures: number;
  avgTime: number;
}

export default function AgentHealthDashboard() {
  const [health, setHealth] = useState<AgentHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("agent_runs")
        .select("agents_completed, agent_timings, errors, status")
        .eq("user_id", session.user.id)
        .order("started_at", { ascending: false })
        .limit(30);

      const agents = [
        "discovery",
        "matching",
        "optimization",
        "application",
        "learning",
      ];
      const stats: AgentHealth[] = agents.map((agent) => {
        let runs = 0,
          successes = 0,
          failures = 0,
          totalTime = 0;
        for (const run of data || []) {
          const completed = (run.agents_completed as string[]) || [];
          const timings = (run.agent_timings as Record<string, number>) || {};
          const errs = (run.errors as string[]) || [];
          if (completed.includes(agent) || timings[agent] != null) {
            runs++;
            if (errs.some((e) => e.toLowerCase().includes(agent))) failures++;
            else successes++;
            if (timings[agent]) totalTime += timings[agent];
          }
        }
        return {
          agent,
          runs,
          successes,
          failures,
          avgTime: runs > 0 ? Math.round(totalTime / runs) : 0,
        };
      });
      setHealth(stats);
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (loading || health.every((h) => h.runs === 0)) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-accent" />
        <h3 className="font-display font-bold text-primary text-sm">
          Agent Health (Last 30 Runs)
        </h3>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {health.map((h) => {
          const rate =
            h.runs > 0 ? Math.round((h.successes / h.runs) * 100) : 0;
          const color =
            rate >= 80
              ? "text-success"
              : rate >= 50
                ? "text-warning"
                : "text-destructive";
          const consecutive = h.failures >= 3;
          return (
            <div
              key={h.agent}
              className={`text-center p-3 rounded-lg border ${consecutive ? "border-destructive/30 bg-destructive/5" : "border-border"}`}
            >
              <p className="text-xs font-medium text-foreground capitalize mb-1">
                {h.agent}
              </p>
              <p className={`font-display font-bold text-lg ${color}`}>
                {rate}%
              </p>
              <p className="text-[10px] text-muted-foreground">{h.runs} runs</p>
              {h.avgTime > 0 && (
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                  {h.avgTime < 1000
                    ? `${h.avgTime}ms`
                    : `${(h.avgTime / 1000).toFixed(1)}s`}
                </p>
              )}
              {consecutive && (
                <Badge
                  variant="outline"
                  className="text-[8px] text-destructive border-destructive/30 mt-1"
                >
                  Circuit Break
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
