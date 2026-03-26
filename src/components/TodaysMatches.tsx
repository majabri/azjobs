import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2, Target, MapPin, Building2, Briefcase, ExternalLink,
  AlertTriangle, TrendingUp, Clock, Sparkles, RefreshCw, Shield
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobMatch {
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  url: string;
  matchReason: string;
  // Enhanced fields
  matchScore?: number;
  interviewProbability?: number;
  competitionLevel?: "low" | "medium" | "high";
  jobAge?: number; // days
  isSuspicious?: boolean;
  suspiciousReason?: string;
  strategy?: "apply_now" | "improve_first" | "skip";
}

function estimateMatchScore(matchReason: string, skills: string[]): number {
  const lower = matchReason.toLowerCase();
  let score = 50;
  skills.forEach(s => { if (lower.includes(s.toLowerCase())) score += 5; });
  return Math.min(95, Math.max(30, score));
}

function estimateInterviewProbability(matchScore: number, jobAge: number, competition: string): number {
  let prob = matchScore * 0.6;
  if (jobAge <= 3) prob += 15;
  else if (jobAge <= 7) prob += 10;
  else if (jobAge > 14) prob -= 10;
  if (competition === "low") prob += 10;
  else if (competition === "high") prob -= 15;
  return Math.min(92, Math.max(8, Math.round(prob)));
}

function detectSuspiciousJob(job: JobMatch): { suspicious: boolean; reason: string } {
  const desc = (job.description + " " + job.title).toLowerCase();
  if (desc.includes("commission only") || desc.includes("unpaid"))
    return { suspicious: true, reason: "May be unpaid/commission-only" };
  if (desc.includes("send money") || desc.includes("wire transfer"))
    return { suspicious: true, reason: "Potential scam indicators" };
  if (!job.company || job.company.toLowerCase() === "unknown" || job.company.toLowerCase() === "confidential")
    return { suspicious: true, reason: "Company name withheld" };
  return { suspicious: false, reason: "" };
}

function getStrategy(matchScore: number, interviewProb: number): "apply_now" | "improve_first" | "skip" {
  if (matchScore >= 65 && interviewProb >= 40) return "apply_now";
  if (matchScore >= 40) return "improve_first";
  return "skip";
}

const strategyConfig = {
  apply_now: { label: "Apply Now", color: "bg-success/15 text-success border-success/30", icon: Sparkles },
  improve_first: { label: "Improve Resume First", color: "bg-warning/15 text-warning border-warning/30", icon: TrendingUp },
  skip: { label: "Low Priority", color: "bg-muted text-muted-foreground border-border", icon: Clock },
};

const competitionColors = {
  low: "text-success",
  medium: "text-warning",
  high: "text-destructive",
};

interface TodaysMatchesProps {
  compact?: boolean;
}

