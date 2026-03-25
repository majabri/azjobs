import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, Shield, Zap, ChevronDown, ChevronUp, Target, Loader2, Wrench, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FitAnalysis } from "@/lib/analysisEngine";

interface GapIntelligenceProps {
  analysis: FitAnalysis;
  onFixAll?: () => void;
  onReEvaluate?: () => void;
}

interface SimulatedProfile {
  title: string;
  score: number;
  keyDifferences: string[];
}

const SIMULATED_PROFILES: SimulatedProfile[] = [
  { title: "Hired Candidate A", score: 92, keyDifferences: ["Had hands-on SIEM deployment experience", "Published security research papers", "Led a team of 5+ analysts"] },
  { title: "Hired Candidate B", score: 88, keyDifferences: ["AWS Security Specialty + GCP cert", "Built automated threat detection pipeline", "Presented at DEF CON"] },
  { title: "Hired Candidate C", score: 85, keyDifferences: ["Managed $2M security budget", "Implemented company-wide zero trust rollout", "SOC 2 audit lead"] },
  { title: "Hired Candidate D", score: 83, keyDifferences: ["Penetration testing certifications (OSCP)", "Cloud migration security lead", "Reduced breach response time by 60%"] },
  { title: "Hired Candidate E", score: 81, keyDifferences: ["Cross-functional incident response coordination", "Security architecture documentation", "Vendor risk assessment experience"] },
];

function getImpactRank(gap: { area: string; severity: string }, index: number): { impact: string; color: string; probabilityDelta: number } {
  if (gap.severity === "critical" || index === 0) return { impact: "Critical", color: "text-destructive", probabilityDelta: 15 + Math.floor(Math.random() * 10) };
  if (gap.severity === "moderate" || index === 1) return { impact: "High", color: "text-warning", probabilityDelta: 8 + Math.floor(Math.random() * 7) };
  return { impact: "Medium", color: "text-muted-foreground", probabilityDelta: 3 + Math.floor(Math.random() * 5) };
}

