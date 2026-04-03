import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Search, Loader2, MapPin, Building2, ExternalLink, Target,
  Briefcase, Plus, X, DollarSign, AlertTriangle, TrendingUp,
  Zap, Shield, Clock, Database, Filter, ShieldCheck, ShieldAlert, ShieldX,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  saveJobToApplications,
  getIgnoredJobs, ignoreJob, isJobIgnored, isJobAlreadySaved, type IgnoredJob,
} from "@/lib/job-search";
import { STRATEGY_CONFIG, TRUST_LEVEL_CONFIG, type FakeJobFlag, type HistoricalOutcomes } from "@/lib/job-search/jobQualityEngine";
import { searchJobs as searchJobsService } from "@/services/job/api";
import { scoreJobs, type EnrichedJob } from "@/services/matching/api";
import type { JobResult, JobSearchFilters } from "@/services/job/types";

// ── UI Helpers (presentation only, no business logic) ──────────────────

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
  for (const [key, val] of Object.entries(MARKET_BENCHMARKS)) {
    if (lower.includes(key)) return val;
  }
  if (lower.includes("engineer") || lower.includes("developer")) return 120000;
  if (lower.includes("manager")) return 130000;
  if (lower.includes("analyst")) return 90000;
  if (lower.includes("designer")) return 100000;
  return 100000;
}

function SalaryBadge({ salary, title }: { salary: string; title?: string }) {
  const parsed = parseSalaryNumber(salary);
  if (!parsed) return null;
  const market = estimateMarketRate(title || "");
  const diff = ((parsed - market) / market) * 100;
  if (diff >= 10) return <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">↑ Above Market</Badge>;
  if (diff <= -10) return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">↓ Below Market</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/30">≈ Market Rate</Badge>;
}

