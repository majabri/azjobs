import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Bot, Play, Loader2, CheckCircle2, XCircle, Target,
  Briefcase, Brain, Search, FileText, AlertTriangle, Clock,
} from "lucide-react";
import { useAgentSystem, type AgentMode, type AgentRun } from "@/hooks/useAgentSystem";
import { type LucideIcon } from "lucide-react";

const AGENTS: { key: string; label: string; icon: LucideIcon; desc: string }[] = [
  { key: "discovery", label: "Job Discovery", icon: Search, desc: "Finds new opportunities" },
  { key: "matching", label: "Match & Score", icon: Target, desc: "Ranks jobs by fit" },
  { key: "optimization", label: "Resume Optimizer", icon: FileText, desc: "Tailors for each role" },
  { key: "application", label: "Application Agent", icon: Briefcase, desc: "Submits applications" },
  { key: "learning", label: "Learning Engine", icon: Brain, desc: "Improves over time" },
];

const MODE_META: Record<AgentMode, { label: string; color: string; desc: string }> = {
  manual: { label: "Manual", color: "bg-muted text-muted-foreground", desc: "You control everything" },
  smart: { label: "Smart Assist", color: "bg-accent/10 text-accent", desc: "Auto-applies to >80% matches" },
  "full-auto": { label: "Autonomous", color: "bg-success/10 text-success", desc: "AI handles everything" },
};

function LiveRunCard({ run }: { run: AgentRun }) {
  return (
    <Card className="border-accent/30 bg-accent/5 animate-pulse">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          <span className="text-sm font-medium text-accent">Agents Running...</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {AGENTS.map(a => {
            const done = (run.agents_completed as string[])?.includes(a.key);
            return (
              <div key={a.key} className={`text-center p-2 rounded-lg border ${done ? "border-success/30 bg-success/5" : "border-border"}`}>
                <a.icon className={`w-4 h-4 mx-auto mb-1 ${done ? "text-success" : "text-muted-foreground"}`} />
                <p className="text-[10px] text-muted-foreground">{a.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RunHistoryCard({ runs }: { runs: AgentRun[] }) {
  if (!runs.length) return null;
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" /> Recent Agent Runs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {runs.map(run => {
            const timings = (run.agent_timings || {}) as Record<string, number>;
            return (
              <div key={run.id} className="p-3 bg-muted/30 rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between">
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
                {Object.keys(timings).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {AGENTS.map(a => {
                      const ms = timings[a.key];
                      if (ms == null) return null;
                      return (
                        <span key={a.key} className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {a.label}: {ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentControlCenter() {
  const { prefs, updatePrefs, running, runAgents, recentRuns, liveRun } = useAgentSystem();
  const modeIndex = prefs.mode === "manual" ? 0 : prefs.mode === "smart" ? 1 : 2;

  const handleRun = async () => {
    try {
      const data = await runAgents(AGENTS.map(a => a.key));
      toast.success(`Agent run complete: ${data?.jobs_found || 0} jobs found, ${data?.jobs_matched || 0} matched`);
    } catch {
      toast.error("Agent run failed");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4 text-accent" /> Automation Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className={MODE_META[prefs.mode].color}>{MODE_META[prefs.mode].label}</Badge>
            <span className="text-xs text-muted-foreground">{MODE_META[prefs.mode].desc}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Manual</span><span>Smart Assist</span><span>Autonomous</span>
            </div>
            <Slider
              value={[modeIndex]} min={0} max={2} step={1}
              onValueChange={([v]) => {
                const modes: AgentMode[] = ["manual", "smart", "full-auto"];
                updatePrefs({ mode: modes[v] });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs text-muted-foreground">Match Threshold</label>
              <div className="flex items-center gap-2 mt-1">
                <Slider value={[prefs.threshold]} min={30} max={95} step={5}
                  onValueChange={([v]) => updatePrefs({ threshold: v })} />
                <span className="text-sm font-bold text-foreground w-10">{prefs.threshold}%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Daily Cap</label>
              <div className="flex items-center gap-2 mt-1">
                <Slider value={[prefs.dailyCap]} min={1} max={50} step={1}
                  onValueChange={([v]) => updatePrefs({ dailyCap: v })} />
                <span className="text-sm font-bold text-foreground w-10">{prefs.dailyCap}</span>
              </div>
            </div>
          </div>
          <Button onClick={handleRun} disabled={running} className="w-full gradient-teal text-white">
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            {running ? "Agents Running..." : "Run All Agents Now"}
          </Button>
        </CardContent>
      </Card>

      {liveRun && <LiveRunCard run={liveRun} />}

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

      <RunHistoryCard runs={recentRuns} />
    </div>
  );
}
