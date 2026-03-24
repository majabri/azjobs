import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft, Search, Loader2, MapPin, Building2, ExternalLink, Target,
  Briefcase, Globe, Plus, X, DollarSign, AlertTriangle, TrendingUp,
  Zap, Shield, Clock, Database, Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";

interface JobResult {
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  url: string;
  matchReason: string;
  // Scraped job extras
  id?: string;
  quality_score?: number;
  is_flagged?: boolean;
  flag_reasons?: string[];
  salary?: string;
  seniority?: string;
  is_remote?: boolean;
  source?: string;
  first_seen_at?: string;
  responseProbability?: number;
  smartTag?: string;
  decisionScore?: number;
  effortEstimate?: number;
}

const JOB_TYPE_OPTIONS = [
  "remote", "hybrid", "in-office", "full-time", "part-time", "contract", "short-term",
];

function calculateResponseProbability(job: JobResult, userSkills: string[]): number {
  let prob = 50;
  // Quality score factor
  if (job.quality_score !== undefined) {
    prob += (job.quality_score - 50) * 0.3;
  }
  // Job age factor
  if (job.first_seen_at) {
    const days = (Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 3) prob += 15;
    else if (days < 7) prob += 8;
    else if (days > 30) prob -= 20;
    else if (days > 14) prob -= 10;
  }
  // Skills match factor
  if (userSkills.length > 0 && job.description) {
    const desc = job.description.toLowerCase();
    const matched = userSkills.filter(s => desc.includes(s.toLowerCase())).length;
    const ratio = matched / userSkills.length;
    prob += ratio * 20;
  }
  // Remote jobs tend to have more competition
  if (job.is_remote) prob -= 5;
  return Math.max(5, Math.min(95, Math.round(prob)));
}

function getSmartTag(job: JobResult, prob: number): { label: string; color: string; icon: any } {
  if (job.is_flagged) return { label: "Low Confidence", color: "text-destructive border-destructive/30", icon: AlertTriangle };
  // Low ROI: high effort + low probability
  if ((job.effortEstimate || 0) > 70 && prob < 40) return { label: "Low ROI", color: "text-destructive/70 border-destructive/20", icon: AlertTriangle };
  if (prob >= 70) return { label: "High Chance", color: "text-green-600 border-green-300 dark:text-green-400", icon: TrendingUp };
  if (prob >= 50 && job.first_seen_at) {
    const days = (Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 3) return { label: "Apply Fast", color: "text-orange-600 border-orange-300 dark:text-orange-400", icon: Zap };
  }
  if (prob < 35) return { label: "Improve Resume First", color: "text-amber-600 border-amber-300 dark:text-amber-400", icon: Shield };
  return { label: "Worth Applying", color: "text-primary border-primary/30", icon: Target };
}

