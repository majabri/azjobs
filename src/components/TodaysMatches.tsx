import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Target,
  MapPin,
  Building2,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  Clock,
  Sparkles,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Zap,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  detectFakeJobFlags,
  getTrustScore,
  calculateResponseProbability,
  getJobStrategy,
  STRATEGY_CONFIG,
  TRUST_LEVEL_CONFIG,
  type FakeJobFlag,
  type HistoricalOutcomes,
} from "@/lib/jobQualityEngine";
import { saveJobToApplications } from "@/lib/saveJob";

interface JobMatch {
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  url: string;
  matchReason: string;
  matchScore?: number;
  responseProbability?: number;
  competitionLevel?: "low" | "medium" | "high";
  jobAge?: number;
  trustScore?: number;
  trustLevel?: "trusted" | "caution" | "risky";
  flags?: FakeJobFlag[];
  strategy?: "apply_now" | "apply_fast" | "improve_first" | "skip";
}

const GENERIC_JOB_PATH_SEGMENTS = new Set([
  "careers",
  "career",
  "jobs",
  "job",
  "job-search",
  "open-positions",
  "positions",
  "vacancies",
  "opportunities",
  "join-us",
  "work-with-us",
  "employment",
]);

const LISTING_TAIL_SEGMENTS = new Set(["search", "results", "all", "openings", "index", "list"]);

const NON_JOB_PAGE_SEGMENTS = new Set([
  "about",
  "company",
  "team",
  "culture",
  "people",
  "mission",
  "values",
  "home",
  "contact",
]);

function normalizeJobUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";

  let value = rawUrl.trim();
  if (!value) return "";

  const markdownUrl = value.match(/\((https?:\/\/[^)\s]+)\)/i);
  if (markdownUrl?.[1]) value = markdownUrl[1];

  const plainHttpUrl = value.match(/https?:\/\/[^\s<>'"\])]+/i);
  if (plainHttpUrl?.[0]) value = plainHttpUrl[0];

  value = value.replace(/[),.;]+$/g, "").trim();
  if (!value) return "";

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase();
    if (!host || host.includes("example.com") || host.includes("placeholder")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function isGenericJobListingUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname
      .split("/")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    if (parts.length === 0) return true;

    const allGeneric = parts.every((p) => GENERIC_JOB_PATH_SEGMENTS.has(p) || LISTING_TAIL_SEGMENTS.has(p));
    if (allGeneric) return true;

    if (parts.length === 1 && GENERIC_JOB_PATH_SEGMENTS.has(parts[0])) return true;

    if (parts.length === 2 && GENERIC_JOB_PATH_SEGMENTS.has(parts[0]) && LISTING_TAIL_SEGMENTS.has(parts[1])) {
      return true;
    }

    const last = parts[parts.length - 1];
    if (GENERIC_JOB_PATH_SEGMENTS.has(last) || LISTING_TAIL_SEGMENTS.has(last)) return true;

    const qp = url.searchParams;
    if (
      ["q", "query", "keywords", "search", "location", "department", "team"].some((key) => qp.has(key)) &&
      parts.length <= 2
    ) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

function hasSubstantiveJobDescription(description?: string | null): boolean {
  if (!description) return false;
  const text = description.trim();
  if (text.length < 140) return false;
  if (text.split(/\s+/).length < 24) return false;
  return true;
}

function isLikelyDirectJobPostingUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname
      .split("/")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    if (parts.length === 0) return false;

    const last = parts[parts.length - 1];
    if (NON_JOB_PAGE_SEGMENTS.has(last)) return false;

    const hasJobWordInPath = parts.some((p) => /job|jobs|position|opening|opportunit|career/.test(p));
    const hasNumericId = parts.some((p) => /\d{4,}/.test(p));
    const hasLongSlug = parts.some((p) => p.includes("-") && p.length >= 16);
    const hasKnownJobQuery = ["gh_jid", "job", "jobid", "jk", "lever-source", "oid"].some((k) =>
      url.searchParams.has(k),
    );

    if (parts.length === 1 && !hasNumericId && !hasLongSlug && !hasKnownJobQuery) return false;

    return hasJobWordInPath || hasNumericId || hasLongSlug || hasKnownJobQuery;
  } catch {
    return false;
  }
}

