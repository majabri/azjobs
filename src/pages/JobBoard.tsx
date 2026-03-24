import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft, Search, MapPin, Building2, ExternalLink, Target, Briefcase,
  Globe, Plus, X, AlertTriangle, TrendingUp, Zap, Clock, Loader2,
  Shield, DollarSign, Trash2, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";

interface ScrapedJob {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string | null;
  salary: string | null;
  job_url: string | null;
  source: string;
  seniority: string | null;
  job_type: string | null;
  is_remote: boolean;
  quality_score: number;
  is_flagged: boolean;
  flag_reasons: string[];
  first_seen_at: string;
  last_seen_at: string;
}

interface ScrapingTarget {
  id: string;
  url: string;
  name: string;
  target_type: string;
  is_active: boolean;
  last_scraped_at: string | null;
}

function getJobAge(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function getResponseProbability(job: ScrapedJob): number {
  let prob = 60;
  const age = getJobAge(job.first_seen_at);
  if (age < 3) prob += 20;
  else if (age < 7) prob += 10;
  else if (age > 30) prob -= 25;
  else if (age > 14) prob -= 10;
  if (job.is_flagged) prob -= 15;
  if (job.quality_score < 50) prob -= 10;
  if (job.salary) prob += 5;
  return Math.max(5, Math.min(95, prob));
}

function getSmartTags(job: ScrapedJob): { label: string; color: string; icon: typeof Zap }[] {
  const tags: { label: string; color: string; icon: typeof Zap }[] = [];
  const age = getJobAge(job.first_seen_at);
  const prob = getResponseProbability(job);

  if (prob >= 70) tags.push({ label: "High Chance", color: "text-success border-success/30", icon: TrendingUp });
  if (age < 3) tags.push({ label: "Apply Fast", color: "text-warning border-warning/30", icon: Zap });
  if (prob < 30) tags.push({ label: "Low ROI", color: "text-destructive border-destructive/30", icon: AlertTriangle });
  if (job.is_flagged) tags.push({ label: "Low Confidence", color: "text-destructive border-destructive/30", icon: Shield });
  return tags;
}

export default function JobBoard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ScrapedJob[]>([]);
  const [targets, setTargets] = useState<ScrapingTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRemote, setFilterRemote] = useState<boolean | null>(null);
  const [filterSeniority, setFilterSeniority] = useState("");
  const [showTargets, setShowTargets] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const [jobsRes, targetsRes] = await Promise.all([
      supabase.from("scraped_jobs").select("*").order("last_seen_at", { ascending: false }).limit(200),
      supabase.from("scraping_targets").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
    ]);

    if (jobsRes.data) setJobs(jobsRes.data as any[]);
    if (targetsRes.data) setTargets(targetsRes.data as any[]);
    setLoading(false);
  };

  const addTarget = async () => {
    if (!newUrl.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("scraping_targets").insert({
      user_id: session.user.id,
      url: newUrl.trim(),
      name: newName.trim() || new URL(newUrl.trim().startsWith("http") ? newUrl.trim() : `https://${newUrl.trim()}`).hostname,
      target_type: "career_page",
    });

    if (error) { toast.error("Failed to add target"); return; }
    setNewUrl("");
    setNewName("");
    toast.success("Target added!");
    loadData();
  };

  const removeTarget = async (id: string) => {
    await supabase.from("scraping_targets").delete().eq("id", id);
    setTargets(targets.filter(t => t.id !== id));
    toast.success("Target removed");
  };

  const scrapeTarget = async (target: ScrapingTarget) => {
    setScraping(target.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-jobs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ url: target.url, targetType: target.target_type }),
        }
      );

      const data = await resp.json();
      if (!resp.ok) { toast.error(data.error || "Scraping failed"); return; }
      toast.success(`Found ${data.jobs_found} jobs, stored ${data.jobs_stored} new listings`);
      loadData();
    } catch {
      toast.error("Scraping failed");
    } finally {
      setScraping(null);
    }
  };

  const scrapeAll = async () => {
    const activeTargets = targets.filter(t => t.is_active);
    if (!activeTargets.length) { toast.error("No active targets"); return; }
    for (const t of activeTargets) {
      await scrapeTarget(t);
    }
  };

  const handleAnalyzeFit = (job: ScrapedJob) => {
    const jobDesc = `${job.title} at ${job.company}\nLocation: ${job.location || "Not specified"}\nType: ${job.job_type || "Not specified"}\n\n${job.description}`;
    navigate("/job-seeker", { state: { prefillJob: jobDesc } });
  };

  const filtered = jobs.filter(j => {
    if (filterSearch && !j.title.toLowerCase().includes(filterSearch.toLowerCase()) && !j.company.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    if (filterRemote === true && !j.is_remote) return false;
    if (filterRemote === false && j.is_remote) return false;
    if (filterSeniority && j.seniority !== filterSeniority) return false;
    return true;
  });

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
                <Globe className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-bold text-primary">Job Board</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTargets(!showTargets)}>
              {showTargets ? "View Jobs" : "Manage Sources"}
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {showTargets ? (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-primary mb-2">Scraping Sources</h2>
              <p className="text-muted-foreground">Add company career pages or ATS boards to scrape for jobs.</p>
            </div>

            <Card className="p-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Company name" className="sm:w-48" />
                <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://company.com/careers" className="flex-1"
                  onKeyDown={e => e.key === "Enter" && addTarget()} />
                <Button onClick={addTarget} className="gradient-teal text-white"><Plus className="w-4 h-4 mr-1" /> Add</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Supports: Greenhouse, Lever, company career pages, and any public job listings page.</p>
            </Card>

            {targets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-primary">Your Sources ({targets.length})</h3>
                  <Button size="sm" onClick={scrapeAll} disabled={!!scraping} className="gradient-teal text-white">
                    <RefreshCw className={`w-4 h-4 mr-1 ${scraping ? "animate-spin" : ""}`} /> Scrape All
                  </Button>
                </div>
                {targets.map(t => (
                  <Card key={t.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-md">{t.url}</p>
                      {t.last_scraped_at && (
                        <p className="text-xs text-muted-foreground mt-1">Last scraped: {new Date(t.last_scraped_at).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => scrapeTarget(t)} disabled={scraping === t.id}>
                        {scraping === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeTarget(t.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-bold text-primary mb-2">
                Scraped <span className="text-gradient-teal">Job Listings</span>
              </h1>
              <p className="text-muted-foreground">Real jobs scraped from company career pages with quality scores and response probability.</p>
            </div>

            {/* Filters */}
            <Card className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-semibold text-foreground mb-1 block">Search</label>
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Job title or company..." />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Remote</label>
                  <div className="flex gap-1">
                    {[null, true, false].map(v => (
                      <Badge key={String(v)} variant={filterRemote === v ? "default" : "outline"}
                        className={`cursor-pointer text-xs ${filterRemote === v ? "bg-primary text-primary-foreground" : ""}`}
                        onClick={() => setFilterRemote(v)}>
                        {v === null ? "All" : v ? "Remote" : "On-site"}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Seniority</label>
                  <div className="flex gap-1 flex-wrap">
                    {["", "entry", "mid", "senior", "lead", "director"].map(s => (
                      <Badge key={s} variant={filterSeniority === s ? "default" : "outline"}
                        className={`cursor-pointer text-xs capitalize ${filterSeniority === s ? "bg-primary text-primary-foreground" : ""}`}
                        onClick={() => setFilterSeniority(s)}>
                        {s || "All"}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {loading ? (
              <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg mb-2">{jobs.length === 0 ? "No jobs scraped yet" : "No jobs match your filters"}</p>
                {jobs.length === 0 && (
                  <Button variant="outline" onClick={() => setShowTargets(true)}>Add Sources to Start Scraping</Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{filtered.length} jobs</p>
                {filtered.map(job => {
                  const prob = getResponseProbability(job);
                  const tags = getSmartTags(job);
                  const age = getJobAge(job.first_seen_at);

                  return (
                    <Card key={job.id} className={`p-5 hover:border-accent/50 transition-colors ${job.is_flagged ? "border-destructive/30" : ""}`}>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground text-lg">{job.title}</h3>
                              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {job.company}</span>
                                {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>}
                                {job.job_type && <Badge variant="outline" className="capitalize text-xs"><Briefcase className="w-3 h-3 mr-1" /> {job.job_type}</Badge>}
                                {job.is_remote && <Badge variant="outline" className="text-xs text-accent border-accent/30">Remote</Badge>}
                                {job.salary && <span className="flex items-center gap-1 text-accent"><DollarSign className="w-3.5 h-3.5" /> {job.salary}</span>}
                              </div>
                            </div>
                            {/* Response probability */}
                            <div className={`flex-shrink-0 text-center px-3 py-1.5 rounded-lg border ${
                              prob >= 60 ? "border-success/30 bg-success/5" : prob >= 35 ? "border-warning/30 bg-warning/5" : "border-destructive/30 bg-destructive/5"
                            }`}>
                              <p className={`text-lg font-bold ${prob >= 60 ? "text-success" : prob >= 35 ? "text-warning" : "text-destructive"}`}>{prob}%</p>
                              <p className="text-[10px] text-muted-foreground">Response</p>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{job.description}</p>

                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            {tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className={`text-xs ${tag.color}`}>
                                <tag.icon className="w-3 h-3 mr-1" /> {tag.label}
                              </Badge>
                            ))}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {age === 0 ? "Today" : `${age}d ago`}
                            </span>
                            {job.seniority && <Badge variant="secondary" className="text-xs capitalize">{job.seniority}</Badge>}
                          </div>
                        </div>

                        <div className="flex sm:flex-col gap-2 flex-shrink-0">
                          <Button size="sm" className="gradient-teal text-white text-xs" onClick={() => handleAnalyzeFit(job)}>
                            <Target className="w-3.5 h-3.5 mr-1" /> Check Fit
                          </Button>
                          {job.job_url && (
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => window.open(job.job_url!, "_blank")}>
                              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Apply
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