function calculateDecisionScore(job: JobResult, prob: number, userSkills: string[]): { score: number; effort: number } {
  // Effort = % of skills NOT matched (higher = more effort needed)
  let effort = 50;
  if (userSkills.length > 0 && job.description) {
    const desc = job.description.toLowerCase();
    const matched = userSkills.filter(s => desc.includes(s.toLowerCase())).length;
    effort = Math.round((1 - matched / Math.max(userSkills.length, 1)) * 100);
  }
  // Decision Score = fit(40%) + probability(30%) + ease(30%)
  const fitScore = job.quality_score || 50;
  const ease = 100 - effort;
  const score = Math.round(fitScore * 0.4 + prob * 0.3 + ease * 0.3);
  return { score: Math.max(5, Math.min(99, score)), effort };
}

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
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [citations, setCitations] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [searchSource, setSearchSource] = useState<"all" | "ai" | "database">("all");
  const [sortBy, setSortBy] = useState<"relevance" | "probability" | "newest">("relevance");
  const [showFlagged, setShowFlagged] = useState(true);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("job_seeker_profiles")
        .select("skills, preferred_job_types, location, career_level, target_job_titles, salary_min, salary_max")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) {
        if (data.skills) setSkills(data.skills as string[]);
        if (data.preferred_job_types) setJobTypes(data.preferred_job_types as string[]);
        if (data.location) setLocation(data.location);
        if (data.career_level) setCareerLevel(data.career_level);
        if (data.target_job_titles) setTargetTitles(data.target_job_titles as string[]);
        if (data.salary_min) setSalaryMin(data.salary_min);
        if (data.salary_max) setSalaryMax(data.salary_max);
        setProfileLoaded(true);
      }
    } catch (e) { console.error(e); }
  };

  const toggleJobType = (type: string) => {
    setJobTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const searchDatabaseJobs = async (): Promise<JobResult[]> => {
    let query = supabase.from("scraped_jobs").select("*");

    // Filter by title keywords
    if (targetTitles.length > 0) {
      const titleFilter = targetTitles.map(t => `title.ilike.%${t}%`).join(",");
      query = query.or(titleFilter);
    }

    // Filter by location
    if (location) {
      const isRemoteSearch = /remote/i.test(location);
      if (isRemoteSearch) {
        query = query.eq("is_remote", true);
      } else {
        query = query.ilike("location", `%${location}%`);
      }
    }

    // Filter by job type
    if (jobTypes.length > 0) {
      if (jobTypes.includes("remote")) {
        query = query.eq("is_remote", true);
      }
      const nonRemoteTypes = jobTypes.filter(t => t !== "remote" && t !== "hybrid" && t !== "in-office");
      if (nonRemoteTypes.length > 0) {
        query = query.in("job_type", nonRemoteTypes);
      }
    }

    query = query.order("created_at", { ascending: false }).limit(50);

    const { data, error } = await query;
    if (error) { console.error("DB search error:", error); return []; }

    return (data || []).map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location || (job.is_remote ? "Remote" : "Not specified"),
      type: job.job_type || "full-time",
      description: job.description || "",
      url: job.job_url || "",
      matchReason: `Source: ${job.source}${job.seniority ? ` • ${job.seniority} level` : ""}`,
      quality_score: job.quality_score,
      is_flagged: job.is_flagged,
      flag_reasons: job.flag_reasons || [],
      salary: job.salary,
      seniority: job.seniority,
      is_remote: job.is_remote,
      source: job.source,
      first_seen_at: job.first_seen_at,
    }));
  };

  const searchAIJobs = async (): Promise<{ jobs: JobResult[]; citations: string[] }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { jobs: [], citations: [] };

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ skills, jobTypes, location, query: customQuery, careerLevel, targetTitles }),
      }
    );
    if (!resp.ok) return { jobs: [], citations: [] };
    const data = await resp.json();
    return { jobs: data.jobs || [], citations: data.citations || [] };
  };

  const handleSearch = async () => {
    if (!skills.length && !customQuery.trim() && !targetTitles.length) {
      toast.error("Add skills, titles, or a search query");
      return;
    }
    setSearching(true);
    setJobs([]);
    setCitations([]);

    try {
      let allJobs: JobResult[] = [];
      let allCitations: string[] = [];

      if (searchSource === "all" || searchSource === "database") {
        const dbJobs = await searchDatabaseJobs();
        allJobs = allJobs.concat(dbJobs);
      }

      if (searchSource === "all" || searchSource === "ai") {
        const aiResult = await searchAIJobs();
        allJobs = allJobs.concat(aiResult.jobs);
        allCitations = aiResult.citations;
      }

      // Enrich with probability, decision score & tags
      allJobs = allJobs.map(job => {
        const prob = calculateResponseProbability(job, skills);
        const { score: decScore, effort } = calculateDecisionScore(job, prob, skills);
        const enriched = { ...job, responseProbability: prob, decisionScore: decScore, effortEstimate: effort };
        const tag = getSmartTag(enriched, prob);
        return { ...enriched, smartTag: tag.label };
      });

      // Sort
      if (sortBy === "probability") {
        allJobs.sort((a, b) => (b.responseProbability || 0) - (a.responseProbability || 0));
      } else if (sortBy === "newest") {
        allJobs.sort((a, b) => {
          if (!a.first_seen_at && !b.first_seen_at) return 0;
          if (!a.first_seen_at) return 1;
          if (!b.first_seen_at) return -1;
          return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
        });
      }

      // Filter flagged
      if (!showFlagged) {
        allJobs = allJobs.filter(j => !j.is_flagged);
      }

      setJobs(allJobs);
      setCitations(allCitations);
      if (!allJobs.length) toast.info("No jobs found. Try adjusting your criteria.");
    } catch {
      toast.error("Failed to search for jobs");
    } finally {
      setSearching(false);
    }
  };

  const handleAnalyzeFit = (job: JobResult) => {
    const jobDesc = `${job.title} at ${job.company}\nLocation: ${job.location}\nType: ${job.type}${job.salary ? `\nSalary: ${job.salary}` : ""}\n\n${job.description}`;
    navigate("/job-seeker", { state: { prefillJob: jobDesc } });
  };

  const getProbColor = (prob: number) => {
    if (prob >= 70) return "text-green-600 dark:text-green-400";
    if (prob >= 50) return "text-amber-600 dark:text-amber-400";
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
                <Globe className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-bold text-primary">Job Search</span>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
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

            {careerLevel && (
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Career Level</label>
                <Badge variant="default" className="bg-accent text-accent-foreground">{careerLevel}</Badge>
              </div>
            )}

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
                  <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, State or Remote" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Additional Criteria</label>
                <Input value={customQuery} onChange={e => setCustomQuery(e.target.value)} placeholder="e.g. startup, Fortune 500..." />
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
                    // Re-sort
                    setJobs(prev => {
                      const sorted = [...prev];
                      if (e.target.value === "probability") sorted.sort((a, b) => (b.responseProbability || 0) - (a.responseProbability || 0));
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
                  <option value="relevance">Relevance</option>
                  <option value="probability">Response Probability</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showFlagged} onChange={e => {
                  setShowFlagged(e.target.checked);
                }} className="rounded" />
                Show flagged
              </label>
            </div>
          </div>
        )}

        {/* Job Cards */}
        <div className="space-y-4">
          {jobs.filter(j => showFlagged || !j.is_flagged).map((job, i) => {
            const prob = job.responseProbability || 0;
            const tag = getSmartTag(job, prob);
            const TagIcon = tag.icon;

            return (
              <Card key={job.id || i} className={`p-5 transition-colors ${job.is_flagged ? "border-destructive/30 bg-destructive/5" : "hover:border-accent/50"}`}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-lg">{job.title}</h3>
                      {job.is_flagged && <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-1" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {job.company}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
                      {job.type && <Badge variant="outline" className="capitalize text-xs"><Briefcase className="w-3 h-3 mr-1" /> {job.type}</Badge>}
                      {job.salary && <Badge variant="outline" className="text-xs"><DollarSign className="w-3 h-3 mr-1" /> {job.salary}</Badge>}
                      {job.source && <Badge variant="outline" className="text-xs capitalize">{job.source}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-3">{job.description}</p>

                    {/* Smart Tags & Probability */}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <Badge variant="outline" className={`text-xs ${tag.color}`}>
                        <TagIcon className="w-3 h-3 mr-1" /> {tag.label}
                      </Badge>
                      <span className={`text-sm font-semibold ${getProbColor(prob)}`}>
                        {prob}% response probability
                      </span>
                      {job.quality_score !== undefined && job.quality_score < 60 && (
                        <span className="text-xs text-muted-foreground">Quality: {job.quality_score}/100</span>
                      )}
                      {job.first_seen_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.round((Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                        </span>
                      )}
                    </div>

                    {job.is_flagged && job.flag_reasons && (job.flag_reasons as string[]).length > 0 && (
                      <div className="mt-2 text-xs text-destructive">
                        ⚠️ {(job.flag_reasons as string[]).join(" • ")}
                      </div>
                    )}

                    {job.matchReason && !job.is_flagged && (
                      <p className="text-xs text-accent mt-2 italic">💡 {job.matchReason}</p>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2 flex-shrink-0">
                    <Button size="sm" className="gradient-teal text-white text-xs" onClick={() => handleAnalyzeFit(job)}>
                      <Target className="w-3.5 h-3.5 mr-1" /> Check My Chances
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
        </div>

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
      </main>
    </div>
  );
}
