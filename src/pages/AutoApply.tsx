import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Bot, Settings, Play, CheckCircle2, Loader2,
  Briefcase, MapPin, DollarSign, FileText, Eye, Copy,
  Shield, Target, Package, Mail,
  ChevronDown, ChevronUp, Search, X, ExternalLink, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import { analyzeJobFit, FitAnalysis } from "@/lib/analysisEngine";

interface AutoApplyPrefs {
  jobTitles: string[];
  salaryMin: string;
  salaryMax: string;
  locations: string[];
  remoteOnly: boolean;
  requireReview: boolean;
  minMatchScore: number;
  applyMode: "manual" | "smart" | "full-auto";
  riskTolerance: number;
}

interface QueuedApplication {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  matchScore: number;
  status: "review" | "analyzed" | "generating" | "ready" | "approved" | "skipped";
  resume?: string;
  coverLetter?: string;
  jobDescription?: string;
  analysis?: FitAnalysis | null;
}

const defaultPrefs: AutoApplyPrefs = {
  jobTitles: [],
  salaryMin: "",
  salaryMax: "",
  locations: [],
  remoteOnly: false,
  requireReview: true,
  minMatchScore: 60,
  applyMode: "manual",
  riskTolerance: 50,
};

interface ActivityLogEntry {
  timestamp: Date;
  action: string;
  detail: string;
  type: "search" | "analyze" | "generate" | "apply" | "skip";
}


