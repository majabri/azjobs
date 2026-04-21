import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, DollarSign, GraduationCap, ArrowRight, Sparkles, Target, BookOpen, Award, Code2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HelpTooltip from "@/components/HelpTooltip";
import { toast } from "sonner";

interface CareerInsight {
  currentLevel: string;
  nextRoles: { title: string; salaryRange: string; matchGap: string }[];
  skillsToLearn: { skill: string; impact: string; timeEstimate: string; actionStep?: string; resourceType?: string; resourceSuggestion?: string }[];
  industryTrends: string[];
  advice: string;
}

export default function CareerPathIntelligence() {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<CareerInsight | null>(null);

  const analyze = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const { data: profile } = await supabase
        .from("job_seeker_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile || !(profile.skills as string[])?.length) {
        toast.error("Complete your profile first to get career insights");
        return;
      }

      // Get recent analysis history for context
      const { data: history } = await supabase
        .from("analysis_history" as any)
        .select("job_title, overall_score, gaps, matched_skills")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(5) as any;

      const { data, error } = await supabase.functions.invoke("career-path-analysis", {
        body: {
          skills: profile.skills,
          careerLevel: (profile as any).career_level,
          experience: profile.work_experience,
          education: profile.education,
          certifications: profile.certifications,
          targetTitles: (profile as any).target_job_titles,
          recentAnalyses: history || [],
        },
      });

      if (error) throw new Error(error.message || "Analysis failed");
      setInsight(data);
    } catch {
      toast.error("Failed to analyze career path");
    } finally {
      setLoading(false);
    }
  };

  if (!insight) {
    return (
      <Card className="p-6 text-center">
        <TrendingUp className="w-10 h-10 text-accent mx-auto mb-3" />
        <h3 className="font-display font-bold text-primary text-lg mb-2 flex items-center justify-center gap-1.5">Career Path Intelligence <HelpTooltip text="AI recommends your next career moves — higher-paying roles, skills to learn, and industry trends based on your profile." /></h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Get AI-powered recommendations for higher-paying roles, skills to learn, and career transitions based on your profile and market data.
        </p>
        <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90" onClick={analyze} disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</> : <><Sparkles className="w-4 h-4 mr-2" /> Analyze My Career Path</>}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-primary text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent" /> Career Path Intelligence <HelpTooltip text="AI recommends your next career moves — higher-paying roles, skills to learn, and industry trends based on your profile." />
        </h3>
        <Button variant="ghost" size="sm" onClick={analyze} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {/* Current Level */}
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Current Level</p>
        <p className="font-display font-bold text-primary text-lg">{insight.currentLevel}</p>
      </Card>

      {/* Next Roles */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-primary mb-3 flex items-center gap-1">
          <Target className="w-4 h-4" /> Recommended Next Roles
        </h4>
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
      </Card>

      {/* Skills to Learn */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-primary mb-3 flex items-center gap-1">
          <GraduationCap className="w-4 h-4" /> Skills to Unlock Next Level
        </h4>
        <div className="space-y-3">
          {insight.skillsToLearn.map((s, i) => {
            const resourceIcon = s.resourceType === "certification" ? <Award className="w-3.5 h-3.5" /> :
              s.resourceType === "project" ? <Code2 className="w-3.5 h-3.5" /> :
              <BookOpen className="w-3.5 h-3.5" />;
            return (
              <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-accent" />
                    <span className="text-sm font-medium text-foreground">{s.skill}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{s.impact} impact</Badge>
                    <span className="text-xs text-muted-foreground">{s.timeEstimate}</span>
                  </div>
                </div>
                {s.actionStep && (
                  <div className="ml-5 space-y-1">
                    <p className="text-xs text-foreground/80">
                      <span className="font-semibold text-accent">Action:</span> {s.actionStep}
                    </p>
                    {s.resourceSuggestion && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {resourceIcon}
                        <span className="capitalize">{s.resourceType}</span>
                        <span>—</span>
                        <span className="text-foreground/70">{s.resourceSuggestion}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Advice */}
      <Card className="p-4 bg-accent/5 border-accent/20">
        <p className="text-sm text-foreground leading-relaxed">{insight.advice}</p>
      </Card>
    </div>
  );
}
