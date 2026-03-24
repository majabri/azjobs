import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target, Trash2, FileText, BarChart3, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";
import { toast } from "sonner";
import { ScoreRingInline } from "@/components/ScoreDisplay";

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

  useEffect(() => {
    loadAnalyses();
  }, []);

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
      const { error } = await (supabase.from("analysis_history" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      toast.success("Analysis removed");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 45) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 gradient-teal rounded-lg flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-bold text-primary">My Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/job-seeker")}
            >
              <Target className="w-4 h-4 mr-1" /> New Analysis
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-primary mb-2">Analysis History</h1>
          <p className="text-muted-foreground">Your recent fit analyses — click any to expand details.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-primary mb-2">No analyses yet</h3>
            <p className="text-muted-foreground mb-6">Run your first fit analysis to see results here.</p>
            <Button
              className="gradient-teal text-white shadow-teal hover:opacity-90"
              onClick={() => navigate("/job-seeker")}
            >
              <Target className="w-4 h-4 mr-2" /> Analyze My Fit
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.map((a) => {
              const isExpanded = expandedId === a.id;
              const matchedCount = (a.matched_skills as any[])?.filter((s: any) => s.matched).length || 0;
              const totalSkills = (a.matched_skills as any[])?.length || 0;
              const gapCount = (a.gaps as any[])?.length || 0;

              return (
                <div
                  key={a.id}
                  className="bg-card rounded-2xl border border-border shadow-card overflow-hidden transition-shadow hover:shadow-elevated"
                >
                  {/* Summary row */}
                  <button
                    className="w-full text-left p-5 flex items-center gap-5"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <div className="flex-shrink-0">
                      <div className={`text-2xl font-display font-bold ${scoreColor(a.overall_score)}`}>
                        {a.overall_score}%
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground truncate">
                          {a.job_title || "Untitled Role"}
                        </span>
                        {a.company && (
                          <span className="text-sm text-muted-foreground">at {a.company}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                        <span>{matchedCount}/{totalSkills} skills matched</span>
                        {gapCount > 0 && <span>{gapCount} gaps</span>}
                        {a.optimized_resume && (
                          <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
                            Optimized
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                        disabled={deletingId === a.id}
                      >
                        {deletingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-border p-5 space-y-5 animate-fade-in">
                      <div className="flex items-center gap-6">
                        <ScoreRingInline score={a.overall_score} size={100} />
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">{a.summary}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(a.strengths as string[])?.map((s) => (
                              <Badge key={s} className="bg-accent/10 text-accent border-accent/20 text-xs">{s}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Skills */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-primary mb-2">Matched Skills</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {(a.matched_skills as any[])?.filter((s: any) => s.matched).map((s: any) => (
                              <Badge key={s.skill} variant="outline" className="text-xs border-success/30 text-success">{s.skill}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-primary mb-2">Gaps</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {(a.gaps as any[])?.map((g: any) => (
                              <Badge
                                key={g.area}
                                variant="outline"
                                className={`text-xs ${
                                  g.severity === "critical"
                                    ? "border-destructive/30 text-destructive"
                                    : g.severity === "moderate"
                                    ? "border-warning/30 text-warning"
                                    : "border-border text-muted-foreground"
                                }`}
                              >
                                {g.area}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Optimized resume preview */}
                      {a.optimized_resume && (
                        <div>
                          <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-accent" /> Optimized Resume
                          </h4>
                          <div className="bg-muted/30 rounded-xl p-4 border border-border max-h-48 overflow-y-auto">
                            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-foreground">
                              {a.optimized_resume}
                            </pre>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(a.optimized_resume);
                              toast.success("Copied optimized resume!");
                            }}
                          >
                            Copy Optimized Resume
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
