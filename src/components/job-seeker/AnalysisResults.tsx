import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target, Sparkles, AlertTriangle, CheckCircle2, XCircle, ChevronRight,
  Lightbulb, ExternalLink, Loader2, FileText, Copy, Mail, Download,
  Plus, MessageSquare, BookOpen, GraduationCap, Award, Package,
  TrendingUp, Shield, Zap, Link2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { type FitAnalysis } from "@/lib/analysisEngine";
import { ScoreRingInline, AnimatedBar } from "@/components/ScoreDisplay";
import { supabase } from "@/integrations/supabase/client";
import ApplicationToolkit from "@/components/ApplicationToolkit";
import ApplicationPackageGenerator from "@/components/ApplicationPackageGenerator";
import ResumeComparison from "@/components/ResumeComparison";
import GapIntelligence from "@/components/GapIntelligence";
import InterviewPredictor from "@/components/InterviewPredictor";
import { toast } from "sonner";

interface AnalysisResultsProps {
  analysis: FitAnalysis;
  jobDesc: string;
  resume: string;
  jobLink: string;
  isDemo: boolean;
  onReset: () => void;
  onReEvaluate?: () => void;
}

export default function AnalysisResults({
  analysis, jobDesc, resume, jobLink, isDemo, onReset, onReEvaluate,
}: AnalysisResultsProps) {
  const navigate = useNavigate();
  const [aiResume, setAiResume] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverTone, setCoverTone] = useState<"professional" | "conversational" | "enthusiastic">("professional");
  const [interviewPrep, setInterviewPrep] = useState("");
  const [isGeneratingInterviewPrep, setIsGeneratingInterviewPrep] = useState(false);
  const [followUpEmail, setFollowUpEmail] = useState("");
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [emailType, setEmailType] = useState("follow-up");
  const [applyDirectUrl, setApplyDirectUrl] = useState("");
  const [isAutoApplying, setIsAutoApplying] = useState(false);
  const [addingSkill, setAddingSkill] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const streamFromEdgeFunction = async (
    functionName: string, body: Record<string, any>,
    onChunk: (text: string) => void, onDone?: () => void,
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { toast.error("Please sign in"); return; }
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
      { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) },
    );
    if (!resp.ok) { const err = await resp.json().catch(() => ({ error: "Request failed" })); toast.error(err.error || "Request failed"); return; }
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "", full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") break;
        try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) { full += c; onChunk(full); } } catch { buffer = line + "\n" + buffer; break; }
      }
    }
    onDone?.();
    return full;
  };

  const handleAIRewrite = async () => {
    setIsRewriting(true); setAiResume("");
    const matched = analysis.matchedSkills.filter(s => s.matched).map(s => s.skill);
    const gaps = analysis.gaps.map(g => g.area);
    try {
      const full = await streamFromEdgeFunction("rewrite-resume", { resume, jobDescription: jobDesc, matchedSkills: matched, gaps }, (t) => setAiResume(t), () => toast.success("Resume optimized!"));
      if (full && !isDemo) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: recent } = await supabase.from("analysis_history").select("id").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(1);
          if (recent?.[0]) await supabase.from("analysis_history").update({ optimized_resume: full } as any).eq("id", recent[0].id);
        }
      }
    } catch { toast.error("Failed to optimize resume"); }
    finally { setIsRewriting(false); }
  };

  const handleGenerateCoverLetter = async () => {
    setIsGeneratingCover(true); setCoverLetter("");
    try {
      await streamFromEdgeFunction("generate-cover-letter", { resume, jobDescription: jobDesc, matchedSkills: analysis.matchedSkills.filter(s => s.matched).map(s => s.skill), gaps: analysis.gaps.map(g => g.area), tone: coverTone }, (t) => setCoverLetter(t), () => toast.success("Cover letter generated!"));
    } catch { toast.error("Failed to generate cover letter"); }
    finally { setIsGeneratingCover(false); }
  };

  const handleGenerateInterviewPrep = async () => {
    setIsGeneratingInterviewPrep(true); setInterviewPrep("");
    try {
      await streamFromEdgeFunction("generate-interview-prep", { jobDescription: jobDesc, resume, matchedSkills: analysis.matchedSkills.filter(s => s.matched).map(s => s.skill), gaps: analysis.gaps.map(g => g.area) }, (t) => setInterviewPrep(t), () => toast.success("Interview prep ready!"));
    } catch { toast.error("Failed to generate interview prep"); }
    finally { setIsGeneratingInterviewPrep(false); }
  };

  const handleGenerateFollowUpEmail = async () => {
    setIsGeneratingEmail(true); setFollowUpEmail("");
    const firstLine = jobDesc.trim().split("\n")[0] || "";
    const titleMatch = firstLine.match(/^(.+?)(?:\s*[—–-]\s*|$)/);
    const jobTitle = titleMatch?.[1]?.trim() || "the role";
    const companyMatch = jobDesc.match(/(?:at|@|company[:\s]*)\s*([A-Z][A-Za-z0-9 &.]+)/i);
    const company = companyMatch?.[1]?.trim() || "";
    try {
      await streamFromEdgeFunction("generate-followup-email", { jobTitle, company, resume, emailType }, (t) => setFollowUpEmail(t), () => toast.success("Email generated!"));
    } catch { toast.error("Failed to generate email"); }
    finally { setIsGeneratingEmail(false); }
  };

  const handleAutoApply = async () => {
    if (isDemo) { toast.info("Sign up to use auto-apply"); return; }
    setIsAutoApplying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const jobTitle = jobDesc.split("\n")[0]?.slice(0, 80) || "Unknown Role";
      await supabase.from("job_applications").insert({
        user_id: session.user.id,
        job_title: jobTitle, company: "Unknown Company",
        job_url: jobLink || applyDirectUrl || null, status: "applied",
        notes: `Auto-applied via AI. Fit Score: ${analysis.overallScore}%`,
      });
      await supabase.functions.invoke("agent-orchestrator", { body: { agents: ["optimization", "application"] } });
      toast.success("Application tracked & agent triggered!");
      navigate("/applications");
    } catch (e: any) { toast.error("Auto-apply failed", { description: e.message }); }
    finally { setIsAutoApplying(false); }
  };

  const handleAddSkillToProfile = async (skill: string) => {
    setAddingSkill(skill);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("job_seeker_profiles").select("skills").eq("user_id", session.user.id).maybeSingle();
      const current = (data?.skills as string[]) || [];
      if (current.includes(skill)) { toast.info(`"${skill}" already in profile`); return; }
      await supabase.from("job_seeker_profiles").upsert({ user_id: session.user.id, skills: [...current, skill], updated_at: new Date().toISOString() } as any, { onConflict: "user_id" });
      toast.success(`"${skill}" added to profile!`);
    } catch { toast.error("Failed to add skill"); }
    finally { setAddingSkill(null); }
  };

  const handleCopy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copied!`); };

  const handleDownload = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const severityColor: Record<string, string> = { critical: "text-destructive", moderate: "text-warning", minor: "text-muted-foreground" };
  const severityBg: Record<string, string> = { critical: "bg-destructive/10 border-destructive/20", moderate: "bg-warning/10 border-warning/20", minor: "bg-muted border-border" };

  return (
    <div className="animate-fade-up space-y-8">
      {/* Score Header */}
      <div className="rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-8" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex-shrink-0"><ScoreRingInline score={analysis.overallScore} size={160} /></div>
        <div className="text-center md:text-left">
          <p className="text-white/50 text-sm font-medium uppercase tracking-widest mb-2">Overall Fit Score</p>
          <h2 className="font-display text-3xl font-bold text-white mb-4">{analysis.summary}</h2>
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {analysis.strengths.map(s => <Badge key={s} className="bg-teal-500/20 text-teal-300 border-teal-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> {s}</Badge>)}
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Interview Chance", value: analysis.interviewProbability, icon: Target },
          { label: "Experience Match", value: analysis.experienceMatch, icon: Shield },
          { label: "Keyword Alignment", value: analysis.keywordAlignment, icon: Zap },
          { label: "Fit Score", value: analysis.overallScore, icon: TrendingUp },
        ].map(m => (
          <div key={m.label} className="bg-card rounded-xl p-4 border border-border shadow-sm text-center">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1 justify-center"><m.icon className="w-3 h-3" /> {m.label}</div>
            <div className={`text-2xl font-display font-bold ${m.value >= 70 ? "text-success" : m.value >= 45 ? "text-warning" : "text-destructive"}`}>{m.value}%</div>
          </div>
        ))}
      </div>

      {/* Top Actions */}
      {analysis.topActions.length > 0 && (
        <div className="bg-accent/5 border border-accent/20 rounded-2xl p-5">
          <h3 className="font-display font-bold text-foreground text-base mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Top Actions to Improve
          </h3>
          <div className="space-y-2">
            {analysis.topActions.map((action, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="w-6 h-6 rounded-full gradient-teal text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                <span className="text-foreground">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <GapIntelligence analysis={analysis} onReEvaluate={onReEvaluate} />

      {/* Ready to Apply */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent" /> Ready to Apply
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4 text-accent" /><span className="font-semibold text-sm">Apply via Direct Link</span></div>
            <p className="text-xs text-muted-foreground flex-1">Open the job posting and apply manually.</p>
            {jobLink ? (
              <a href={jobLink} target="_blank" rel="noopener noreferrer"><Button className="w-full gradient-teal text-white" size="sm"><ExternalLink className="w-4 h-4 mr-1.5" /> Open & Apply</Button></a>
            ) : (
              <div className="space-y-2">
                <Input placeholder="Paste job URL…" value={applyDirectUrl} onChange={e => setApplyDirectUrl(e.target.value)} className="text-sm" />
                <Button className="w-full gradient-teal text-white" size="sm" disabled={!applyDirectUrl} onClick={() => window.open(applyDirectUrl, "_blank")}><ExternalLink className="w-4 h-4 mr-1.5" /> Open & Apply</Button>
              </div>
            )}
          </div>
          <div className="border border-accent/30 rounded-xl p-5 flex flex-col gap-3 bg-accent/5">
            <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /><span className="font-semibold text-sm">AI Auto-Fill & Apply</span></div>
            <p className="text-xs text-muted-foreground flex-1">AI generates materials and tracks automatically.</p>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" size="sm" disabled={isAutoApplying || isDemo} onClick={handleAutoApply}>
              {isAutoApplying ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Processing…</> : <><Sparkles className="w-4 h-4 mr-1.5" /> Auto-Fill & Track</>}
            </Button>
          </div>
        </div>
      </div>

      <InterviewPredictor jobDescription={jobDesc} resumeText={resume} />
      <ApplicationToolkit jobLink={jobLink} jobDesc={jobDesc} resume={resume} coverLetter={coverLetter} aiResume={aiResume} overallScore={analysis.overallScore} />
      <ApplicationPackageGenerator resume={resume} aiResume={aiResume} coverLetter={coverLetter} jobDesc={jobDesc} analysis={analysis} />

      {/* Skills Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="font-display font-bold text-foreground text-lg mb-5 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-success" /> Skills You Have</h3>
          <div className="space-y-4">
            {analysis.matchedSkills.filter(s => s.matched).map(s => (
              <div key={s.skill}><div className="flex justify-between mb-1.5"><span className="text-sm font-medium">{s.skill}</span><span className="text-xs text-success font-semibold">{s.confidence}%</span></div><AnimatedBar value={s.confidence} /></div>
            ))}
            {analysis.matchedSkills.filter(s => s.matched).length === 0 && <p className="text-muted-foreground text-sm">No direct matches.</p>}
          </div>
        </div>
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="font-display font-bold text-foreground text-lg mb-5 flex items-center gap-2"><XCircle className="w-5 h-5 text-destructive" /> Skills to Develop</h3>
          <div className="space-y-3">
            {analysis.matchedSkills.filter(s => !s.matched).slice(0, 6).map(s => (
              <div key={s.skill} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm font-medium">{s.skill}</span>
                <Button variant="outline" size="sm" className="text-xs h-7 border-accent/30 text-accent" disabled={addingSkill === s.skill} onClick={() => handleAddSkillToProfile(s.skill)}>
                  {addingSkill === s.skill ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />} Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gap Analysis */}
      {analysis.gaps.length > 0 && (
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h3 className="font-display font-bold text-foreground text-lg mb-5 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" /> Gap Analysis</h3>
          <div className="space-y-4">
            {analysis.gaps.map(gap => (
              <div key={gap.area} className={`rounded-xl p-4 border ${severityBg[gap.severity]}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-semibold ${severityColor[gap.severity]}`}>{gap.area}</span>
                  <Badge variant="outline" className="text-xs capitalize">{gap.severity}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{gap.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Roadmap */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="font-display font-bold text-foreground text-lg mb-6 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-accent" /> Improvement Roadmap</h3>
        <div className="relative">
          <div className="absolute left-5 top-2 bottom-2 w-px bg-border" />
          <div className="space-y-6">
            {analysis.improvementPlan.map((item, i) => (
              <div key={i} className="flex gap-5">
                <div className="relative flex-shrink-0"><div className="w-10 h-10 rounded-full gradient-teal flex items-center justify-center text-white font-bold text-sm shadow-teal">{i + 1}</div></div>
                <div className="pt-1.5"><div className="text-xs font-semibold text-accent uppercase tracking-wider mb-1">{item.week}</div><p className="text-sm text-foreground">{item.action}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resume Optimizer */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-accent" /> Optimize Resume</h3>
          <Button size="sm" className="gradient-teal text-white shadow-teal hover:opacity-90" disabled={isRewriting || isDemo} onClick={handleAIRewrite}>
            {isRewriting ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Optimizing…</> : <><Sparkles className="w-4 h-4 mr-1.5" /> {aiResume ? "Re-Optimize" : "Optimize"}</>}
          </Button>
        </div>
        {aiResume ? <ResumeComparison original={resume} optimized={aiResume} /> : (
          <div className="bg-muted/50 rounded-xl p-4 border border-border max-h-72 overflow-y-auto"><pre className="text-xs whitespace-pre-wrap font-mono">{resume.slice(0, 2000)}</pre></div>
        )}
        {aiResume && (
          <div className="flex flex-wrap gap-3 mt-4">
            <Button variant="outline" size="sm" onClick={() => handleCopy(aiResume, "Resume")}><Copy className="w-4 h-4 mr-1.5" /> Copy</Button>
            <Button variant="outline" size="sm" onClick={() => handleDownload(aiResume, "optimized-resume.txt")}><Download className="w-4 h-4 mr-1.5" /> .txt</Button>
          </div>
        )}
      </div>

      {/* Cover Letter */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2"><Mail className="w-5 h-5 text-accent" /> Cover Letter</h3>
          <Button size="sm" className="gradient-teal text-white shadow-teal hover:opacity-90" disabled={isGeneratingCover || isDemo} onClick={handleGenerateCoverLetter}>
            {isGeneratingCover ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-1.5" /> {coverLetter ? "Regenerate" : "Generate"}</>}
          </Button>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Tone:</span>
          {(["professional", "conversational", "enthusiastic"] as const).map(t => (
            <Button key={t} variant={coverTone === t ? "default" : "outline"} size="sm" className={`text-xs capitalize ${coverTone === t ? "gradient-teal text-white" : ""}`} onClick={() => setCoverTone(t)}>{t}</Button>
          ))}
        </div>
        {coverLetter && (
          <>
            <div className="bg-muted/30 rounded-xl p-5 border border-border mb-4 max-h-80 overflow-y-auto"><pre className="text-sm whitespace-pre-wrap font-sans">{coverLetter}</pre></div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => handleCopy(coverLetter, "Cover letter")}><Copy className="w-4 h-4 mr-1.5" /> Copy</Button>
              <Button variant="outline" size="sm" onClick={() => handleDownload(coverLetter, "cover-letter.txt")}><Download className="w-4 h-4 mr-1.5" /> .txt</Button>
            </div>
          </>
        )}
      </div>

      {/* Interview Prep */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5 text-accent" /> Interview Prep</h3>
          <Button size="sm" className="gradient-teal text-white shadow-teal hover:opacity-90" disabled={isGeneratingInterviewPrep || isDemo} onClick={handleGenerateInterviewPrep}>
            {isGeneratingInterviewPrep ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-1.5" /> {interviewPrep ? "Regenerate" : "Prepare"}</>}
          </Button>
        </div>
        {interviewPrep && (
          <>
            <div className="bg-muted/30 rounded-xl p-5 border border-border mb-4 max-h-96 overflow-y-auto"><pre className="text-sm whitespace-pre-wrap font-sans">{interviewPrep}</pre></div>
            <Button variant="outline" size="sm" onClick={() => handleCopy(interviewPrep, "Interview prep")}><Copy className="w-4 h-4 mr-1.5" /> Copy</Button>
          </>
        )}
      </div>

      {/* Follow-up Email */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-foreground text-lg flex items-center gap-2"><Mail className="w-5 h-5 text-accent" /> Follow-Up Email</h3>
          <Button size="sm" className="gradient-teal text-white shadow-teal hover:opacity-90" disabled={isGeneratingEmail || isDemo} onClick={handleGenerateFollowUpEmail}>
            {isGeneratingEmail ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-1.5" /> Generate</>}
          </Button>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Type:</span>
          {["follow-up", "thank-you", "recruiter-outreach", "networking"].map(t => (
            <Button key={t} variant={emailType === t ? "default" : "outline"} size="sm" className={`text-xs capitalize ${emailType === t ? "gradient-teal text-white" : ""}`} onClick={() => setEmailType(t)}>{t.replace("-", " ")}</Button>
          ))}
        </div>
        {followUpEmail && (
          <>
            <div className="bg-muted/30 rounded-xl p-5 border border-border mb-4 max-h-80 overflow-y-auto"><pre className="text-sm whitespace-pre-wrap font-sans">{followUpEmail}</pre></div>
            <Button variant="outline" size="sm" onClick={() => handleCopy(followUpEmail, "Email")}><Copy className="w-4 h-4 mr-1.5" /> Copy</Button>
          </>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="flex flex-col items-center gap-4">
        {isDemo && (
          <div className="w-full max-w-md bg-accent/10 border border-accent/20 rounded-2xl p-6 text-center">
            <h3 className="font-display font-bold text-foreground text-lg mb-2">Ready to optimize your real resume?</h3>
            <p className="text-sm text-muted-foreground mb-4">Sign up free to unlock all features.</p>
            <Button className="gradient-teal text-white shadow-teal hover:opacity-90" onClick={() => navigate("/auth")}>Sign Up Free</Button>
          </div>
        )}
        <Button variant="outline" onClick={onReset}>Analyze Another Role</Button>
      </div>
    </div>
  );
}
