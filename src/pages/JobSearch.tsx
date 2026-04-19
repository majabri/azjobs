import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Search, Loader2, MapPin, Building2, ExternalLink, Target,
  Briefcase, Plus, X, DollarSign, AlertTriangle, TrendingUp,
  Zap, Shield, Clock, Database, Filter, ShieldCheck, ShieldAlert, ShieldX,
  EyeOff, Sparkles, CheckCircle, BookOpen, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  saveJobToApplications,
  getIgnoredJobs, ignoreJob, isJobIgnored, isJobAlreadySaved, type IgnoredJob,
} from "@/lib/job-search";
import { STRATEGY_CONFIG, TRUST_LEVEL_CONFIG, type FakeJobFlag, type HistoricalOutcomes } from "@/lib/job-search/jobQualityEngine";
import { pollMatchScores, markJobInteraction } from "@/services/job/api";
import { type EnrichedJob } from "@/services/matching/api";
import { runSearchOnly } from "@/shell/orchestrator";
import type { JobSearchFilters } from "@/services/job/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSalaryNumber(salary: string): number | null {
  const match = salary.replace(/,/g, "").match(/(\d+)/g);
  if (!match) return null;
  const nums = match.map(Number);
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  return nums[0];
}

const MARKET_BENCHMARKS: Record<string, number> = {
  "entry": 65000, "junior": 75000, "mid": 105000, "senior": 140000, "lead": 165000,
  "staff": 185000, "principal": 210000, "director": 195000, "vp": 230000,
};

function estimateMarketRate(title: string): number {
  const lower = title.toLowerCase();
  for (const [key, val] of Object.entries(MARKET_BENCHMARKS)) { if (lower.includes(key)) return val; }
  if (lower.includes("engineer") || lower.includes("developer")) return 120000;
  if (lower.includes("manager")) return 130000;
  if (lower.includes("analyst")) return 90000;
  if (lower.includes("designer")) return 100000;
  return 100000;
}

function SalaryBadge({ salary, title }: { salary: string; title?: string }) {
  const parsed = parseSalaryNumber(salary);
  if (!parsed) return null;
  const diff = ((parsed - estimateMarketRate(title || "")) / estimateMarketRate(title || "")) * 100;
  if (diff >= 10) return <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-300 dark:text-green-400">↑ Above Market</Badge>;
  if (diff <= -10) return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">↓ Below Market</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/30">≈ Market Rate</Badge>;
}

// AI smart tag → UI config
const AI_SMART_TAG_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  hot_match:  { label: "Hot Match",         color: "text-green-600 border-green-300 dark:text-green-400 bg-green-500/10", icon: TrendingUp },
  good_fit:   { label: "Good Fit",          color: "text-primary border-primary/30",                                      icon: Target },
  stretch:    { label: "Stretch",           color: "text-amber-600 border-amber-300 dark:text-amber-400",                 icon: Zap },
  reach:      { label: "Reach",             color: "text-orange-600 border-orange-300 dark:text-orange-400",              icon: Shield },
  low_roi:    { label: "Low ROI",           color: "text-destructive/70 border-destructive/20",                           icon: AlertTriangle },
  apply_fast: { label: "Apply Fast",        color: "text-orange-600 border-orange-300 dark:text-orange-400",              icon: Zap },
};

function getSmartTagUI(job: EnrichedJob): { label: string; color: string; icon: any } {
  // Use AI smart_tag when available
  if (job.smart_tag && AI_SMART_TAG_CONFIG[job.smart_tag]) {
    return AI_SMART_TAG_CONFIG[job.smart_tag];
  }
  // Fall back to local scoring
  const prob = job.responseProbability || 0;
  if (job.is_flagged) return { label: "Low Confidence", color: "text-destructive border-destructive/30", icon: AlertTriangle };
  if ((job.effortEstimate || 0) > 70 && prob < 40) return { label: "Low ROI", color: "text-destructive/70 border-destructive/20", icon: AlertTriangle };
  if (prob >= 70) return { label: "High Chance", color: "text-green-600 border-green-300 dark:text-green-400", icon: TrendingUp };
  if (prob >= 50 && job.first_seen_at) {
    const days = (Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 3) return { label: "Apply Fast", color: "text-orange-600 border-orange-300 dark:text-orange-400", icon: Zap };
  }
  if (prob < 35) return { label: "Improve Resume First", color: "text-amber-600 border-amber-300 dark:text-amber-400", icon: Shield };
  return { label: "Worth Applying", color: "text-primary border-primary/30", icon: Target };
}

function getFitScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function getFitScoreBg(score: number): string {
  if (score >= 80) return "bg-green-500/10 border-green-300/50";
  if (score >= 60) return "bg-amber-500/10 border-amber-300/50";
  return "bg-destructive/10 border-destructive/30";
}

function getProbColor(prob: number) {
  if (prob >= 70) return "text-green-600 dark:text-green-400";
  if (prob >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function getJobSaveKey(job: { url?: string; title: string; company: string }): string {
  return (job.url || "").trim().toLowerCase() + "|" + job.title.trim().toLowerCase() + "|" + job.company.trim().toLowerCase();
}

const JOB_TYPE_OPTIONS = ["remote", "hybrid", "in-office", "full-time", "part-time", "contract", "short-term"];
const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Job card sub-component
// ---------------------------------------------------------------------------

function JobCard({
  job, onSave, onAnalyze, onIgnore, onApply, isSaving,
}: {
  job: EnrichedJob;
  onSave: () => void;
  onAnalyze: () => void;
  onIgnore: () => void;
  onApply: () => void;
  isSaving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasAiScore = job.fit_score != null;
  const displayProb = hasAiScore ? (job.response_prob ?? job.responseProbability ?? 0) : (job.responseProbability ?? 0);
  const tag = getSmartTagUI(job);
  const TagIcon = tag.icon;
  const trustCfg = job.trustLevel ? TRUST_LEVEL_CONFIG[job.trustLevel] : TRUST_LEVEL_CONFIG.trusted;
  const TrustIcon = trustCfg.icon === "shield-check" ? ShieldCheck : trustCfg.icon === "shield-alert" ? ShieldAlert : ShieldX;
  const hasFlags = job.flags && job.flags.length > 0;
  const hasDanger = job.flags?.some(f => f.severity === "danger");
  const hasSkillData = (job.matched_skills?.length ?? 0) > 0 || (job.skill_gaps?.length ?? 0) > 0;
  const daysAgo = job.first_seen_at ? Math.round((Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <Card className={"p-5 transition-all " + (hasDanger ? "border-destructive/30 bg-destructive/5" : hasFlags ? "border-warning/30 bg-warning/5" : "hover:border-accent/50")}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">

          {/* Title row */}
          <div className="flex items-start gap-2 mb-1">
            <h3 className="font-semibold text-foreground text-lg leading-tight">{job.title}</h3>
            {hasDanger && <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-1" />}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {job.company}</span>
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
            {job.type && <Badge variant="outline" className="capitalize text-xs"><Briefcase className="w-3 h-3 mr-1" />{job.type}</Badge>}
            {job.salary && <span className="flex items-center gap-1"><Badge variant="outline" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />{job.salary}</Badge><SalaryBadge salary={job.salary} title={job.title} /></span>}
            {job.source && <Badge variant="outline" className="text-xs capitalize">{job.source.split(":")[0]}</Badge>}
            {daysAgo !== null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{daysAgo}d ago</span>}
          </div>

          {/* Description (collapsible) */}
          <p className={"text-sm text-muted-foreground mt-2 leading-relaxed " + (expanded ? "" : "line-clamp-3")}>
            {job.description}
          </p>

          {/* AI score + tags row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {hasAiScore && (
              <div className={"flex items-center gap-1.5 rounded-lg border px-2.5 py-1 " + getFitScoreBg(job.fit_score!)}>
                <Sparkles className={"w-3.5 h-3.5 " + getFitScoreColor(job.fit_score!)} />
                <span className={"text-sm font-bold " + getFitScoreColor(job.fit_score!)}>{job.fit_score}% fit</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <TrustIcon className={"w-3.5 h-3.5 " + trustCfg.colorClass} />
              <span className={"text-xs font-semibold " + trustCfg.colorClass}>{trustCfg.label}</span>
            </div>
            <Badge variant="outline" className={"text-xs " + tag.color}><TagIcon className="w-3 h-3 mr-1" />{tag.label}</Badge>
            {displayProb > 0 && (
              <span className={"text-sm font-semibold " + getProbColor(displayProb)}>{displayProb}% response prob.</span>
            )}
          </div>

          {/* AI skill breakdown (expandable) */}
          {hasSkillData && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? "Hide" : "Show"} AI skill analysis
              </button>

              {expanded && (
                <div className="mt-2 space-y-2">
                  {(job.matched_skills?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Skills you have ({job.matched_skills!.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {job.matched_skills!.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-300/50 dark:text-green-400">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(job.skill_gaps?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Skills to develop ({job.skill_gaps!.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {job.skill_gaps!.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300/50 dark:text-amber-400">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {job.match_summary && (
                    <p className="text-xs text-muted-foreground italic mt-1">💡 {job.match_summary}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Flags */}
          {hasFlags && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {job.flags!.map((flag, fi) => (
                <Badge key={fi} variant="outline" className={"text-[10px] " + (flag.severity === "danger" ? "border-destructive/40 text-destructive bg-destructive/5" : "border-warning/40 text-warning bg-warning/5")}>
                  <AlertTriangle className="w-3 h-3 mr-1" />{flag.label}
                </Badge>
              ))}
            </div>
          )}

          {/* Match reason (non-AI) */}
          {!hasAiScore && job.matchReason && !hasDanger && (
            <p className="text-xs text-accent mt-2 italic">💡 {job.matchReason}</p>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div className="flex sm:flex-col gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="text-xs" onClick={onSave} disabled={isSaving}>
            {isSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Saving</> : <><Plus className="w-3.5 h-3.5 mr-1" />Save</>}
          </Button>
          <Button size="sm" className="gradient-indigo text-white text-xs" onClick={onAnalyze}>
            <Target className="w-3.5 h-3.5 mr-1" />Check Fit
          </Button>
          {job.url && (
            <Button variant="outline" size="sm" className="text-xs" onClick={onApply}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" />Apply
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={onIgnore}>
            <EyeOff className="w-3.5 h-3.5 mr-1" />Ignore
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function JobSearchPage() {
  const navigate = useNavigate();

  // Filters
  const [skills, setSkills] = useState<string[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [careerLevel, setCareerLevel] = useState("");
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [minFitScore, setMinFitScore] = useState(60);
  const [searchMode, setSearchMode] = useState<"quality" | "balanced" | "volume">("balanced");
  const [daysOld, setDaysOld] = useState(0);
  const [showFlagged, setShowFlagged] = useState(true);

  // Results
  const [jobs, setJobs] = useState<EnrichedJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [matchingInProgress, setMatchingInProgress] = useState(false);
  const [totalBeforeFilter, setTotalBeforeFilter] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sortBy, setSortBy] = useState<"relevance" | "probability" | "newest" | "decision" | "fit_score">("fit_score");

  // Profile + history
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [historicalOutcomes, setHistoricalOutcomes] = useState<HistoricalOutcomes | undefined>();
  const [savingJobKeys, setSavingJobKeys] = useState<Record<string, boolean>>({});
  const [ignoredList, setIgnoredList] = useState<IgnoredJob[]>([]);
  const [savedApps, setSavedApps] = useState<{ job_title: string; company: string; job_url: string | null }[]>([]);

  // Polling ref for background match scores
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadProfile(); loadIgnoredAndSaved(); }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    if (skills.length > 0 || targetTitles.length > 0) handleSearch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded]);

  // Cleanup poll timer on unmount
  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }, []);

  const loadIgnoredAndSaved = async () => {
    const [ignored, { data: { session } }] = await Promise.all([getIgnoredJobs(), supabase.auth.getSession()]);
    setIgnoredList(ignored);
    if (session) {
      const { data } = await supabase.from("job_applications").select("job_title, company, job_url").eq("user_id", session.user.id);
      if (data) setSavedApps(data as any);
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setProfileLoaded(true); return; }
      const [{ data }, { data: appData }] = await Promise.all([
        supabase.from("job_seeker_profiles").select("skills, preferred_job_types, location, career_level, target_job_titles, salary_min, salary_max, min_match_score, search_mode").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("job_applications").select("status, response_days").eq("user_id", session.user.id),
      ]);
      if (data) {
        if (data.skills) setSkills(data.skills as string[]);
        if (data.preferred_job_types) setJobTypes(data.preferred_job_types as string[]);
        if (data.location && data.location !== '<UNKNOWN>') setLocation(data.location);
        if (data.career_level) setCareerLevel(data.career_level);
        if (data.target_job_titles) setTargetTitles(data.target_job_titles as string[]);
        if (data.salary_min) setSalaryMin(data.salary_min);
        if (data.salary_max) setSalaryMax(data.salary_max);
        if (data.min_match_score != null) setMinFitScore(data.min_match_score);
        if (data.search_mode) setSearchMode(data.search_mode as any);
      }
      if (appData && appData.length >= 3) {
        const total = appData.length;
        const responded = appData.filter(a => a.status !== "applied" && a.status !== "no_response").length;
        const days = appData.filter(a => a.response_days).map(a => a.response_days!);
        const avgDays = days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : 14;
        setHistoricalOutcomes({ totalApplications: total, totalResponses: responded, avgResponseRate: (responded / total) * 100, avgDaysToResponse: avgDays });
      }
    } catch (e) { logger.error("[JobSearch] scrape error:", e); }
    finally { setProfileLoaded(true); }
  };

  const toggleJobType = (type: string) => setJobTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

  const handleSearch = async (overrideFilters?: Partial<JobSearchFilters>) => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    setSearching(true);
    setJobs([]);
    setMatchingInProgress(false);

    const filters: JobSearchFilters = {
      skills, jobTypes, location, query: customQuery, careerLevel,
      targetTitles, salaryMin, salaryMax, searchSource: "database",
      minFitScore, showFlagged, search_mode: searchMode, days_old: daysOld,
      ...overrideFilters,
    };

    let triggeredMatch = false;

    // Fetch + score via the shell orchestrator (steps 1 + 2).
    // JobSearch must NOT call searchJobs / scoreJobs directly — all service
    // chaining is owned by the orchestrator.
    let enriched: EnrichedJob[] = [];
    try {
      const result = await runSearchOnly(filters, historicalOutcomes);
      enriched = result.jobs;
      triggeredMatch = result.matchingTriggered;
    } catch (e) {
      logger.error("[JobSearch] error:", e);
      toast.error("Search encountered an issue.");
    }

    // Filter out ignored / already-saved
    enriched = enriched
      .filter(job => !isJobIgnored(job, ignoredList))
      .filter(job => !isJobAlreadySaved(job, savedApps));

    // Sort
    enriched = sortResults(enriched, sortBy);

    // Filter by fit score (use AI score when available, local score otherwise)
    const effectiveMinFit = overrideFilters?.minFitScore ?? minFitScore;
    const beforeCount = enriched.length;
    if (effectiveMinFit > 0) {
      enriched = enriched.filter(j => {
        const score = j.fit_score ?? j.decisionScore ?? 0;
        return score >= effectiveMinFit;
      });
    }
    if (!showFlagged) enriched = enriched.filter(j => !j.is_flagged);

    setTotalBeforeFilter(beforeCount);
    setJobs(enriched);
    setVisibleCount(PAGE_SIZE);
    setMatchingInProgress(triggeredMatch);

    if (!enriched.length && beforeCount > 0) {
      toast.info(`${beforeCount} jobs found but hidden by your ${effectiveMinFit}% fit score filter.`);
    } else if (!enriched.length && rawJobs.length > 0) {
      toast.info("Jobs found but all filtered out.");
    } else if (!enriched.length) {
      toast.info("No jobs found. Try adjusting your criteria.");
    }

    setSearching(false);

    // Schedule poll for AI scores if match was triggered
    if (triggeredMatch && enriched.length > 0) {
      schedulePollForScores(enriched.map(j => j.id).filter(Boolean) as string[]);
    }
  };

  // Poll for AI match scores every 5 seconds while matching is in progress
  const schedulePollForScores = (jobIds: string[]) => {
    if (!jobIds.length) return;
    pollTimerRef.current = setTimeout(async () => {
      const scoreMap = await pollMatchScores(jobIds);
      if (scoreMap.size > 0) {
        setJobs(prev => {
          const updated = prev.map(j => {
            const scores = j.id ? scoreMap.get(j.id) : undefined;
            return scores ? { ...j, ...scores } : j;
          });
          return sortResults(updated, sortBy);
        });
        // Check if all jobs are now scored
        const allScored = jobIds.every(id => scoreMap.has(id));
        if (!allScored) {
          schedulePollForScores(jobIds.filter(id => !scoreMap.has(id)));
        } else {
          setMatchingInProgress(false);
          toast.success("AI fit scores ready — jobs re-ranked by match quality.");
        }
      } else {
        // Still waiting — poll again
        schedulePollForScores(jobIds);
      }
    }, 5_000);
  };

  const sortResults = (list: EnrichedJob[], by: string): EnrichedJob[] => {
    const sorted = [...list];
    if (by === "fit_score" || by === "decision") {
      sorted.sort((a, b) => {
        const sa = a.fit_score ?? a.decisionScore ?? 0;
        const sb = b.fit_score ?? b.decisionScore ?? 0;
        return sb - sa;
      });
    } else if (by === "probability") {
      sorted.sort((a, b) => (b.response_prob ?? b.responseProbability ?? 0) - (a.response_prob ?? a.responseProbability ?? 0));
    } else if (by === "newest") {
      sorted.sort((a, b) => {
        if (!a.first_seen_at && !b.first_seen_at) return 0;
        if (!a.first_seen_at) return 1;
        if (!b.first_seen_at) return -1;
        return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
      });
    }
    return sorted;
  };

  const handleAnalyzeFit = (job: EnrichedJob) => {
    const jobDesc = `${job.title} at ${job.company}\nLocation: ${job.location}\nType: ${job.type}${job.salary ? "\nSalary: " + job.salary : ""}\n\n${job.description}`;
    navigate("/job-seeker", { state: { prefillJob: jobDesc, fromSearch: true } });
  };

  const handleSaveJob = async (job: EnrichedJob) => {
    const saveKey = getJobSaveKey(job);
    if (savingJobKeys[saveKey]) return;
    setSavingJobKeys(prev => ({ ...prev, [saveKey]: true }));
    try {
      const result = await saveJobToApplications({ title: job.title, company: job.company, url: job.url, description: job.description, location: job.location, type: job.type });
      if (!result.ok) { toast.error(result.error || "Failed to save job"); return; }
      if (result.alreadySaved) { toast.info("Job already saved"); return; }
      if (job.id) markJobInteraction(job.id, "saved").catch(() => {});
      toast.success("Job saved to Applications");
    } finally {
      setSavingJobKeys(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const handleIgnoreJob = async (job: EnrichedJob) => {
    const saveKey = getJobSaveKey(job);
    const ok = await ignoreJob({ title: job.title, company: job.company, url: job.url });
    if (ok) {
      if (job.id) markJobInteraction(job.id, "ignored").catch(() => {});
      setJobs(prev => prev.filter(j => getJobSaveKey(j) !== saveKey));
      setIgnoredList(prev => [...prev, { id: "", job_title: job.title, company: job.company, job_url: job.url }]);
      toast.success("Job hidden");
    }
  };

  const handleApplyJob = (job: EnrichedJob) => {
    if (job.url) {
      window.open(job.url, "_blank", "noopener,noreferrer");
      if (job.id) markJobInteraction(job.id, "applied").catch(() => {});
    }
  };

  const visibleJobs = jobs.filter(j => showFlagged || !j.is_flagged);
  const aiScoredCount = jobs.filter(j => j.fit_score != null).length;

  return (
    <div className="bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-primary mb-3">
            Jobs that <span className="text-gradient-indigo">get you interviews</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            AI scores every job against your profile — so you focus on the ones worth applying to.
          </p>
        </div>

        {/* Filters card */}
        <Card className="p-6 mb-8">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Source</label>
              <Badge variant="default" className="bg-primary text-primary-foreground"><Database className="w-3 h-3 mr-1" />Live Job Database</Badge>
            </div>

            {/* Target titles */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Target Job Titles</label>
              <div className="flex gap-2 mb-2">
                <Input value={titleInput} onChange={e => setTitleInput(e.target.value)} placeholder="e.g. Software Engineer"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const t = titleInput.trim(); if (t && !targetTitles.includes(t)) { setTargetTitles([...targetTitles, t]); setTitleInput(""); } } }} />
                <Button variant="outline" size="sm" onClick={() => { const t = titleInput.trim(); if (t && !targetTitles.includes(t)) { setTargetTitles([...targetTitles, t]); setTitleInput(""); } }}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {targetTitles.map((t, i) => <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setTargetTitles(targetTitles.filter((_, idx) => idx !== i))}>{t} <X className="w-3 h-3 ml-1" /></Badge>)}
              </div>
            </div>

            {/* Career level */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Career Level</label>
              <div className="flex flex-wrap gap-2">
                {["Entry-Level / Junior","Mid-Level","Senior","Manager","Director","VP / Senior Leadership","C-Level / Executive"].map(level => {
                  const levels = careerLevel ? careerLevel.split(", ").filter(Boolean) : [];
                  const isSelected = levels.includes(level);
                  return <Badge key={level} variant={isSelected ? "default" : "outline"} className={"cursor-pointer text-xs " + (isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent/10")}
                    onClick={() => { const nl = isSelected ? levels.filter(l => l !== level) : [...levels, level]; setCareerLevel(nl.join(", ")); }}>{level}</Badge>;
                })}
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Your Skills</label>
              {skills.length > 0
                ? <div className="flex flex-wrap gap-2">{skills.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}</div>
                : <p className="text-sm text-muted-foreground">No skills loaded. <button className="text-accent hover:underline" onClick={() => navigate("/profile")}>Add skills to profile</button></p>
              }
            </div>

            {/* Job type */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Job Type</label>
              <div className="flex flex-wrap gap-2">
                {JOB_TYPE_OPTIONS.map(type => <Badge key={type} variant={jobTypes.includes(type) ? "default" : "outline"} className={"cursor-pointer capitalize " + (jobTypes.includes(type) ? "bg-primary text-primary-foreground" : "hover:bg-accent/10")} onClick={() => toggleJobType(type)}>{type}</Badge>)}
              </div>
            </div>

            {/* Location + query */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Location</label>
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /><Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Remote, New York" /></div>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Additional Keywords</label>
                <Input value={customQuery} onChange={e => setCustomQuery(e.target.value)} placeholder="e.g. startup, Fortune 500..." />
              </div>
            </div>

            {/* Posted within + search mode */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Posted Within</label>
                <select className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 text-foreground" value={daysOld} onChange={e => setDaysOld(Number(e.target.value))}>
                  <option value={0}>Any time</option>
                  <option value={1}>Last 24 hours</option>
                  <option value={3}>Last 3 days</option>
                  <option value={7}>Last week</option>
                  <option value={14}>Last 2 weeks</option>
                  <option value={30}>Last month</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Search Mode</label>
                <select className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 text-foreground" value={searchMode} onChange={e => setSearchMode(e.target.value as any)}>
                  <option value="quality">Quality (top 100)</option>
                  <option value="balanced">Balanced (top 100)</option>
                  <option value="volume">Volume (top 200)</option>
                </select>
              </div>
            </div>

            {/* Fit score slider */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Minimum Fit Score: <span className="text-accent font-bold">{minFitScore}%</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">Hide jobs below this AI fit score threshold</p>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} value={minFitScore} onChange={e => setMinFitScore(Number(e.target.value))} className="flex-1 accent-[hsl(var(--accent))]" />
                <Input type="number" min={0} max={100} value={minFitScore} onChange={e => setMinFitScore(Math.max(0, Math.min(100, Number(e.target.value))))} className="w-20 h-8 text-xs" />
              </div>
            </div>

            {/* Salary */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="text-sm font-semibold text-foreground mb-1 block">Min Salary</label><div className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-muted-foreground" /><Input value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="80,000" /></div></div>
              <div><label className="text-sm font-semibold text-foreground mb-1 block">Max Salary</label><div className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-muted-foreground" /><Input value={salaryMax} onChange={e => setSalaryMax(e.target.value)} placeholder="150,000" /></div></div>
            </div>

            <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90 w-full sm:w-auto" disabled={searching} onClick={() => handleSearch()}>
              {searching ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Searching...</> : <><Search className="w-4 h-4 mr-2" />Search Jobs</>}
            </Button>
          </div>
        </Card>

        {/* AI matching in progress banner */}
        {matchingInProgress && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <Sparkles className="w-4 h-4 text-primary animate-pulse flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-primary">Analyzing your fit score for each job…</p>
              <p className="text-xs text-muted-foreground">Results are re-ranking as AI scores come in. {aiScoredCount > 0 ? `${aiScoredCount} scored so far.` : ""}</p>
            </div>
            <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
          </div>
        )}

        {/* Results header */}
        {jobs.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display font-bold text-primary text-xl">{visibleJobs.length} Jobs</h2>
              {aiScoredCount > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <Sparkles className="w-3 h-3 inline mr-1 text-primary" />
                  {aiScoredCount} AI-scored
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select className="text-sm bg-card border border-input rounded-md px-2 py-1 text-foreground"
                  value={sortBy}
                  onChange={e => {
                    const v = e.target.value as any;
                    setSortBy(v);
                    setJobs(prev => sortResults([...prev], v));
                    setVisibleCount(PAGE_SIZE);
                  }}>
                  <option value="fit_score">AI Fit Score</option>
                  <option value="probability">Response Probability</option>
                  <option value="newest">Newest First</option>
                  <option value="decision">Decision Score</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showFlagged} onChange={e => setShowFlagged(e.target.checked)} className="rounded" /> Show flagged
              </label>
            </div>
          </div>
        )}

        {/* Job cards */}
        <div className="space-y-4">
          {visibleJobs.slice(0, visibleCount).map((job, i) => {
            const saveKey = getJobSaveKey(job);
            return (
              <JobCard
                key={job.id || i}
                job={job}
                isSaving={!!savingJobKeys[saveKey]}
                onSave={() => handleSaveJob(job)}
                onAnalyze={() => handleAnalyzeFit(job)}
                onIgnore={() => handleIgnoreJob(job)}
                onApply={() => handleApplyJob(job)}
              />
            );
          })}
        </div>

        {/* Load more */}
        {visibleCount < visibleJobs.length && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}>
              Load More ({visibleJobs.length - visibleCount} remaining)
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!searching && jobs.length === 0 && profileLoaded && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            {skills.length > 0 || targetTitles.length > 0 ? (
              <>
                <p className="text-lg mb-2">No jobs matched your filters</p>
                <p className="text-sm mb-4">Try lowering the minimum fit score, removing location, or broadening job types</p>
                <Button variant="outline" onClick={() => handleSearch({ minFitScore: 0, showFlagged: true, careerLevel: "" })}>Browse all jobs</Button>
              </>
            ) : (
              <>
                <p className="text-lg mb-2">Set up your profile to get personalized results</p>
                <p className="text-sm mb-4">Add skills and target titles to your <button className="text-accent hover:underline" onClick={() => navigate("/profile")}>Career Profile</button>, or browse everything below</p>
                <Button variant="outline" onClick={() => handleSearch({ skills: [], targetTitles: [], minFitScore: 0, careerLevel: "" })}>Browse all →</Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
