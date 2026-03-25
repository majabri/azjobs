import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot, Play, Loader2, CheckCircle2, XCircle, Zap, Target,
  Briefcase, Brain, Search, FileText, AlertTriangle, Clock,
} from "lucide-react";

type AgentMode = "manual" | "smart" | "full-auto";

interface AgentRun {
  id: string;
  status: string;
  agents_completed: string[];
  jobs_found: number;
  jobs_matched: number;
  applications_sent: number;
  errors: string[];
  started_at: string;
  completed_at: string | null;
}

const AGENTS = [
  { key: "discovery", label: "Job Discovery", icon: Search, desc: "Finds new opportunities" },
  { key: "matching", label: "Match & Score", icon: Target, desc: "Ranks jobs by fit" },
  { key: "optimization", label: "Resume Optimizer", icon: FileText, desc: "Tailors for each role" },
  { key: "application", label: "Application Agent", icon: Briefcase, desc: "Submits applications" },
  { key: "learning", label: "Learning Engine", icon: Brain, desc: "Improves over time" },
];

export default function AgentControlCenter() {
  const [mode, setMode] = useState<AgentMode>("manual");
  const [threshold, setThreshold] = useState(70);
  const [dailyCap, setDailyCap] = useState(10);
  const [running, setRunning] = useState(false);
  const [recentRuns, setRecentRuns] = useState<AgentRun[]>([]);
  const [liveRun, setLiveRun] = useState<AgentRun | null>(null);

  useEffect(() => {
    loadProfile();
    loadRecentRuns();
    subscribeToRuns();
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("job_seeker_profiles")
      .select("automation_mode, match_threshold, daily_apply_cap, min_match_score")
      .eq("user_id", session.user.id).single() as any;
    if (data) {
      setMode(data.automation_mode || "manual");
      setThreshold(data.match_threshold || data.min_match_score || 70);
      setDailyCap(data.daily_apply_cap || 10);
    }
  };

  const loadRecentRuns = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("agent_runs" as any)
      .select("*").eq("user_id", session.user.id)
      .order("started_at", { ascending: false }).limit(5) as any;
    setRecentRuns(data || []);
  };

  const subscribeToRuns = () => {
    const channel = supabase.channel("agent-runs")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, (payload) => {
        const run = payload.new as AgentRun;
        if (run.status === "running") {
          setLiveRun(run);
        } else {
          setLiveRun(null);
          loadRecentRuns();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const savePrefs = async (newMode: AgentMode) => {
    setMode(newMode);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("job_seeker_profiles")
      .update({ automation_mode: newMode, match_threshold: threshold, daily_apply_cap: dailyCap } as any)
      .eq("user_id", session.user.id);
  };

  const runAgent = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-orchestrator", {
        body: { agents: AGENTS.map(a => a.key) },
      });
      if (error) throw error;
      toast.success(`Agent run complete: ${data.jobsFound} jobs found, ${data.jobsMatched} matched`);
      loadRecentRuns();
    } catch (e) {
      toast.error("Agent run failed");
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const modeLabels: Record<AgentMode, { label: string; color: string; desc: string }> = {
    manual: { label: "Manual", color: "bg-muted text-muted-foreground", desc: "You control everything" },
    smart: { label: "Smart Assist", color: "bg-accent/10 text-accent", desc: "Auto-applies to >80% matches" },
    "full-auto": { label: "Autonomous", color: "bg-success/10 text-success", desc: "AI handles everything" },
  };

  const modeIndex = mode === "manual" ? 0 : mode === "smart" ? 1 : 2;

  return (
    <div className="space-y-6">
      {/* Automation Mode */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4 text-accent" /> Automation Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={modeLabels[mode].color}>{modeLabels[mode].label}</Badge>
              <span className="text-xs text-muted-foreground">{modeLabels[mode].desc}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Manual</span><span>Smart Assist</span><span>Autonomous</span>
            </div>
            <Slider
              value={[modeIndex]}
              min={0} max={2} step={1}
              onValueChange={([v]) => {
                const modes: AgentMode[] = ["manual", "smart", "full-auto"];
                savePrefs(modes[v]);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs text-muted-foreground">Match Threshold</label>
              <div className="flex items-center gap-2 mt-1">
                <Slider value={[threshold]} min={30} max={95} step={5}
                  onValueChange={([v]) => setThreshold(v)} />
                <span className="text-sm font-bold text-foreground w-10">{threshold}%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Daily Cap</label>
              <div className="flex items-center gap-2 mt-1">
                <Slider value={[dailyCap]} min={1} max={50} step={1}
                  onValueChange={([v]) => setDailyCap(v)} />
                <span className="text-sm font-bold text-foreground w-10">{dailyCap}</span>
              </div>
            </div>
          </div>

          <Button onClick={runAgent} disabled={running} className="w-full gradient-teal text-white">
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            {running ? "Agents Running..." : "Run All Agents Now"}
          </Button>
        </CardContent>
      </Card>

      {/* Live Run */}
      {liveRun && (
        <Card className="border-accent/30 bg-accent/5 animate-pulse">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span className="text-sm font-medium text-accent">Agents Running...</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {AGENTS.map(a => {
                const completed = (liveRun.agents_completed as string[])?.includes(a.key);
                return (
                  <div key={a.key} className={`text-center p-2 rounded-lg border ${completed ? "border-success/30 bg-success/5" : "border-border"}`}>
                    <a.icon className={`w-4 h-4 mx-auto mb-1 ${completed ? "text-success" : "text-muted-foreground"}`} />
                    <p className="text-[10px] text-muted-foreground">{a.label}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Status Grid */}
      <div className="grid grid-cols-5 gap-3">
        {AGENTS.map(a => (
          <Card key={a.key} className="border-border text-center">
            <CardContent className="pt-4 pb-3">
              <a.icon className="w-5 h-5 mx-auto mb-1 text-accent" />
              <p className="text-xs font-medium text-foreground">{a.label}</p>
              <p className="text-[10px] text-muted-foreground">{a.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Recent Agent Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentRuns.map(run => (
                <div key={run.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    {run.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-success" /> :
                     run.status === "completed_with_errors" ? <AlertTriangle className="w-4 h-4 text-warning" /> :
                     run.status === "running" ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> :
                     <XCircle className="w-4 h-4 text-destructive" />}
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {run.jobs_found} found · {run.jobs_matched} matched · {run.applications_sent} applied
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(run.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {(run.agents_completed as string[])?.length || 0}/{AGENTS.length} agents
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