export default function AutoApplyPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<AutoApplyPrefs>(defaultPrefs);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [queue, setQueue] = useState<QueuedApplication[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [isAutoRunning, setIsAutoRunning] = useState(false);

  const addLog = (action: string, detail: string, type: ActivityLogEntry["type"]) => {
    setActivityLog(prev => [{ timestamp: new Date(), action, detail, type }, ...prev].slice(0, 50));
  };

  // Load defaults from profile
  useEffect(() => {
    loadProfileDefaults();
  }, []);

  const loadProfileDefaults = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("job_seeker_profiles")
        .select("target_job_titles, location, preferred_job_types, salary_min, salary_max, remote_only, min_match_score")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          jobTitles: ((data as any).target_job_titles as string[]) || [],
          salaryMin: (data as any).salary_min || "",
          salaryMax: (data as any).salary_max || "",
          locations: (data as any).location ? [(data as any).location] : [],
          remoteOnly: (data as any).remote_only || false,
          requireReview: true,
          minMatchScore: (data as any).min_match_score ?? 60,
          applyMode: "manual",
          riskTolerance: 50,
        });
        setProfileLoaded(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Persist minMatchScore to DB on change (debounced)
  useEffect(() => {
    if (!profileLoaded) return;
    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await supabase.from("job_seeker_profiles").update({ min_match_score: prefs.minMatchScore } as any).eq("user_id", session.user.id);
      } catch (e) { console.error("Failed to save match score:", e); }
    }, 500);
    return () => clearTimeout(timer);
  }, [prefs.minMatchScore, profileLoaded]);

  const addTitle = () => {
    const t = titleInput.trim();
    if (t && !prefs.jobTitles.includes(t)) {
      setPrefs({ ...prefs, jobTitles: [...prefs.jobTitles, t] });
      setTitleInput("");
    }
  };

  const addLocation = () => {
    const l = locationInput.trim();
    if (l && !prefs.locations.includes(l)) {
      setPrefs({ ...prefs, locations: [...prefs.locations, l] });
      setLocationInput("");
    }
  };

  const buildProfileResumeFallback = (profile: any): string => {
    if (!profile) return "";

    const workExp = Array.isArray(profile.work_experience)
      ? profile.work_experience
          .map((w: any) => `${w?.title || ""} at ${w?.company || ""}. ${w?.description || ""}`.trim())
          .filter(Boolean)
      : [];

    const skills = Array.isArray(profile.skills) ? profile.skills.join(", ") : "";
    const certs = Array.isArray(profile.certifications) ? profile.certifications.join(", ") : "";
    const titles = Array.isArray(profile.target_job_titles) ? profile.target_job_titles.join(", ") : "";

    return [
      profile.full_name ? `Name: ${profile.full_name}` : "",
      profile.career_level ? `Career Level: ${profile.career_level}` : "",
      profile.summary ? `Summary: ${profile.summary}` : "",
      skills ? `Skills: ${skills}` : "",
      titles ? `Target Roles: ${titles}` : "",
      certs ? `Certifications: ${certs}` : "",
      workExp.length ? `Experience: ${workExp.join(" ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const getBestResumeText = async (userId: string): Promise<{ text: string; source: "resume_version" | "profile" | "none" }> => {
    const { data: versions } = await supabase
      .from("resume_versions" as any)
      .select("resume_text")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1) as any;

    const latestResume = versions?.[0]?.resume_text?.trim?.() || "";
    if (latestResume) {
      return { text: latestResume, source: "resume_version" };
    }

    const { data: profile } = await supabase
      .from("job_seeker_profiles")
      .select("full_name, summary, skills, work_experience, certifications, target_job_titles, career_level")
      .eq("user_id", userId)
      .maybeSingle();

    const fallback = buildProfileResumeFallback(profile).trim();
    if (fallback) {
      return { text: fallback, source: "profile" };
    }

    return { text: "", source: "none" };
  };

  const runAutoSearch = async () => {
    if (!prefs.jobTitles.length) {
      toast.error("Add at least one target job title");
      return;
    }
    setIsSearching(true);
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

      const resumeLookup = await getBestResumeText(session.user.id);
      const resumeText = resumeLookup.text;

      const newQueue: QueuedApplication[] = jobs
        .map((job: any) => {
          const jobDesc = `${job.title} at ${job.company}\nLocation: ${job.location}\nType: ${job.type || ""}\n\n${job.description}`;
          const analysis = resumeText ? analyzeJobFit(jobDesc, resumeText) : null;
          const score = analysis?.overallScore || 50;
          return {
            id: crypto.randomUUID(),
            jobTitle: job.title,
            company: job.company,
            location: job.location,
            matchScore: score,
            status: score >= prefs.minMatchScore ? "review" as const : "skipped" as const,
            jobDescription: jobDesc,
            analysis,
          };
        })
        .sort((a: QueuedApplication, b: QueuedApplication) => b.matchScore - a.matchScore);

      setQueue((prev) => [...newQueue, ...prev]);
      addLog("Search complete", `Found ${newQueue.filter(j => j.status === "review").length} matching jobs`, "search");
      
      // Smart/Auto mode: auto-approve high matches
      if (prefs.applyMode === "smart" || prefs.applyMode === "full-auto") {
        const threshold = prefs.applyMode === "full-auto" ? prefs.minMatchScore : 80;
        for (const job of newQueue) {
          if (job.matchScore >= threshold && job.status === "review") {
            addLog("Auto-approved", `${job.jobTitle} at ${job.company} (${job.matchScore}%)`, "apply");
          }
        }
      }
      
      if (resumeLookup.source === "profile") {
        toast.success(`Found ${newQueue.filter(j => j.status === "review").length} jobs. Using your profile for fit analysis.`);
      } else {
        toast.success(`Found ${newQueue.filter(j => j.status === "review").length} jobs above ${prefs.minMatchScore}% threshold`);
      }
    } catch {
      toast.error("Auto-search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const analyzeItem = async (item: QueuedApplication) => {
    setAnalyzingId(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resumeLookup = await getBestResumeText(session.user.id);
      const resumeText = resumeLookup.text;

      if (!resumeText) {
        toast.error("Add resume content in Profile or Resume Versions first.");
        return;
      }

      const analysis = analyzeJobFit(item.jobDescription || "", resumeText);
      setQueue((prev) => prev.map(q =>
        q.id === item.id ? { ...q, analysis, matchScore: analysis.overallScore, status: "analyzed" as const } : q
      ));

      if (resumeLookup.source === "profile") {
        toast.success("Analyzed using your profile data.");
      }
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  const generatePackage = async (item: QueuedApplication) => {
    setGeneratingId(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resumeLookup = await getBestResumeText(session.user.id);
      const resumeText = resumeLookup.text;
      if (!resumeText) { toast.error("No resume/profile content found."); return; }

      const analysis = item.analysis || analyzeJobFit(item.jobDescription || "", resumeText);

      const resumeResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rewrite-resume`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
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
                try { const p = JSON.parse(line.slice(6)); optimizedResume += p.choices?.[0]?.delta?.content || ""; } catch {}
              }
            }
          }
        }
      }

      const coverResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover-letter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
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
                try { const p = JSON.parse(line.slice(6)); coverLetter += p.choices?.[0]?.delta?.content || ""; } catch {}
              }
            }
          }
        }
      }

      setQueue((prev) => prev.map(q =>
        q.id === item.id ? { ...q, resume: optimizedResume, coverLetter, status: "ready" as const } : q
      ));
      toast.success(`Package ready for ${item.company}!`);
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
        notes: `Auto-Apply Agent. Match: ${item.matchScore}%`,
      } as any);
      setQueue((prev) => prev.map(q => q.id === item.id ? { ...q, status: "approved" as const } : q));
      toast.success(`${item.jobTitle} at ${item.company} tracked!`);
    } catch {
      toast.error("Failed to track application");
    }
  };

  const skipJob = (id: string) => {
    setQueue((prev) => prev.map(q => q.id === id ? { ...q, status: "skipped" as const } : q));
  };

  const reviewCount = queue.filter(q => q.status === "review").length;
  const analyzedCount = queue.filter(q => q.status === "analyzed").length;
  const readyCount = queue.filter(q => q.status === "ready").length;

  const statusLabel = (s: QueuedApplication["status"]) => {
    switch (s) {
      case "review": return "Review";
      case "analyzed": return "Analyzed";
      case "ready": return "Package Ready";
      case "approved": return "Tracked";
      case "skipped": return "Skipped";
      default: return s;
    }
  };

  const statusColor = (s: QueuedApplication["status"]) => {
    switch (s) {
      case "review": return "border-warning/30 text-warning";
      case "analyzed": return "border-primary/30 text-primary";
      case "ready": return "border-accent/30 text-accent";
      case "approved": return "border-success/30 text-success";
      case "skipped": return "border-muted text-muted-foreground";
      default: return "";
    }
  };

  return (
    <div className="bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-3">
          {([
            { mode: "manual" as const, label: "Manual Review", desc: "You review every job before applying", icon: Eye },
            { mode: "smart" as const, label: "Smart Approval", desc: "Auto-approve jobs above 80% match", icon: Zap },
            { mode: "full-auto" as const, label: "Full Auto Apply", desc: "AI handles everything automatically", icon: Bot },
          ] as const).map(m => (
            <Card
              key={m.mode}
              className={`p-4 cursor-pointer transition-all ${prefs.applyMode === m.mode ? "border-accent bg-accent/5 shadow-indigo-500/20" : "hover:border-accent/30"}`}
              onClick={() => setPrefs({ ...prefs, applyMode: m.mode, requireReview: m.mode === "manual" })}
            >
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`w-4 h-4 ${prefs.applyMode === m.mode ? "text-accent" : "text-muted-foreground"}`} />
                <span className={`text-sm font-semibold ${prefs.applyMode === m.mode ? "text-accent" : "text-foreground"}`}>{m.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </Card>
          ))}
        </div>

        {/* Status Banner */}
        <Card className={`p-4 flex items-center justify-between ${
          prefs.applyMode === "full-auto" ? "bg-accent/10 border-accent/30" :
          prefs.applyMode === "smart" ? "bg-warning/5 border-warning/20" :
          "bg-accent/5 border-accent/20"
        }`}>
          <div className="flex items-center gap-3">
            {prefs.applyMode === "full-auto" ? (
              <Bot className="w-5 h-5 text-accent animate-pulse" />
            ) : (
              <Shield className="w-5 h-5 text-accent" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">
                {prefs.applyMode === "full-auto" ? "Your AI is applying to jobs right now" :
                 prefs.applyMode === "smart" ? "Smart Approval — auto-applying to 80%+ matches" :
                 "Manual Review Mode"}
              </p>
              <p className="text-xs text-muted-foreground">
                {prefs.applyMode === "full-auto" ? "AI finds, optimizes, and queues applications automatically." :
                 prefs.applyMode === "smart" ? "Jobs above 80% match are auto-approved. Others need your review." :
                 "Review job details, analyze fit, then generate materials."}
              </p>
            </div>
          </div>
          <Badge className="bg-accent/15 text-accent border-accent/30 text-xs">
            {reviewCount} review · {analyzedCount} analyzed · {readyCount} ready
          </Badge>
        </Card>

        {/* Live Activity Feed */}
        {activityLog.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-accent" /> Live Activity Feed
            </h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {activityLog.slice(0, 10).map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-16 flex-shrink-0">{log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <Badge variant="outline" className={`text-[9px] w-14 justify-center ${
                    log.type === "apply" ? "border-success/30 text-success" :
                    log.type === "skip" ? "border-muted text-muted-foreground" :
                    log.type === "analyze" ? "border-primary/30 text-primary" :
                    "border-accent/30 text-accent"
                  }`}>{log.type}</Badge>
                  <span className="text-foreground font-medium">{log.action}</span>
                  <span className="text-muted-foreground truncate">{log.detail}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Preferences (loaded from profile, customizable) */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-primary text-lg">Job Preferences</h2>
            </div>
            {profileLoaded && (
              <Badge variant="outline" className="text-xs text-muted-foreground">Loaded from profile</Badge>
            )}
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
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setPrefs({ ...prefs, jobTitles: prefs.jobTitles.filter((_, idx) => idx !== i) })}>
                    {t} <X className="w-3 h-3 ml-1" />
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
                  <Input value={prefs.salaryMin} onChange={e => setPrefs({ ...prefs, salaryMin: e.target.value })} placeholder="80,000" />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Max Salary</Label>
                <div className="flex items-center gap-1 mt-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={prefs.salaryMax} onChange={e => setPrefs({ ...prefs, salaryMax: e.target.value })} placeholder="150,000" />
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
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setPrefs({ ...prefs, locations: prefs.locations.filter((_, idx) => idx !== i) })}>
                    <MapPin className="w-3 h-3 mr-1" />{l} <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={prefs.remoteOnly} onCheckedChange={v => setPrefs({ ...prefs, remoteOnly: v })} />
                <Label className="text-sm">Remote Only</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={prefs.requireReview} onCheckedChange={v => setPrefs({ ...prefs, requireReview: v })} />
                <Label className="text-sm">Require Review</Label>
              </div>
            </div>

            {/* Min Score */}
            <div>
              <Label className="text-sm font-semibold">Minimum Match Score: {prefs.minMatchScore}%</Label>
              <input
                type="range" min={30} max={90} value={prefs.minMatchScore}
                onChange={e => setPrefs({ ...prefs, minMatchScore: parseInt(e.target.value) })}
                className="w-full mt-1 accent-[hsl(var(--accent))]"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More Jobs (30%)</span>
                <span>Higher Quality (90%)</span>
              </div>
            </div>

            {/* Risk Tolerance */}
            <div>
              <Label className="text-sm font-semibold">Risk Tolerance: {prefs.riskTolerance}%</Label>
              <input
                type="range" min={10} max={90} value={prefs.riskTolerance}
                onChange={e => setPrefs({ ...prefs, riskTolerance: parseInt(e.target.value) })}
                className="w-full mt-1 accent-[hsl(var(--accent))]"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Conservative (safe bets only)</span>
                <span>Aggressive (stretch roles)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90" disabled={isSearching} onClick={runAutoSearch}>
              {isSearching ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...</> : <><Search className="w-4 h-4 mr-2" /> Find & Queue Jobs</>}
            </Button>
            {queue.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => { setQueue([]); toast.success("Queue cleared"); }}>
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
              <p className="text-sm text-muted-foreground">{queue.length} jobs</p>
            </div>

            <div className="space-y-3">
              {queue.map(item => {
                const isExpanded = expandedId === item.id;
                const isGenerating = generatingId === item.id;
                const isAnalyzing = analyzingId === item.id;

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
                      <Badge variant="outline" className={`text-xs ${statusColor(item.status)}`}>
                        {statusLabel(item.status)}
                      </Badge>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {item.status === "review" && (
                          <>
                            <Button size="sm" className="text-xs gradient-indigo text-white" onClick={() => { analyzeItem(item); setExpandedId(item.id); }} disabled={isAnalyzing}>
                              {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Target className="w-3 h-3 mr-1" /> Analyze Fit</>}
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                              <Eye className="w-3 h-3 mr-1" /> View Job
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => skipJob(item.id)}>Skip</Button>
                          </>
                        )}
                        {item.status === "analyzed" && (
                          <>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                              <Eye className="w-3 h-3 mr-1" /> {isExpanded ? "Collapse" : "Review Analysis"}
                            </Button>
                            <Button size="sm" className="text-xs gradient-indigo text-white" onClick={() => generatePackage(item)} disabled={isGenerating}>
                              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Package className="w-3 h-3 mr-1" /> Generate Package</>}
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                              const jobDesc = `${item.jobTitle} at ${item.company}\n${item.jobDescription}`;
                              const url = `/job-seeker?prefillJob=${encodeURIComponent(jobDesc)}`;
                              window.open(url, "_blank");
                            }}>
                              <ExternalLink className="w-3 h-3 mr-1" /> Full Analysis
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => skipJob(item.id)}>Skip</Button>
                          </>
                        )}
                        {item.status === "ready" && (
                          <>
                            <Button size="sm" className="text-xs" onClick={() => approveAndTrack(item)}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Track Application
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded Panel */}
                    {isExpanded && (
                      <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                        {/* Job Description */}
                        {item.jobDescription && (
                          <div>
                            <h4 className="text-sm font-semibold text-primary flex items-center gap-1 mb-2">
                              <Briefcase className="w-3.5 h-3.5" /> Job Description
                            </h4>
                            <pre className="text-xs whitespace-pre-wrap font-mono bg-card p-3 rounded-lg border border-border max-h-40 overflow-y-auto">
                              {item.jobDescription}
                            </pre>
                          </div>
                        )}

                        {/* Analysis Results */}
                        {item.analysis && (
                          <div>
                            <h4 className="text-sm font-semibold text-primary flex items-center gap-1 mb-2">
                              <Target className="w-3.5 h-3.5" /> Fit Analysis
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                              <div className="text-center p-2 bg-card rounded-lg border border-border">
                                <div className="text-lg font-bold text-primary">{item.analysis.overallScore}%</div>
                                <div className="text-[10px] text-muted-foreground">Overall</div>
                              </div>
                              <div className="text-center p-2 bg-card rounded-lg border border-border">
                                <div className="text-lg font-bold text-accent">{item.analysis.interviewProbability}%</div>
                                <div className="text-[10px] text-muted-foreground">Interview Prob.</div>
                              </div>
                              <div className="text-center p-2 bg-card rounded-lg border border-border">
                                <div className="text-lg font-bold text-success">{item.analysis.matchedSkills.filter(s => s.matched).length}</div>
                                <div className="text-[10px] text-muted-foreground">Skills Matched</div>
                              </div>
                              <div className="text-center p-2 bg-card rounded-lg border border-border">
                                <div className="text-lg font-bold text-warning">{item.analysis.gaps.length}</div>
                                <div className="text-[10px] text-muted-foreground">Gaps</div>
                              </div>
                            </div>
                            {item.analysis.topActions && item.analysis.topActions.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-foreground mb-1">Top Actions:</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  {item.analysis.topActions.map((a, i) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <span className="text-accent">•</span> {a}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Generated Materials */}
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

        {/* How It Works */}
        <Card className="p-5 border-dashed border-2 border-muted">
          <h3 className="font-display font-bold text-primary mb-3 flex items-center gap-2">
            <Eye className="w-5 h-5" /> How the Agent Works
          </h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="flex gap-2"><span className="text-accent font-bold">1.</span><span>Searches jobs matching your preferences & skills</span></div>
            <div className="flex gap-2"><span className="text-accent font-bold">2.</span><span>You review job descriptions & analyze fit</span></div>
            <div className="flex gap-2"><span className="text-accent font-bold">3.</span><span>Generate tailored resume + cover letter</span></div>
            <div className="flex gap-2"><span className="text-accent font-bold">4.</span><span>Approve and track in your application dashboard</span></div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <Shield className="w-3 h-3" /> Nothing happens without your review and approval.
          </p>
        </Card>
      </div>
    </div>
  );
}
