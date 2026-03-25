import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Save, Loader2, TrendingUp, Target, DollarSign,
  GraduationCap, ArrowRight, Sparkles, Map, Edit2, Check,
  BarChart3, Users, MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import OutreachGenerator from "@/components/OutreachGenerator";
import OutreachTracker from "@/components/OutreachTracker";
import SalaryProjection from "@/components/SalaryProjection";
import ProgressMetrics from "@/components/ProgressMetrics";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface CareerInsight {
  currentLevel: string;
  nextRoles: { title: string; salaryRange: string; matchGap: string }[];
  skillsToLearn: { skill: string; impact: string; timeEstimate: string }[];
  industryTrends: string[];
  advice: string;
  roadmap?: { stage: string; role: string; skills: string[]; timeframe: string }[];
}

export default function CareerPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [insight, setInsight] = useState<CareerInsight | null>(null);
  const [editingGoals, setEditingGoals] = useState(false);

  const [goalsShort, setGoalsShort] = useState("");
  const [goalsLong, setGoalsLong] = useState("");
  const [salaryTarget, setSalaryTarget] = useState("");
  const [careerLevel, setCareerLevel] = useState("");
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");

  // Score trend data
  const [scoreTrend, setScoreTrend] = useState<{ date: string; score: number }[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [profileRes, historyRes] = await Promise.all([
        supabase.from("job_seeker_profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("analysis_history" as any).select("overall_score, created_at").eq("user_id", session.user.id).order("created_at", { ascending: true }).limit(20) as any,
      ]);

      if (profileRes.data) {
        const p = profileRes.data as any;
        setGoalsShort(p.career_goals_short || "");
        setGoalsLong(p.career_goals_long || "");
        setSalaryTarget(p.salary_target || "");
        setCareerLevel(p.career_level || "");
        setTargetTitles(p.target_job_titles || []);
        setSalaryMin(p.salary_min || "");
        setSalaryMax(p.salary_max || "");
      }

      if (historyRes.data?.length) {
        setScoreTrend(historyRes.data.map((h: any) => ({
          date: new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          score: h.overall_score,
        })));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveGoals = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("job_seeker_profiles").update({
        career_goals_short: goalsShort || null,
        career_goals_long: goalsLong || null,
        salary_target: salaryTarget || null,
        updated_at: new Date().toISOString(),
      } as any).eq("user_id", session.user.id);
      toast.success("Career goals saved!");
      setEditingGoals(false);
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const analyzeCareer = async () => {
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const { data: profile } = await supabase.from("job_seeker_profiles").select("*").eq("user_id", session.user.id).maybeSingle();
      if (!profile || !(profile.skills as string[])?.length) {
        toast.error("Complete your profile first");
        return;
      }

      const { data: history } = await supabase.from("analysis_history" as any).select("job_title, overall_score, gaps, matched_skills").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(5) as any;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/career-path-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          skills: profile.skills,
          careerLevel: (profile as any).career_level,
          experience: profile.work_experience,
          education: profile.education,
          certifications: profile.certifications,
          targetTitles: (profile as any).target_job_titles,
          recentAnalyses: history || [],
          includeRoadmap: true,
        }),
      });
      if (!resp.ok) throw new Error("Analysis failed");
      setInsight(await resp.json());
    } catch { toast.error("Failed to analyze career path"); }
    finally { setAnalyzing(false); }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;

  return (
    <div className="bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Progress Metrics */}
        <ProgressMetrics />

        {/* Career Snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Career Level</p>
            <p className="font-display font-bold text-primary">{careerLevel || "Not set"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Target Roles</p>
            <p className="font-display font-bold text-primary">{targetTitles.length || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Salary Range</p>
            <p className="font-display font-bold text-primary">{salaryMin && salaryMax ? `$${salaryMin}–$${salaryMax}` : "Not set"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Salary Target</p>
            <p className="font-display font-bold text-accent">{salaryTarget ? `$${salaryTarget}` : "Not set"}</p>
          </Card>
        </div>

        {/* Career Goals */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-primary text-lg flex items-center gap-2"><Target className="w-5 h-5 text-accent" /> Career Goals</h2>
            <Button variant="ghost" size="sm" onClick={() => editingGoals ? saveGoals() : setEditingGoals(true)} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingGoals ? <><Check className="w-4 h-4 mr-1" /> Save</> : <><Edit2 className="w-4 h-4 mr-1" /> Edit</>}
            </Button>
          </div>
          {editingGoals ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Short-term Goal (6-12 months)</label>
                <Textarea value={goalsShort} onChange={e => setGoalsShort(e.target.value)} placeholder="e.g., Land a senior engineer role at a Series B+ startup" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Long-term Goal (2-5 years)</label>
                <Textarea value={goalsLong} onChange={e => setGoalsLong(e.target.value)} placeholder="e.g., Transition into engineering management or VP of Engineering" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Target Salary</label>
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={salaryTarget} onChange={e => setSalaryTarget(e.target.value)} placeholder="180,000" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Short-term</p>
                <p className="text-sm text-foreground">{goalsShort || "No short-term goal set yet"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Long-term</p>
                <p className="text-sm text-foreground">{goalsLong || "No long-term goal set yet"}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Score Trend */}
        {scoreTrend.length > 1 && (
          <Card className="p-6">
            <h2 className="font-display font-bold text-primary text-lg flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-accent" /> Score Improvement Trend</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--accent))", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Career Roadmap */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-primary text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-accent" /> AI Career Roadmap</h2>
            <Button variant="outline" size="sm" onClick={analyzeCareer} disabled={analyzing}>
              {analyzing ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Analyzing...</> : <><Sparkles className="w-4 h-4 mr-1" /> Generate Roadmap</>}
            </Button>
          </div>

          {!insight ? (
            <div className="text-center py-8">
              <Map className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Generate your personalized career roadmap based on your profile, skills, and market data.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Level */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center"><Target className="w-5 h-5 text-accent" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Level</p>
                  <p className="font-display font-bold text-primary">{insight.currentLevel}</p>
                </div>
              </div>

              {/* Roadmap Steps */}
              {insight.roadmap?.length ? (
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
                  {insight.roadmap.map((stage, i) => (
                    <div key={i} className="relative pl-12 pb-6 last:pb-0">
                      <div className={`absolute left-3.5 w-3 h-3 rounded-full border-2 ${i === 0 ? "bg-accent border-accent" : "bg-card border-border"}`} />
                      <div className="p-4 rounded-lg bg-card border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-foreground">{stage.role}</h4>
                          <Badge variant="outline" className="text-xs">{stage.timeframe}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{stage.stage}</p>
                        <div className="flex flex-wrap gap-1">
                          {stage.skills.map((sk, j) => <Badge key={j} variant="secondary" className="text-xs">{sk}</Badge>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback: next roles */
                <div className="space-y-3">
                  {insight.nextRoles.map((role, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div>
                        <p className="font-semibold text-foreground">{role.title}</p>
                        <p className="text-xs text-muted-foreground">{role.matchGap}</p>
                      </div>
                      <Badge variant="outline" className="text-xs border-success/30 text-success flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />{role.salaryRange}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills to Learn */}
              <div>
                <h4 className="text-sm font-semibold text-primary mb-3 flex items-center gap-1"><GraduationCap className="w-4 h-4" /> Skills to Unlock Next Level</h4>
                <div className="space-y-2">
                  {insight.skillsToLearn.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                      <div className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-accent" /><span className="text-sm font-medium text-foreground">{s.skill}</span></div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{s.impact} impact</Badge>
                        <span className="text-xs text-muted-foreground">{s.timeEstimate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Industry Trends */}
              {insight.industryTrends?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-primary mb-2">Industry Trends</h4>
                  <ul className="space-y-1">{insight.industryTrends.map((t, i) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><Sparkles className="w-3 h-3 mt-1 text-accent flex-shrink-0" />{t}</li>)}</ul>
                </div>
              )}

              {/* Advice */}
              <Card className="p-4 bg-accent/5 border-accent/20">
                <p className="text-sm text-foreground leading-relaxed">{insight.advice}</p>
              </Card>
            </div>
          )}
        </Card>

        {/* Salary Projections */}
        <SalaryProjection
          skills={targetTitles}
          careerLevel={careerLevel}
          salaryMin={salaryMin}
          salaryMax={salaryMax}
          salaryTarget={salaryTarget}
          targetTitles={targetTitles}
          experience={[]}
        />

        {/* Networking & Outreach */}
        <div className="space-y-6">
          <h2 className="font-display font-bold text-primary text-xl flex items-center gap-2"><Users className="w-5 h-5 text-accent" /> Networking & Outreach</h2>
          <OutreachGenerator />
          <OutreachTracker />
        </div>
      </main>
    </div>
  );
}