function getSmartTagUI(job: EnrichedJob, prob: number): { label: string; color: string; icon: any } {
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

function getJobSaveKey(job: { url?: string; title: string; company: string }): string {
  const urlPart = (job.url || "").trim().toLowerCase();
  return `${urlPart}|${job.title.trim().toLowerCase()}|${job.company.trim().toLowerCase()}`;
}

function getProbColor(prob: number) {
  if (prob >= 70) return "text-green-600 dark:text-green-400";
  if (prob >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

const JOB_TYPE_OPTIONS = [
  "remote", "hybrid", "in-office", "full-time", "part-time", "contract", "short-term",
];

const PAGE_SIZE = 50;

export default function JobSearchPage() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<string[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [careerLevel, setCareerLevel] = useState("");
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [jobs, setJobs] = useState<EnrichedJob[]>([]);
  const [citations, setCitations] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [searchSource, setSearchSource] = useState<"all" | "ai" | "database">("all");
  const [sortBy, setSortBy] = useState<"relevance" | "probability" | "newest" | "decision">("decision");
  const [showFlagged, setShowFlagged] = useState(true);
  const [historicalOutcomes, setHistoricalOutcomes] = useState<HistoricalOutcomes | undefined>();
  const [savingJobKeys, setSavingJobKeys] = useState<Record<string, boolean>>({});
  const [ignoredList, setIgnoredList] = useState<IgnoredJob[]>([]);
  const [savedApps, setSavedApps] = useState<{ job_title: string; company: string; job_url: string | null }[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [minFitScore, setMinFitScore] = useState(60);

  useEffect(() => { loadProfile(); loadIgnoredAndSaved(); }, []);

  const loadIgnoredAndSaved = async () => {
    const [ignored, { data: { session } }] = await Promise.all([
      getIgnoredJobs(),
      supabase.auth.getSession(),
    ]);
    setIgnoredList(ignored);
    if (session) {
      const { data } = await supabase
        .from("job_applications")
        .select("job_title, company, job_url")
        .eq("user_id", session.user.id);
      if (data) setSavedApps(data as any);
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const [{ data }, { data: appData }] = await Promise.all([
        supabase.from("job_seeker_profiles")
          .select("skills, preferred_job_types, location, career_level, target_job_titles, salary_min, salary_max, min_match_score")
          .eq("user_id", session.user.id).maybeSingle(),
        supabase.from("job_applications").select("status, response_days").eq("user_id", session.user.id),
      ]);
      if (data) {
        if (data.skills) setSkills(data.skills as string[]);
        if (data.preferred_job_types) setJobTypes(data.preferred_job_types as string[]);
        if (data.location) setLocation(data.location);
        if (data.career_level) setCareerLevel(data.career_level);
        if (data.target_job_titles) setTargetTitles(data.target_job_titles as string[]);
        if (data.salary_min) setSalaryMin(data.salary_min);
        if (data.salary_max) setSalaryMax(data.salary_max);
        if (data.min_match_score != null) setMinFitScore(data.min_match_score);
        setProfileLoaded(true);
      }
      if (appData && appData.length >= 3) {
        const total = appData.length;
        const responded = appData.filter(a => a.status !== "applied" && a.status !== "no_response").length;
        const days = appData.filter(a => a.response_days).map(a => a.response_days!);
        const avgDays = days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : 14;
        setHistoricalOutcomes({ totalApplications: total, totalResponses: responded, avgResponseRate: (responded / total) * 100, avgDaysToResponse: avgDays });
      }
    } catch (e) { console.error(e); }
  };

  const toggleJobType = (type: string) => {
    setJobTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  // ── Search orchestration: delegates to job-service + matching-service ──

  const handleSearch = async () => {
    if (!skills.length && !customQuery.trim() && !targetTitles.length) {
      toast.error("Add skills, titles, or a search query");
      return;
    }
    setSearching(true);
    setJobs([]);
    setCitations([]);

    const filters: JobSearchFilters = {
      skills, jobTypes, location, query: customQuery, careerLevel,
      targetTitles, salaryMin, salaryMax, searchSource, minFitScore, showFlagged,
    };

    // Step 1: Job service fetches raw results (DB + AI with async queue)
    // This NEVER throws — always returns a result (possibly empty)
    let rawJobs: JobResult[] = [];
    let cits: string[] = [];
    try {
      const result = await searchJobsService(filters);
      rawJobs = result.jobs;
      cits = result.citations;
    } catch (e) {
      console.error("[JobSearch] Search service error (recovering):", e);
      toast.error("Search encountered an issue. Showing partial results.");
    }

    // Step 2: Filter out ignored/saved jobs
    let filtered = rawJobs
      .filter(job => !isJobIgnored(job, ignoredList))
      .filter(job => !isJobAlreadySaved(job, savedApps));

    // Step 3: Matching service enriches with trust, probability, strategy
    // If matching fails, we still show jobs with default scores
    let enriched: EnrichedJob[];
    try {
      enriched = scoreJobs({ jobs: filtered, skills, historicalOutcomes });
    } catch (e) {
      console.error("[JobSearch] Matching service error (degrading gracefully):", e);
      // Fallback: show jobs without enrichment
      enriched = filtered.map(job => ({
        ...job,
        flags: [],
        trustScore: 50,
        trustLevel: "caution" as const,
        strategy: "apply_now" as const,
        responseProbability: 50,
        decisionScore: job.quality_score || 50,
        effortEstimate: 50,
        smartTag: "Worth Applying",
      }));
    }

    // Step 4: Sort
    if (sortBy === "decision") {
      enriched.sort((a, b) => (b.decisionScore || 0) - (a.decisionScore || 0));
    } else if (sortBy === "probability") {
      enriched.sort((a, b) => (b.responseProbability || 0) - (a.responseProbability || 0));
    } else if (sortBy === "newest") {
      enriched.sort((a, b) => {
        if (!a.first_seen_at && !b.first_seen_at) return 0;
        if (!a.first_seen_at) return 1;
        if (!b.first_seen_at) return -1;
        return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
      });
    }

    // Step 5: Client-side filters
    if (!showFlagged) enriched = enriched.filter(j => !j.is_flagged);
    enriched = enriched.filter(j => (j.decisionScore || 0) >= minFitScore);

    setJobs(enriched);
    setCitations(cits);
    setVisibleCount(PAGE_SIZE);
    if (!enriched.length && rawJobs.length > 0) {
      toast.info("Jobs found but filtered out. Try lowering minimum fit score.");
    } else if (!enriched.length) {
      toast.info("No jobs found. Try adjusting your criteria.");
    }
    setSearching(false);
  };

  const handleAnalyzeFit = (job: EnrichedJob) => {
    const jobDesc = `${job.title} at ${job.company}\nLocation: ${job.location}\nType: ${job.type}${job.salary ? `\nSalary: ${job.salary}` : ""}\n\n${job.description}`;
    navigate("/job-seeker", { state: { prefillJob: jobDesc, prefillJobLink: job.url || "", fromSearch: true } });
  };

  const handleSaveJob = async (job: EnrichedJob) => {
    const saveKey = getJobSaveKey(job);
    if (savingJobKeys[saveKey]) return;

    setSavingJobKeys((prev) => ({ ...prev, [saveKey]: true }));
    try {
      const result = await saveJobToApplications({
        title: job.title, company: job.company, url: job.url,
        description: job.description, location: job.location, type: job.type,
      });
      if (!result.ok) { toast.error(result.error || "Failed to save job"); return; }
      if (result.alreadySaved) { toast.info("Job already saved"); return; }
      toast.success("Job saved to Applications");
    } finally {
      setSavingJobKeys((prev) => ({ ...prev, [saveKey]: false }));
    }
  };

  return (
    <div className="bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-primary mb-3">
            Jobs that <span className="text-gradient-teal">get you interviews</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            AI finds the best opportunities and shows your interview probability for each one.
          </p>
        </div>

        {/* Search Controls */}
        <Card className="p-6 mb-8">
          <div className="space-y-4">
            {/* Search Source Toggle */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Search Source</label>
              <div className="flex gap-2">
                {(["all", "database", "ai"] as const).map(src => (
                  <Badge
                    key={src}
                    variant={searchSource === src ? "default" : "outline"}
                    className={`cursor-pointer capitalize ${searchSource === src ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                    onClick={() => setSearchSource(src)}
                  >
                    {src === "all" ? (
                      <><Database className="w-3 h-3 mr-1" /> All Sources</>
                    ) : src === "database" ? (
                      <><Database className="w-3 h-3 mr-1" /> Job Database</>
                    ) : (
                      <><Search className="w-3 h-3 mr-1" /> AI Search</>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Target Titles */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Target Job Titles</label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = titleInput.trim();
                      if (t && !targetTitles.includes(t)) { setTargetTitles([...targetTitles, t]); setTitleInput(""); }
                    }
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => {
                  const t = titleInput.trim();
                  if (t && !targetTitles.includes(t)) { setTargetTitles([...targetTitles, t]); setTitleInput(""); }
                }}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {targetTitles.map((t, i) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setTargetTitles(targetTitles.filter((_, idx) => idx !== i))}>
                    {t} <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Career Level <span className="text-xs text-muted-foreground font-normal">(select multiple)</span></label>
              <div className="flex flex-wrap gap-2">
                {["Entry-Level / Junior", "Mid-Level", "Senior", "Manager", "Director", "VP / Senior Leadership", "C-Level / Executive"].map(level => {
                  const levels = careerLevel ? careerLevel.split(", ").filter(Boolean) : [];
                  const isSelected = levels.includes(level);
                  return (
                    <Badge
                      key={level}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                      onClick={() => {
                        const newLevels = isSelected ? levels.filter(l => l !== level) : [...levels, level];
                        setCareerLevel(newLevels.join(", "));
                      }}
                    >{level}</Badge>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Your Skills</label>
              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No skills loaded. <button className="text-accent hover:underline" onClick={() => navigate("/profile")}>Add skills</button>
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Job Type</label>
              <div className="flex flex-wrap gap-2">
                {JOB_TYPE_OPTIONS.map(type => (
                  <Badge
                    key={type}
                    variant={jobTypes.includes(type) ? "default" : "outline"}
                    className={`cursor-pointer capitalize ${jobTypes.includes(type) ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                    onClick={() => toggleJobType(type)}
                  >{type}</Badge>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Location</label>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Remote, London, Berlin, Singapore, or leave blank for global" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Additional Criteria</label>
                <Input value={customQuery} onChange={e => setCustomQuery(e.target.value)} placeholder="e.g. startup, Fortune 500..." />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Minimum Fit Score: <span className="text-accent font-bold">{minFitScore}%</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">Only show jobs with a decision score at or above this threshold</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={minFitScore}
                  onChange={e => setMinFitScore(Number(e.target.value))}
                  className="flex-1 accent-[hsl(var(--accent))]"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minFitScore}
                  onChange={e => setMinFitScore(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-20 h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Min Salary</label>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="80,000" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Max Salary</label>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={salaryMax} onChange={e => setSalaryMax(e.target.value)} placeholder="150,000" />
                </div>
              </div>
            </div>

            <Button className="gradient-teal text-white shadow-teal hover:opacity-90 w-full sm:w-auto" disabled={searching} onClick={handleSearch}>
              {searching ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...</> : <><Search className="w-4 h-4 mr-2" /> Search Jobs</>}
            </Button>
          </div>
        </Card>

        {/* Results Controls */}
        {jobs.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-display font-bold text-primary text-xl">{jobs.length} Jobs Found</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  className="text-sm bg-card border border-input rounded-md px-2 py-1 text-foreground"
                  value={sortBy}
                  onChange={e => {
                    setSortBy(e.target.value as any);
                    setVisibleCount(PAGE_SIZE);
                    setJobs(prev => {
                      const sorted = [...prev];
                      if (e.target.value === "decision") sorted.sort((a, b) => (b.decisionScore || 0) - (a.decisionScore || 0));
                      else if (e.target.value === "probability") sorted.sort((a, b) => (b.responseProbability || 0) - (a.responseProbability || 0));
                      else if (e.target.value === "newest") sorted.sort((a, b) => {
                        if (!a.first_seen_at && !b.first_seen_at) return 0;
                        if (!a.first_seen_at) return 1;
                        if (!b.first_seen_at) return -1;
                        return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
                      });
                      return sorted;
                    });
                  }}
                >
                  <option value="decision">Decision Score</option>
                  <option value="relevance">Relevance</option>
                  <option value="probability">Response Probability</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showFlagged} onChange={e => setShowFlagged(e.target.checked)} className="rounded" />
                Show flagged
              </label>
            </div>
          </div>
        )}

        {/* Job Cards */}
        <div className="space-y-4">
          {jobs.filter(j => showFlagged || !j.is_flagged).slice(0, visibleCount).map((job, i) => {
            const prob = job.responseProbability || 0;
            const tag = getSmartTagUI(job, prob);
            const TagIcon = tag.icon;
            const trustCfg = job.trustLevel ? TRUST_LEVEL_CONFIG[job.trustLevel] : TRUST_LEVEL_CONFIG.trusted;
            const TrustIcon = trustCfg.icon === "shield-check" ? ShieldCheck : trustCfg.icon === "shield-alert" ? ShieldAlert : ShieldX;
            const hasFlags = job.flags && job.flags.length > 0;
            const hasDanger = job.flags?.some(f => f.severity === "danger");
            const saveKey = getJobSaveKey(job);

            return (
              <Card key={job.id || i} className={`p-5 transition-colors ${hasDanger ? "border-destructive/30 bg-destructive/5" : hasFlags ? "border-warning/30 bg-warning/5" : "hover:border-accent/50"}`}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-lg">{job.title}</h3>
                      {hasDanger && <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-1" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {job.company}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
                      {job.type && <Badge variant="outline" className="capitalize text-xs"><Briefcase className="w-3 h-3 mr-1" /> {job.type}</Badge>}
                      {job.salary && (
                        <span className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs"><DollarSign className="w-3 h-3 mr-1" /> {job.salary}</Badge>
                          <SalaryBadge salary={job.salary} title={job.title} />
                        </span>
                      )}
                      {job.source && <Badge variant="outline" className="text-xs capitalize">{job.source}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-3">{job.description}</p>

                    {/* Trust + Probability + Smart Tags */}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <div className="flex items-center gap-1">
                        <TrustIcon className={`w-3.5 h-3.5 ${trustCfg.colorClass}`} />
                        <span className={`text-xs font-semibold ${trustCfg.colorClass}`}>{trustCfg.label}</span>
                      </div>
                      <Badge variant="outline" className={`text-xs ${tag.color}`}>
                        <TagIcon className="w-3 h-3 mr-1" /> {tag.label}
                      </Badge>
                      <span className={`text-sm font-semibold ${getProbColor(prob)}`}>
                        {prob}% response probability
                      </span>
                      {job.first_seen_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.round((Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                        </span>
                      )}
                    </div>

                    {/* Flag warnings */}
                    {hasFlags && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {job.flags!.map((flag, fi) => (
                          <Badge key={fi} variant="outline" className={`text-[10px] ${
                            flag.severity === "danger" ? "border-destructive/40 text-destructive bg-destructive/5" : "border-warning/40 text-warning bg-warning/5"
                          }`}>
                            <AlertTriangle className="w-3 h-3 mr-1" /> {flag.label}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {job.matchReason && !hasDanger && (
                      <p className="text-xs text-accent mt-2 italic">💡 {job.matchReason}</p>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleSaveJob(job)}
                      disabled={!!savingJobKeys[saveKey]}
                    >
                      {savingJobKeys[saveKey]
                        ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Saving</>
                        : <><Plus className="w-3.5 h-3.5 mr-1" /> Save Job</>}
                    </Button>
                    <Button size="sm" className="gradient-teal text-white text-xs" onClick={() => handleAnalyzeFit(job)}>
                      <Target className="w-3.5 h-3.5 mr-1" /> Check My Chances
                    </Button>
                    {job.url && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                        window.open(job.url, "_blank", "noopener,noreferrer");
                      }}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Find & Apply
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        const ok = await ignoreJob({ title: job.title, company: job.company, url: job.url });
                        if (ok) {
                          setJobs(prev => prev.filter(j => getJobSaveKey(j) !== saveKey));
                          setIgnoredList(prev => [...prev, { id: '', job_title: job.title, company: job.company, job_url: job.url }]);
                          toast.success("Job hidden — won't appear again");
                        }
                      }}
                    >
                      <EyeOff className="w-3.5 h-3.5 mr-1" /> Ignore
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {visibleCount < jobs.filter(j => showFlagged || !j.is_flagged).length && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            >
              Load More ({jobs.filter(j => showFlagged || !j.is_flagged).length - visibleCount} remaining)
            </Button>
          </div>
        )}

        {citations.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {citations.map((c, i) => (
                <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline truncate max-w-xs">
                  [{i + 1}] {c}
                </a>
              ))}
            </div>
          </div>
        )}

        {!searching && jobs.length === 0 && profileLoaded && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Click "Search Jobs" to find matching opportunities</p>
          </div>
        )}
      </div>
    </div>
  );
}