function estimateMatchScore(matchReason: string, skills: string[]): number {
  const lower = matchReason.toLowerCase();
  let score = 50;
  skills.forEach((s) => {
    if (lower.includes(s.toLowerCase())) score += 5;
  });
  return Math.min(95, Math.max(30, score));
}

const TRUST_ICONS = { "shield-check": ShieldCheck, "shield-alert": ShieldAlert, "shield-x": ShieldX };
const STRATEGY_ICONS = { apply_now: Sparkles, apply_fast: Zap, improve_first: TrendingUp, skip: Clock };

interface TodaysMatchesProps {
  compact?: boolean;
}

export default function TodaysMatches({ compact = false }: TodaysMatchesProps) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [historicalOutcomes, setHistoricalOutcomes] = useState<HistoricalOutcomes | undefined>();
  const [savingJobKeys, setSavingJobKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    checkAndFetch();
  }, []);

  const loadHistoricalOutcomes = async (userId: string): Promise<HistoricalOutcomes | undefined> => {
    try {
      const { data } = await supabase.from("job_applications").select("status, response_days").eq("user_id", userId);
      if (!data || data.length < 3) return undefined;
      const total = data.length;
      const responded = data.filter((a) => a.status !== "applied" && a.status !== "no_response").length;
      const responseDays = data.filter((a) => a.response_days).map((a) => a.response_days!);
      const avgDays = responseDays.length > 0 ? responseDays.reduce((a, b) => a + b, 0) / responseDays.length : 14;
      return {
        totalApplications: total,
        totalResponses: responded,
        avgResponseRate: (responded / total) * 100,
        avgDaysToResponse: avgDays,
      };
    } catch {
      return undefined;
    }
  };

  const checkAndFetch = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const [{ data: profile }, outcomes] = await Promise.all([
      supabase
        .from("job_seeker_profiles")
        .select("skills, preferred_job_types, location, career_level, target_job_titles")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      loadHistoricalOutcomes(session.user.id),
    ]);

    if (!profile?.skills?.length) {
      setHasProfile(false);
      return;
    }
    setHasProfile(true);
    setHistoricalOutcomes(outcomes);

    const cacheKey = `fitcheck_daily_jobs_v2_${session.user.id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { jobs: cachedJobs, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 4 * 60 * 60 * 1000) {
          const vettedCachedJobs = (cachedJobs || []).filter((job: JobMatch) => {
            const normalizedUrl = normalizeJobUrl(job.url);
            return (
              Boolean(normalizedUrl) &&
              !isGenericJobListingUrl(normalizedUrl) &&
              hasSubstantiveJobDescription(job.description)
            );
          });

          if (vettedCachedJobs.length > 0) {
            setJobs(vettedCachedJobs);
            setLastFetched(new Date(timestamp).toLocaleTimeString());
            return;
          }
        }
      } catch {}
    }

    fetchJobs(profile, session, cacheKey, outcomes);
  };

  const enrichJobs = (rawJobs: any[], skills: string[], outcomes?: HistoricalOutcomes): JobMatch[] => {
    const allTitles = rawJobs.map((j) => j.title || "");

    const enriched = rawJobs.map((job) => {
      const matchScore = estimateMatchScore(job.matchReason || "", skills);
      // Use real posted date if available, otherwise estimate from data
      const postedDate = job.postedDate || job.created_at || job.first_seen_at;
      const jobAge = postedDate ? Math.max(1, Math.floor((Date.now() - new Date(postedDate).getTime()) / 86400000)) : 7; // default to 7 days if no date available
      const competitionLevel: "low" | "medium" | "high" = jobAge <= 3 ? "low" : jobAge <= 14 ? "medium" : "high";

      // Fake job detection
      const flags = detectFakeJobFlags({
        title: job.title,
        company: job.company,
        description: job.description,
        url: job.url,
        location: job.location,
        jobAge,
        allJobTitles: allTitles,
      });
      const { score: trustScore, level: trustLevel } = getTrustScore(flags);

      // Response probability with historical data
      const skillWords = skills.map((s) => s.toLowerCase());
      const descLower = (job.description || "").toLowerCase();
      const matched = skillWords.filter((s) => descLower.includes(s)).length;
      const skillMatchRatio = skills.length > 0 ? matched / skills.length : 0.5;

      const responseProbability = calculateResponseProbability({
        matchScore,
        jobAge,
        competitionLevel,
        trustScore,
        historicalOutcomes: outcomes,
        skillMatchRatio,
      });

      const strategy = getJobStrategy(matchScore, responseProbability, trustLevel, jobAge);

      return {
        ...job,
        matchScore,
        jobAge,
        competitionLevel,
        flags,
        trustScore,
        trustLevel,
        responseProbability,
        strategy,
      };
    });

    // Sort: apply_fast > apply_now > improve_first > skip, then by match score
    const order = { apply_fast: 0, apply_now: 1, improve_first: 2, skip: 3 };
    enriched.sort((a, b) => {
      const diff = (order[a.strategy!] || 3) - (order[b.strategy!] || 3);
      return diff !== 0 ? diff : (b.matchScore || 0) - (a.matchScore || 0);
    });

    return enriched;
  };

  const fetchJobs = async (profile: any, session: any, cacheKey: string, outcomes?: HistoricalOutcomes) => {
    setLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          skills: profile.skills?.slice(0, 10) || [],
          jobTypes: profile.preferred_job_types || [],
          location: profile.location || "",
          careerLevel: profile.career_level || "",
          targetTitles: profile.target_job_titles || [],
        }),
      });
      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();

      const vettedJobs = ((data.jobs || []) as JobMatch[])
        .map((job) => ({
          ...job,
          url: normalizeJobUrl(job.url),
        }))
        .filter(
          (job) =>
            Boolean(job.url) &&
            !isGenericJobListingUrl(job.url) &&
            hasSubstantiveJobDescription(job.description),
        );

      const uniqueByUrl = new Map<string, JobMatch>();
      for (const job of vettedJobs) {
        if (!uniqueByUrl.has(job.url)) uniqueByUrl.set(job.url, job);
      }

      const enriched = enrichJobs(Array.from(uniqueByUrl.values()), profile.skills || [], outcomes);
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabase
      .from("job_seeker_profiles")
      .select("skills, preferred_job_types, location, career_level, target_job_titles")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!profile) return;
    const cacheKey = `fitcheck_daily_jobs_v2_${session.user.id}`;
    localStorage.removeItem(cacheKey);
    fetchJobs(profile, session, cacheKey, historicalOutcomes);
  };

  const handleAnalyzeFit = (job: JobMatch) => {
    const jobDesc = `${job.title} at ${job.company}\nLocation: ${job.location}\nType: ${job.type}\n\n${job.description}`;
    navigate("/job-seeker", { state: { prefillJob: jobDesc, prefillJobLink: job.url || "" } });
  };

  const getJobSaveKey = (job: JobMatch): string => {
    const urlPart = (job.url || "").trim().toLowerCase();
    return `${urlPart}|${job.title.trim().toLowerCase()}|${job.company.trim().toLowerCase()}`;
  };

  const handleSaveJob = async (job: JobMatch) => {
    const saveKey = getJobSaveKey(job);
    if (savingJobKeys[saveKey]) return;

    setSavingJobKeys((prev) => ({ ...prev, [saveKey]: true }));
    try {
      const result = await saveJobToApplications({
        title: job.title,
        company: job.company,
        url: job.url,
        description: job.description,
        location: job.location,
        type: job.type,
      });

      if (!result.ok) {
        toast.error(result.error || "Failed to save job");
        return;
      }

      if (result.alreadySaved) {
        toast.info("Job already saved");
        return;
      }

      toast.success("Job saved to Applications");
    } finally {
      setSavingJobKeys((prev) => ({ ...prev, [saveKey]: false }));
    }
  };

  if (!hasProfile) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-display font-bold text-primary mb-2">Set up your profile to see matches</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Add your skills and preferences to get personalized job recommendations.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
          Complete Profile
        </Button>
      </Card>
    );
  }

  const displayJobs = compact ? jobs.slice(0, 3) : jobs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-bold text-primary text-xl">Today's Matches For You</h2>
          {jobs.length > 0 && (
            <Badge className="bg-accent/15 text-accent border-accent/30 text-xs">
              {jobs.filter((j) => j.strategy === "apply_now" || j.strategy === "apply_fast").length} ready to apply
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
            const strat = STRATEGY_CONFIG[job.strategy || "skip"];
            const StratIcon = STRATEGY_ICONS[job.strategy || "skip"];
            const trustCfg = TRUST_LEVEL_CONFIG[job.trustLevel || "trusted"];
            const TrustIcon = TRUST_ICONS[trustCfg.icon];
            const hasFlags = job.flags && job.flags.length > 0;
            const hasDanger = job.flags?.some((f) => f.severity === "danger");
            const saveKey = getJobSaveKey(job);

            return (
              <Card
                key={i}
                className={`p-4 hover:border-accent/40 transition-colors ${hasDanger ? "border-destructive/40 bg-destructive/5" : hasFlags ? "border-warning/40" : ""}`}
              >
                <div className="flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{job.title}</h3>
                        {hasDanger && <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" /> {job.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {job.location}
                        </span>
                        {job.type && (
                          <Badge variant="outline" className="capitalize text-xs">
                            {job.type}
                          </Badge>
                        )}
                        {job.jobAge && <span className="text-xs">{job.jobAge}d ago</span>}
                        {job.url && isLikelyDirectJobPostingUrl(job.url) && (
                          <Badge
                            variant="outline"
                            className="text-xs border-emerald-500/40 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400"
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" /> Direct Link Verified
                          </Badge>
                        )}
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
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-accent" />
                      <span className="text-muted-foreground">Response chance:</span>
                      <span
                        className={`font-semibold ${
                          (job.responseProbability || 0) >= 60
                            ? "text-success"
                            : (job.responseProbability || 0) >= 35
                              ? "text-warning"
                              : "text-destructive"
                        }`}
                      >
                        {job.responseProbability}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrustIcon className={`w-3.5 h-3.5 ${trustCfg.colorClass}`} />
                      <span className={`font-semibold ${trustCfg.colorClass}`}>{trustCfg.label}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${strat.colorClass}`}>
                      <StratIcon className="w-3 h-3 mr-1" /> {strat.label}
                    </Badge>
                  </div>

                  {/* Warning flags */}
                  {hasFlags && !compact && (
                    <div className="flex flex-wrap gap-2">
                      {job.flags!.map((flag, fi) => (
                        <Badge
                          key={fi}
                          variant="outline"
                          className={`text-[10px] ${
                            flag.severity === "danger"
                              ? "border-destructive/40 text-destructive bg-destructive/5"
                              : "border-warning/40 text-warning bg-warning/5"
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" /> {flag.label}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {!compact && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{job.description}</p>
                  )}
                  {compact && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{job.description}</p>
                  )}
                  {job.matchReason && <p className="text-xs text-accent italic truncate">💡 {job.matchReason}</p>}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleSaveJob(job)}
                      disabled={!!savingJobKeys[saveKey]}
                    >
                      {savingJobKeys[saveKey] ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Saving
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Save Job
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="gradient-teal text-white text-xs"
                      onClick={() => handleAnalyzeFit(job)}
                    >
                      <Target className="w-3.5 h-3.5 mr-1" /> Analyze Fit
                    </Button>
                    {job.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          window.open(job.url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Find & Apply
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