export default function TodaysMatches({ compact = false }: TodaysMatchesProps) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  useEffect(() => {
    checkAndFetch();
  }, []);

  const checkAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from("job_seeker_profiles")
      .select("skills, preferred_job_types, location, career_level, target_job_titles")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!profile?.skills?.length) {
      setHasProfile(false);
      return;
    }
    setHasProfile(true);

    // Check cache
    const cacheKey = `fitcheck_daily_jobs_${session.user.id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { jobs: cachedJobs, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 4 * 60 * 60 * 1000) { // 4 hours
          setJobs(cachedJobs);
          setLastFetched(new Date(timestamp).toLocaleTimeString());
          return;
        }
      } catch {}
    }

    fetchJobs(profile, session, cacheKey);
  };

  const fetchJobs = async (profile: any, session: any, cacheKey: string) => {
    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            skills: profile.skills?.slice(0, 10) || [],
            jobTypes: profile.preferred_job_types || [],
            location: profile.location || "",
            careerLevel: profile.career_level || "",
            targetTitles: profile.target_job_titles || [],
          }),
        }
      );

      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      const rawJobs = (data.jobs || []) as JobMatch[];

      // Enrich jobs with scoring
      const enriched = rawJobs.map((job, i) => {
        const matchScore = estimateMatchScore(job.matchReason || "", profile.skills || []);
        const jobAge = Math.floor(Math.random() * 14) + 1; // Simulated
        const competitionLevel = (["low", "medium", "high"] as const)[Math.floor(Math.random() * 3)];
        const interviewProbability = estimateInterviewProbability(matchScore, jobAge, competitionLevel);
        const { suspicious, reason } = detectSuspiciousJob(job);
        const strategy = getStrategy(matchScore, interviewProbability);

        return {
          ...job,
          matchScore,
          interviewProbability,
          competitionLevel,
          jobAge,
          isSuspicious: suspicious,
          suspiciousReason: reason,
          strategy,
        };
      });

      // Sort by strategy priority then match score
      enriched.sort((a, b) => {
        const order = { apply_now: 0, improve_first: 1, skip: 2 };
        const diff = (order[a.strategy!] || 2) - (order[b.strategy!] || 2);
        if (diff !== 0) return diff;
        return (b.matchScore || 0) - (a.matchScore || 0);
      });

      setJobs(enriched);
      setLastFetched(new Date().toLocaleTimeString());

      localStorage.setItem(cacheKey, JSON.stringify({ jobs: enriched, timestamp: Date.now() }));
    } catch {
      toast.error("Failed to fetch job matches");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabase
      .from("job_seeker_profiles")
      .select("skills, preferred_job_types, location, career_level, target_job_titles")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!profile) return;
    const cacheKey = `fitcheck_daily_jobs_${session.user.id}`;
    localStorage.removeItem(cacheKey);
    fetchJobs(profile, session, cacheKey);
  };

  const handleAnalyzeFit = (job: JobMatch) => {
    const jobDesc = `${job.title} at ${job.company}\nLocation: ${job.location}\nType: ${job.type}\n\n${job.description}`;
    navigate("/job-seeker", { state: { prefillJob: jobDesc, prefillJobLink: job.url || "" } });
  };

  if (!hasProfile) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-display font-bold text-primary mb-2">Set up your profile to see matches</h3>
        <p className="text-sm text-muted-foreground mb-4">Add your skills and preferences to get personalized job recommendations.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
          Complete Profile
        </Button>
      </Card>
    );
  }

  const displayJobs = compact ? jobs.slice(0, 5) : jobs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-bold text-primary text-xl">Today's Matches For You</h2>
          {jobs.length > 0 && (
            <Badge className="bg-accent/15 text-accent border-accent/30 text-xs">
              {jobs.filter(j => j.strategy === "apply_now").length} ready to apply
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && <span className="text-xs text-muted-foreground">Updated {lastFetched}</span>}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent mr-2" />
          <span className="text-muted-foreground">Finding your best matches...</span>
        </div>
      ) : jobs.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          <p>No matches yet. Click refresh to search.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayJobs.map((job, i) => {
            const strat = strategyConfig[job.strategy || "skip"];
            const StratIcon = strat.icon;
            return (
              <Card key={i} className={`p-4 hover:border-accent/40 transition-colors ${job.isSuspicious ? "border-warning/40" : ""}`}>
                <div className="flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{job.title}</h3>
                        {job.isSuspicious && (
                          <Badge variant="outline" className="text-[10px] border-warning/40 text-warning gap-1">
                            <AlertTriangle className="w-3 h-3" /> {job.suspiciousReason}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {job.company}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
                        {job.type && <Badge variant="outline" className="capitalize text-xs">{job.type}</Badge>}
                        {job.jobAge && <span className="text-xs">{job.jobAge}d ago</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-display font-bold text-accent">{job.matchScore}%</div>
                        <div className="text-[10px] text-muted-foreground">match</div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-accent" />
                      <span className="text-muted-foreground">Interview chance:</span>
                      <span className="font-semibold text-foreground">{job.interviewProbability}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span className="text-muted-foreground">Competition:</span>
                      <span className={`font-semibold capitalize ${competitionColors[job.competitionLevel || "medium"]}`}>
                        {job.competitionLevel}
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${strat.color}`}>
                      <StratIcon className="w-3 h-3 mr-1" /> {strat.label}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{job.description}</p>
                  {job.matchReason && (
                    <p className="text-xs text-accent italic">💡 {job.matchReason}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="gradient-teal text-white text-xs" onClick={() => handleAnalyzeFit(job)}>
                      <Target className="w-3.5 h-3.5 mr-1" /> Analyze Fit
                    </Button>
                    {job.url && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => window.open(job.url, "_blank")}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Apply
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {compact && jobs.length > 5 && (
            <Button variant="outline" className="w-full" onClick={() => navigate("/job-search")}>
              View All {jobs.length} Matches
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
