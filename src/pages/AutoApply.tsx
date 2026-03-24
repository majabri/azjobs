import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Bot, Settings, Play, Pause, CheckCircle2, Loader2,
  Briefcase, MapPin, DollarSign, FileText, Eye, Download, Copy,
  RefreshCw, Shield, Sparkles, Target, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Package, Mail
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import { analyzeJobFit } from "@/lib/analysisEngine";

interface AutoApplyPrefs {
  jobTitles: string[];
  salaryMin: string;
  salaryMax: string;
  locations: string[];
  remoteOnly: boolean;
  autoGenerate: boolean;
  requireReview: boolean;
  minMatchScore: number;
}

interface QueuedApplication {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  matchScore: number;
  status: "pending_review" | "approved" | "skipped" | "generating" | "ready";
  resume?: string;
  coverLetter?: string;
  jobDescription?: string;
}

const defaultPrefs: AutoApplyPrefs = {
  jobTitles: [],
  salaryMin: "",
  salaryMax: "",
  locations: [],
  remoteOnly: false,
  autoGenerate: true,
  requireReview: true,
  minMatchScore: 60,
};

export default function AutoApplyPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<AutoApplyPrefs>(defaultPrefs);
  const [titleInput, setTitleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [queue, setQueue] = useState<QueuedApplication[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Load prefs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("fitcheck_autoapply_prefs");
    if (saved) {
      try { setPrefs(JSON.parse(saved)); } catch {}
    }
    const savedQueue = localStorage.getItem("fitcheck_autoapply_queue");
    if (savedQueue) {
      try { setQueue(JSON.parse(savedQueue)); } catch {}
    }
  }, []);

  const savePrefs = (p: AutoApplyPrefs) => {
    setPrefs(p);
    localStorage.setItem("fitcheck_autoapply_prefs", JSON.stringify(p));
  };

  const saveQueue = (q: QueuedApplication[]) => {
    setQueue(q);
    localStorage.setItem("fitcheck_autoapply_queue", JSON.stringify(q));
  };

  const addTitle = () => {
    const t = titleInput.trim();
    if (t && !prefs.jobTitles.includes(t)) {
      savePrefs({ ...prefs, jobTitles: [...prefs.jobTitles, t] });
      setTitleInput("");
    }
  };

  const addLocation = () => {
    const l = locationInput.trim();
    if (l && !prefs.locations.includes(l)) {
      savePrefs({ ...prefs, locations: [...prefs.locations, l] });
      setLocationInput("");
    }
  };

  const runAutoSearch = async () => {
    if (!prefs.jobTitles.length) {
      toast.error("Add at least one target job title");
      return;
    }
    setIsSearching(true);
    setIsRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const { data: profile } = await supabase
        .from("job_seeker_profiles")
        .select("skills, preferred_job_types, location, career_level, summary")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            skills: (profile?.skills as string[]) || [],
            jobTypes: (profile as any)?.preferred_job_types || [],
            location: prefs.locations.join(", ") || (profile?.location as string) || "",
            careerLevel: (profile as any)?.career_level || "",
            targetTitles: prefs.jobTitles,
            query: prefs.remoteOnly ? "remote positions only" : "",
          }),
        }
      );

      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      const jobs = (data.jobs || []) as any[];

      // Load resume for scoring
      const { data: versions } = await supabase
        .from("resume_versions" as any)
        .select("resume_text")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1) as any;

      const resumeText = versions?.[0]?.resume_text || "";

      const newQueue: QueuedApplication[] = jobs
        .map((job: any) => {
          const jobDesc = `${job.title} at ${job.company}\n${job.description}`;
          const analysis = resumeText ? analyzeJobFit(jobDesc, resumeText) : null;
          const score = analysis?.overallScore || 50;
          return {
            id: crypto.randomUUID(),
            jobTitle: job.title,
            company: job.company,
            location: job.location,
            matchScore: score,
            status: score >= prefs.minMatchScore ? "pending_review" as const : "skipped" as const,
            jobDescription: jobDesc,
          };
        })
        .sort((a: QueuedApplication, b: QueuedApplication) => b.matchScore - a.matchScore);

      saveQueue([...newQueue, ...queue]);
      toast.success(`Found ${newQueue.filter(j => j.status === "pending_review").length} jobs above ${prefs.minMatchScore}% threshold`);
    } catch {
      toast.error("Auto-search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const generatePackage = async (item: QueuedApplication) => {
    setGeneratingId(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get resume
      const { data: versions } = await supabase
        .from("resume_versions" as any)
        .select("resume_text")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1) as any;

      const resumeText = versions?.[0]?.resume_text || "";
      if (!resumeText) {
        toast.error("No resume found. Save one in your profile first.");
        return;
      }

      const analysis = analyzeJobFit(item.jobDescription || "", resumeText);

      // Generate resume
      const resumeResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rewrite-resume`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            resume: resumeText,
            jobDescription: item.jobDescription,
            matchedSkills: analysis.matchedSkills.filter(s => s.matched).map(s => s.skill),
            gaps: analysis.gaps.map(g => g.area),
          }),
        }
      );

      let optimizedResume = "";
      if (resumeResp.ok) {
        const reader = resumeResp.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  optimizedResume += parsed.choices?.[0]?.delta?.content || "";
                } catch {}
              }
            }
          }
        }
      }

      // Generate cover letter
      const coverResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover-letter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            resume: resumeText,
            jobDescription: item.jobDescription,
            matchedSkills: analysis.matchedSkills.filter(s => s.matched).map(s => s.skill),
            gaps: analysis.gaps.map(g => g.area),
            tone: "professional",
          }),
        }
      );

      let coverLetter = "";
      if (coverResp.ok) {
        const reader = coverResp.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  coverLetter += parsed.choices?.[0]?.delta?.content || "";
                } catch {}
              }
            }
          }
        }
      }

      const updated = queue.map(q =>
        q.id === item.id ? { ...q, resume: optimizedResume, coverLetter, status: "ready" as const } : q
      );
      saveQueue(updated);
      toast.success(`Application package ready for ${item.company}!`);
    } catch {
      toast.error("Failed to generate package");
    } finally {
      setGeneratingId(null);
    }
  };

  const approveAndTrack = async (item: QueuedApplication) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from("job_applications").insert({
        user_id: session.user.id,
        job_title: item.jobTitle,
        company: item.company,
        status: "applied",
        notes: `Auto-generated via Auto-Apply Agent. Match score: ${item.matchScore}%`,
      } as any);

      const updated = queue.map(q =>
        q.id === item.id ? { ...q, status: "approved" as const } : q
      );
      saveQueue(updated);
      toast.success(`${item.jobTitle} at ${item.company} added to tracker!`);
    } catch {
      toast.error("Failed to track application");
    }
  };

  const skipJob = (id: string) => {
    const updated = queue.map(q => q.id === id ? { ...q, status: "skipped" as const } : q);
    saveQueue(updated);
  };

  const clearQueue = () => {
    saveQueue([]);
    toast.success("Queue cleared");
  };

  const pendingCount = queue.filter(q => q.status === "pending_review").length;
  const readyCount = queue.filter(q => q.status === "ready").length;

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
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-bold text-primary">Auto-Apply Agent</span>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Status Banner */}
        <Card className="p-4 flex items-center justify-between bg-accent/5 border-accent/20">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-accent" />
            <div>
              <p className="text-sm font-semibold text-foreground">Review Before Apply Mode</p>
              <p className="text-xs text-muted-foreground">You approve every application before materials are generated. Full control, zero surprises.</p>
            </div>
          </div>
          <Badge className="bg-accent/15 text-accent border-accent/30">
            {pendingCount} pending · {readyCount} ready
          </Badge>
        </Card>

        {/* Preferences */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-primary text-lg">Job Preferences</h2>
          </div>

          <div className="space-y-4">
            {/* Job Titles */}
            <div>
              <Label className="text-sm font-semibold">Target Job Titles</Label>
              <div className="flex gap-2 mt-1">
                <Input value={titleInput} onChange={e => setTitleInput(e.target.value)} placeholder="e.g. Security Engineer" onKeyDown={e => e.key === "Enter" && addTitle()} />
                <Button variant="outline" size="sm" onClick={addTitle}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {prefs.jobTitles.map((t, i) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => savePrefs({ ...prefs, jobTitles: prefs.jobTitles.filter((_, idx) => idx !== i) })}>
                    {t} ×
                  </Badge>
                ))}
              </div>
            </div>

            {/* Salary Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold">Min Salary</Label>
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={prefs.salaryMin} onChange={e => savePrefs({ ...prefs, salaryMin: e.target.value })} placeholder="80,000" />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Max Salary</Label>
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={prefs.salaryMax} onChange={e => savePrefs({ ...prefs, salaryMax: e.target.value })} placeholder="150,000" />
                </div>
              </div>
            </div>

            {/* Locations */}
            <div>
              <Label className="text-sm font-semibold">Preferred Locations</Label>
              <div className="flex gap-2 mt-1">
                <Input value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder="e.g. Washington DC" onKeyDown={e => e.key === "Enter" && addLocation()} />
                <Button variant="outline" size="sm" onClick={addLocation}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {prefs.locations.map((l, i) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => savePrefs({ ...prefs, locations: prefs.locations.filter((_, idx) => idx !== i) })}>
                    <MapPin className="w-3 h-3 mr-1" />{l} ×
                  </Badge>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={prefs.remoteOnly} onCheckedChange={v => savePrefs({ ...prefs, remoteOnly: v })} />
                <Label className="text-sm">Remote Only</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={prefs.requireReview} onCheckedChange={v => savePrefs({ ...prefs, requireReview: v })} />
                <Label className="text-sm">Require Review Before Apply</Label>
              </div>
            </div>

            {/* Min Score */}
            <div>
              <Label className="text-sm font-semibold">Minimum Match Score: {prefs.minMatchScore}%</Label>
              <input
                type="range"
                min={30}
                max={90}
                value={prefs.minMatchScore}
                onChange={e => savePrefs({ ...prefs, minMatchScore: parseInt(e.target.value) })}
                className="w-full mt-1 accent-[hsl(var(--accent))]"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More Jobs (30%)</span>
                <span>Higher Quality (90%)</span>
              </div>
            </div>
          </div>

          {/* Run Button */}
          <div className="mt-6 flex items-center gap-3">
            <Button
              className="gradient-teal text-white shadow-teal hover:opacity-90"
              disabled={isSearching}
              onClick={runAutoSearch}
            >
              {isSearching ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Find & Queue Jobs</>
              )}
            </Button>
            {queue.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearQueue}>
                Clear Queue
              </Button>
            )}
          </div>
        </Card>

        {/* Application Queue */}
        {queue.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-primary text-xl">Application Queue</h2>
              <p className="text-sm text-muted-foreground">{queue.length} jobs queued</p>
            </div>

            <div className="space-y-3">
              {queue.map(item => {
                const isExpanded = expandedId === item.id;
                const isGenerating = generatingId === item.id;

                return (
                  <Card key={item.id} className={`overflow-hidden transition-all ${
                    item.status === "skipped" ? "opacity-50" :
                    item.status === "approved" ? "border-success/30" :
                    item.status === "ready" ? "border-accent/30" : ""
                  }`}>
                    <div className="p-4 flex items-center gap-4">
                      {/* Score */}
                      <div className="flex-shrink-0 text-center">
                        <div className={`text-xl font-display font-bold ${
                          item.matchScore >= 70 ? "text-success" :
                          item.matchScore >= 50 ? "text-warning" : "text-destructive"
                        }`}>{item.matchScore}%</div>
                        <div className="text-[10px] text-muted-foreground">match</div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{item.jobTitle}</h3>
                        <p className="text-sm text-muted-foreground">{item.company} · {item.location}</p>
                      </div>

                      {/* Status */}
                      <Badge variant="outline" className={`text-xs ${
                        item.status === "ready" ? "border-accent/30 text-accent" :
                        item.status === "approved" ? "border-success/30 text-success" :
                        item.status === "skipped" ? "border-muted text-muted-foreground" :
                        "border-warning/30 text-warning"
                      }`}>
                        {item.status === "pending_review" ? "Pending Review" :
                         item.status === "ready" ? "Package Ready" :
                         item.status === "approved" ? "Tracked" :
                         "Skipped"}
                      </Badge>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {item.status === "pending_review" && (
                          <>
                            <Button size="sm" className="text-xs gradient-teal text-white" onClick={() => generatePackage(item)} disabled={isGenerating}>
                              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3 mr-1" />}
                              Generate
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => skipJob(item.id)}>
                              Skip
                            </Button>
                          </>
                        )}
                        {item.status === "ready" && (
                          <>
                            <Button size="sm" className="text-xs" onClick={() => approveAndTrack(item)}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Track
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded Package */}
                    {isExpanded && item.status === "ready" && (
                      <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                        {item.resume && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-primary flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5" /> Tailored Resume
                              </h4>
                              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { navigator.clipboard.writeText(item.resume!); toast.success("Copied!"); }}>
                                <Copy className="w-3 h-3 mr-1" /> Copy
                              </Button>
                            </div>
                            <pre className="text-xs whitespace-pre-wrap font-mono bg-card p-3 rounded-lg border border-border max-h-48 overflow-y-auto">{item.resume}</pre>
                          </div>
                        )}
                        {item.coverLetter && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-primary flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" /> Cover Letter
                              </h4>
                              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { navigator.clipboard.writeText(item.coverLetter!); toast.success("Copied!"); }}>
                                <Copy className="w-3 h-3 mr-1" /> Copy
                              </Button>
                            </div>
                            <pre className="text-xs whitespace-pre-wrap font-mono bg-card p-3 rounded-lg border border-border max-h-48 overflow-y-auto">{item.coverLetter}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Transparency Section */}
        <Card className="p-5 border-dashed border-2 border-muted">
          <h3 className="font-display font-bold text-primary mb-3 flex items-center gap-2">
            <Eye className="w-5 h-5" /> How the Agent Works
          </h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <span className="text-accent font-bold">1.</span>
              <span>Searches for jobs matching your titles, location, and skills</span>
            </div>
            <div className="flex gap-2">
              <span className="text-accent font-bold">2.</span>
              <span>Scores each job against your resume using the fit engine</span>
            </div>
            <div className="flex gap-2">
              <span className="text-accent font-bold">3.</span>
              <span>Filters out jobs below your minimum match threshold</span>
            </div>
            <div className="flex gap-2">
              <span className="text-accent font-bold">4.</span>
              <span>Generates tailored resume + cover letter for approved jobs</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <Shield className="w-3 h-3" /> You review and approve every action. Nothing is submitted without your consent.
          </p>
        </Card>
      </main>
    </div>
  );
}
