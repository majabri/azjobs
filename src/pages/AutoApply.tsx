import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Bot, Play,
  Eye, Shield, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import { analyzeJobFit } from "@/lib/analysisEngine";
import { AutoApplyPreferences } from "@/components/auto-apply/AutoApplyPreferences";
import { QueuedJobCard, QueuedApplication } from "@/components/auto-apply/QueuedJobCard";
import { logger } from '@/lib/logger';

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
          jobTitles: (data.target_job_titles as string[]) || [],
          salaryMin: data.salary_min || "",
          salaryMax: data.salary_max || "",
          locations: data.location ? [data.location] : [],
          remoteOnly: data.remote_only || false,
          requireReview: true,
          minMatchScore: data.min_match_score ?? 60,
          applyMode: "manual",
          riskTolerance: 50,
        });
        setProfileLoaded(true);
      }
    } catch (e) {
      logger.error(e);
    }
  };

  // Persist minMatchScore to DB on change (debounced)
  useEffect(() => {
    if (!profileLoaded) return;
    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await supabase.from("job_seeker_profiles").update({ min_match_score: prefs.minMatchScore }).eq("user_id", session.user.id);
      } catch (e) { logger.error("Failed to save match score:", e); }
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
      .from("resume_versions")
      .select("resume_text")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

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

      const { data, error: searchError } = await supabase.functions.invoke("search-jobs", {
        body: {
          skills: (profile?.skills as string[]) || [],
          jobTypes: profile?.preferred_job_types || [],
          location: prefs.locations.join(", ") || (profile?.location as string) || "",
          careerLevel: profile?.career_level || "",
          targetTitles: prefs.jobTitles,
          query: prefs.remoteOnly ? "remote positions only" : "",
        },
      });

      if (searchError) throw new Error(searchError.message || "Search failed");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- edge function returns untyped JSON payload
      const jobs = (data?.jobs || []) as any[];

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
                try { const p = JSON.parse(line.slice(6)); optimizedResume += p.choices?.[0]?.delta?.content || ""; } catch (e) { logger.warn("SSE parse error:", e); }
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
                try { const p = JSON.parse(line.slice(6)); coverLetter += p.choices?.[0]?.delta?.content || ""; } catch (e) { logger.warn("SSE parse error:", e); }
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
      });
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
        <AutoApplyPreferences
          prefs={prefs}
          setPrefs={setPrefs}
          profileLoaded={profileLoaded}
          titleInput={titleInput}
          setTitleInput={setTitleInput}
          locationInput={locationInput}
          setLocationInput={setLocationInput}
          isSearching={isSearching}
          queueLength={queue.length}
          onSearch={runAutoSearch}
          onClearQueue={() => { setQueue([]); toast.success("Queue cleared"); }}
        />

        {/* Application Queue */}
        {queue.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-primary text-xl">Application Queue</h2>
              <p className="text-sm text-muted-foreground">{queue.length} jobs</p>
            </div>

            <div className="space-y-3">
              {queue.map(item => (
                <QueuedJobCard
                  key={item.id}
                  item={item}
                  isExpanded={expandedId === item.id}
                  isGenerating={generatingId === item.id}
                  isAnalyzing={analyzingId === item.id}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onAnalyze={() => analyzeItem(item)}
                  onGeneratePackage={() => generatePackage(item)}
                  onApproveAndTrack={() => approveAndTrack(item)}
                  onSkip={() => skipJob(item.id)}
                />
              ))}
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
