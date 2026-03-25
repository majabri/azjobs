import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, BarChart3, Target, TrendingUp, Sparkles,
  Bot, ShieldAlert, Search, Map, MessageSquare, Briefcase,
  Clock, DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";
import NotificationCenter from "@/components/NotificationCenter";
import { toast } from "sonner";
import { ScoreRingInline } from "@/components/ScoreDisplay";
import TodaysMatches from "@/components/TodaysMatches";
import CareerPathIntelligence from "@/components/CareerPathIntelligence";
import RecruiterAssistant from "@/components/RecruiterAssistant";
import LearningInsights from "@/components/LearningInsights";
import AdaptiveSearchStrategy from "@/components/AdaptiveSearchStrategy";
import JobBoardImporter from "@/components/JobBoardImporter";
import AgentControlCenter from "@/components/AgentControlCenter";
import RejectionSimulator from "@/components/RejectionSimulator";
import CompensationDashboard from "@/components/CompensationDashboard";

interface AnalysisRecord {
  id: string;
  job_title: string;
  company: string;
  overall_score: number;
  matched_skills: { skill: string; matched: boolean }[];
  gaps: { area: string; severity: string }[];
  strengths: string[];
  summary: string;
  optimized_resume: string;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"control" | "pipeline" | "compensation" | "insights">("control");

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
      toast.error("Failed to load analysis history");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await (supabase.from("analysis_history" as any) as any).delete().eq("id", id);
      if (error) throw error;
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      toast.success("Analysis removed");
    } catch { toast.error("Failed to delete"); }
    finally { setDeletingId(null); }
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 45) return "text-warning";
    return "text-destructive";
  };

  const avgScore = analyses.length ? Math.round(analyses.reduce((s, a) => s + a.overall_score, 0) / analyses.length) : 0;
  const bestScore = analyses.length ? Math.max(...analyses.map(a => a.overall_score)) : 0;

  const tabs = [
    { key: "control" as const, label: "AI Control Center", icon: Bot },
    { key: "pipeline" as const, label: "Pipeline", icon: Briefcase },
    { key: "compensation" as const, label: "Compensation", icon: DollarSign },
    { key: "insights" as const, label: "Insights", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 gradient-teal rounded-lg flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-bold text-primary">Career Agent</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/career")}>
              <Map className="w-4 h-4 mr-1" /> Career
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/interview-prep")}>
              <MessageSquare className="w-4 h-4 mr-1" /> Interview
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/job-search")}>
              <Search className="w-4 h-4 mr-1" /> Jobs
            </Button>
            <NotificationCenter />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        {analyses.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Analyses Run" value={analyses.length.toString()} icon={<BarChart3 className="w-4 h-4" />} />
            <StatCard label="Avg Score" value={`${avgScore}%`} icon={<Target className="w-4 h-4" />} color={scoreColor(avgScore)} />
            <StatCard label="Best Score" value={`${bestScore}%`} icon={<TrendingUp className="w-4 h-4" />} color={scoreColor(bestScore)} />
            <StatCard label="Improve Score" value="→" icon={<Sparkles className="w-4 h-4" />}
              onClick={() => navigate("/job-seeker")} className="cursor-pointer hover:border-accent/50 transition-colors" color="text-accent" />
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
        {activeTab === "control" && (
          <div className="space-y-6">
            <AgentControlCenter />
            <TodaysMatches compact />
            <RejectionSimulator />
          </div>
        )}

        {activeTab === "pipeline" && (
          <div className="space-y-6">
            <JobBoardImporter />
            <div>
              <h2 className="font-display text-2xl font-bold text-primary mb-4">Interview Pipeline</h2>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Clock className="w-6 h-6 animate-spin text-accent" />
                </div>
              ) : analyses.length === 0 ? (
                <div className="text-center py-16 bg-card rounded-2xl border border-border">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display text-xl font-bold text-primary mb-2">Start getting interviews</h3>
                  <p className="text-muted-foreground mb-6">Upload your resume and let AI match you with opportunities.</p>
                  <Button className="gradient-teal text-white" onClick={() => navigate("/job-seeker")}>
                    <Target className="w-4 h-4 mr-2" /> Get Started
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {analyses.map((a) => {
                    const isExpanded = expandedId === a.id;
                    const matchedCount = (a.matched_skills as any[])?.filter((s: any) => s.matched).length || 0;
                    const totalSkills = (a.matched_skills as any[])?.length || 0;
                    const gapCount = (a.gaps as any[])?.length || 0;

                    return (
                      <div key={a.id} className="bg-card rounded-2xl border border-border shadow-card overflow-hidden transition-shadow hover:shadow-elevated">
                        <button className="w-full text-left p-5 flex items-center gap-5" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                          <div className={`text-2xl font-display font-bold ${scoreColor(a.overall_score)}`}>{a.overall_score}%</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-foreground truncate">{a.job_title || "Untitled Role"}</span>
                              {a.company && <span className="text-sm text-muted-foreground">at {a.company}</span>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{new Date(a.created_at).toLocaleDateString()}</span>
                              <span>{matchedCount}/{totalSkills} skills</span>
                              {gapCount > 0 && <span>{gapCount} gaps</span>}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border p-5 space-y-4 animate-fade-in">
                            <div className="flex items-center gap-6">
                              <ScoreRingInline score={a.overall_score} size={80} />
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">{a.summary}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {(a.strengths as string[])?.map((s) => (
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
              )}
            </div>
          </div>
        )}

        {activeTab === "insights" && (
          <div className="space-y-6">
            <LearningInsights />
            <AdaptiveSearchStrategy />
            <CareerPathIntelligence />
            <RecruiterAssistant />
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, color, onClick, className }: { label: string; value: string; icon: React.ReactNode; color?: string; onClick?: () => void; className?: string }) {
  return (
    <div className={`bg-card rounded-xl p-4 border border-border shadow-card ${className || ""}`} onClick={onClick}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon} {label}</div>
      <div className={`text-2xl font-display font-bold ${color || "text-primary"}`}>{value}</div>
    </div>
  );
}