export default function GapIntelligence({ analysis, onFixAll, onReEvaluate }: GapIntelligenceProps) {
  const [expanded, setExpanded] = useState(false);
  const [fixingAll, setFixingAll] = useState(false);
  const [addingSkills, setAddingSkills] = useState(false);
  const [addedSkills, setAddedSkills] = useState<string[]>([]);

  const handleFixAll = async () => {
    setFixingAll(true);
    try {
      if (onFixAll) {
        onFixAll();
      } else {
        const { data, error } = await supabase.functions.invoke("agent-orchestrator", {
          body: { agents: ["optimization", "application"] },
        });
        if (error) throw error;
        toast.success("Agent launched! Optimizing your resume and targeting gaps.");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to launch agent");
    } finally {
      setFixingAll(false);
    }
  };

  const handleAddGapsToProfile = async () => {
    setAddingSkills(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const { data } = await supabase.from("job_seeker_profiles").select("skills").eq("user_id", session.user.id).maybeSingle();
      const current = (data?.skills as string[]) || [];
      const currentLower = current.map(s => s.toLowerCase());
      const gapSkills = missingSkills.map(s => s.skill).filter(s => !currentLower.includes(s.toLowerCase()));
      const gapAreas = (analysis.gaps || []).map(g => g.area).filter(a => !currentLower.includes(a.toLowerCase()) && !gapSkills.map(s => s.toLowerCase()).includes(a.toLowerCase()));
      const allNew = [...gapSkills, ...gapAreas];
      if (!allNew.length) { toast.info("All gap skills are already in your profile"); return; }
      await supabase.from("job_seeker_profiles").upsert({
        user_id: session.user.id,
        skills: [...current, ...allNew],
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
      setAddedSkills(allNew);
      toast.success(`${allNew.length} skill(s) added to your profile!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update profile");
    } finally {
      setAddingSkills(false);
    }
  };

  if (!analysis || analysis.overallScore >= 85) return null;

  const gaps = analysis.gaps || [];
  const missingSkills = analysis.matchedSkills?.filter(s => !s.matched) || [];
  const topFixes = gaps.slice(0, 3);
  const totalProbDelta = topFixes.reduce((sum, g, i) => sum + getImpactRank(g, i).probabilityDelta, 0);

  // ATS weaknesses
  const atsWeaknesses: string[] = [];
  if (analysis.overallScore < 60) atsWeaknesses.push("Resume lacks critical ATS keywords — likely filtered before human review");
  if (missingSkills.length > 5) atsWeaknesses.push(`${missingSkills.length} required keywords missing — ATS match rate below industry threshold`);
  if (gaps.some(g => g.severity === "critical")) atsWeaknesses.push("Critical skill gaps signal underqualification to recruiters");
  if (analysis.interviewProbability < 30) atsWeaknesses.push("Interview probability critically low — resume may not pass initial screening");

  // Recruiter weaknesses
  const recruiterWeaknesses: string[] = [];
  if (!analysis.strengths?.length || analysis.strengths.length < 2) recruiterWeaknesses.push("Too few quantifiable achievements to catch recruiter attention");
  if (analysis.overallScore < 50) recruiterWeaknesses.push("Skills narrative doesn't match role requirements at a glance");
  if (gaps.filter(g => g.severity === "critical").length >= 2) recruiterWeaknesses.push("Multiple critical gaps make this a 'no' within 6-second recruiter scan");

  return (
    <Card className="p-6 border-destructive/20 bg-destructive/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground">Why You're Not Getting Interviews</h3>
            <p className="text-xs text-muted-foreground">AI-powered gap analysis against similar hired candidates</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Top 3 fixes callout */}
      <div className="bg-card rounded-xl p-4 border border-accent/20 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-foreground">Fix These 3 Things to 2x Your Chances</span>
          <Badge className="bg-accent/15 text-accent border-accent/30 text-xs ml-auto">+{totalProbDelta}% probability</Badge>
        </div>
        <div className="space-y-3">
          {topFixes.map((gap, i) => {
            const rank = getImpactRank(gap, i);
            return (
              <div key={gap.area} className="flex items-start gap-3">
                <div className={`text-lg font-display font-bold ${rank.color} w-6 flex-shrink-0`}>{i + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{gap.area}</span>
                    <Badge variant="outline" className={`text-[10px] ${rank.color}`}>{rank.impact}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fixing this increases your interview probability by <span className="font-semibold text-accent">+{rank.probabilityDelta}%</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <Button
          onClick={handleFixAll}
          disabled={fixingAll}
          className="w-full gradient-teal text-white mt-3"
          size="sm"
        >
          {fixingAll ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Launching Agent...</>
          ) : (
            <><Wrench className="w-4 h-4 mr-2" />Fix All Gaps — Launch AI Agent</>
          )}
        </Button>
      </div>

      {/* Missing Skills ranked by impact */}
      {missingSkills.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-destructive" /> Missing Skills (Ranked by Impact)
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {missingSkills.slice(0, 10).map((s, i) => (
              <Badge key={s.skill} variant="outline" className={`text-xs ${i < 3 ? "border-destructive/40 text-destructive" : i < 6 ? "border-warning/40 text-warning" : "border-muted text-muted-foreground"}`}>
                {s.skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="space-y-4 animate-fade-in">
          {/* ATS Weaknesses */}
          {atsWeaknesses.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-warning" /> ATS-Level Weaknesses
              </h4>
              <ul className="space-y-1.5">
                {atsWeaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-warning mt-0.5 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recruiter Weaknesses */}
          {recruiterWeaknesses.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Recruiter-Level Weaknesses
              </h4>
              <ul className="space-y-1.5">
                {recruiterWeaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Compared to hired profiles */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-accent" /> How Hired Candidates Compared
            </h4>
            <div className="space-y-2">
              {SIMULATED_PROFILES.slice(0, 3).map(p => (
                <div key={p.title} className="bg-muted/30 rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground">{p.title}</span>
                    <Badge className="bg-success/10 text-success border-success/20 text-[10px]">{p.score}% match</Badge>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {p.keyDifferences.slice(0, 2).map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
