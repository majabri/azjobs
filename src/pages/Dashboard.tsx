import { useState, useEffect, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Target, TrendingUp, Sparkles,
  Briefcase, Clock, DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import OnboardingWizard from "@/components/dashboard/OnboardingWizard";
import { toast } from "sonner";
import { ScoreRingInline } from "@/components/ScoreDisplay";
import HelpTooltip from "@/components/HelpTooltip";
import TodaysMatches from "@/components/dashboard/TodaysMatches";
import CareerPathIntelligence from "@/components/dashboard/CareerPathIntelligence";
import LearningInsights from "@/components/dashboard/LearningInsights";
import AdaptiveSearchStrategy from "@/components/dashboard/AdaptiveSearchStrategy";
import AgentControlCenter from "@/components/auto-apply/AgentControlCenter";
import CompensationDashboard from "@/components/dashboard/CompensationDashboard";
import CareerROIScore from "@/components/dashboard/CareerROIScore";
import SmartNotificationEngine from "@/components/dashboard/SmartNotificationEngine";

interface AnalysisRecord {
  id: string;
  job_title: string;
  company: string;
  overall_score: number;
  matched_skills: { skill: string; matched: boolean }[];
  gaps: { area: string; severity: string }[];
  strengths: string[];
  summary: string;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "compensation" | "insights">("overview");

  useEffect(() => { loadAnalyses(); }, []);

  const loadAnalyses = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("analysis_history" as any)
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10) as any;
      if (error) throw error;
      setAnalyses(data || []);
      supabase.from("job_seeker_profiles").update({ last_active_at: new Date().toISOString() } as any).eq("user_id", session.user.id).then(() => {});
    } catch (e) {
      console.error(e);
      toast.error("Failed to load history");
    } finally { setLoading(false); }
  };

  const scoreColor = (score: number) => score >= 70 ? "text-success" : score >= 45 ? "text-warning" : "text-destructive";
  const avgScore = analyses.length ? Math.round(analyses.reduce((s, a) => s + a.overall_score, 0) / analyses.length) : 0;
  const bestScore = analyses.length ? Math.max(...analyses.map(a => a.overall_score)) : 0;

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: Briefcase },
    { key: "compensation" as const, label: "Compensation", icon: DollarSign },
    { key: "insights" as const, label: "Insights", icon: TrendingUp },
  ];

  return (
    <div className="bg-background">
      <SmartNotificationEngine />
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Guided Onboarding */}
        <OnboardingWizard />

        {/* Stats */}
        {analyses.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Analyses Run" value={analyses.length.toString()} icon={<BarChart3 className="w-4 h-4" />} help="Total number of job-vs-resume fit analyses you've completed." />
            <StatCard label="Avg Fit Score" value={`${avgScore}%`} icon={<Target className="w-4 h-4" />} color={scoreColor(avgScore)} help="Average match score across all your analyses. Higher means your resume aligns better with the jobs you're targeting." />
            <StatCard label="Best Fit Score" value={`${bestScore}%`} icon={<TrendingUp className="w-4 h-4" />} color={scoreColor(bestScore)} help="Your highest match score so far — shows your best resume-to-job alignment." />
            <StatCard label="Analyze New" value="→" icon={<Sparkles className="w-4 h-4" />}
              onClick={() => navigate("/job-seeker")} className="cursor-pointer hover:border-accent/50 transition-colors" color="text-accent" help="Start a new resume-vs-job analysis to see how well you match a specific role." />
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-border">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <CareerROIScore />
            <AgentControlCenter />
            <TodaysMatches compact />

            {/* Recent Analyses */}
            {loading ? (
              <div className="flex items-center justify-center py-16"><Clock className="w-6 h-6 animate-spin text-accent" /></div>
            ) : analyses.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-xl font-bold text-foreground mb-2">Start getting interviews</h3>
                <p className="text-muted-foreground mb-6">Upload your resume and analyze a job posting.</p>
                <Button className="gradient-teal text-white" onClick={() => navigate("/job-seeker")}>
                  <Target className="w-4 h-4 mr-2" /> Analyze a Job
                </Button>
              </div>
            ) : (
              <div>
                <h2 className="font-display text-lg font-bold text-foreground mb-4">Recent Analyses</h2>
                <div className="space-y-3">
                  {analyses.map(a => {
                    const matchedCount = (a.matched_skills as any[])?.filter((s: any) => s.matched).length || 0;
                    const totalSkills = (a.matched_skills as any[])?.length || 0;
                    return (
                      <div key={a.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <button className="w-full text-left p-5 flex items-center gap-5" onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>
                          <div className={`text-2xl font-display font-bold ${scoreColor(a.overall_score)}`}>{a.overall_score}%</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-foreground truncate">{a.job_title || "Untitled"}</span>
                              {a.company && <span className="text-sm text-muted-foreground">at {a.company}</span>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{new Date(a.created_at).toLocaleDateString()}</span>
                              <span>{matchedCount}/{totalSkills} skills</span>
                            </div>
                          </div>
                        </button>
                        {expandedId === a.id && (
                          <div className="border-t border-border p-5 space-y-4 animate-fade-in">
                            <div className="flex items-center gap-6">
                              <ScoreRingInline score={a.overall_score} size={80} />
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">{a.summary}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {(a.strengths as string[])?.map(s => (
                                    <Badge key={s} className="bg-accent/10 text-accent border-accent/20 text-xs">{s}</Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "compensation" && (
          <div className="space-y-6">
            <CompensationDashboard />
          </div>
        )}

        {activeTab === "insights" && (
          <div className="space-y-6">
            <LearningInsights />
            <AdaptiveSearchStrategy />
            <CareerPathIntelligence />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, onClick, className, help }: { label: string; value: string; icon: React.ReactNode; color?: string; onClick?: () => void; className?: string; help?: string }) {
  return (
    <div className={`bg-card rounded-xl p-4 border border-border shadow-sm ${className || ""}`} onClick={onClick}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon} {label}
        {help && <HelpTooltip text={help} />}
      </div>
      <div className={`text-2xl font-display font-bold ${color || "text-foreground"}`}>{value}</div>
    </div>
  );
}
