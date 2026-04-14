import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Loader2, AlertTriangle, CheckCircle2, Target, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { analyzeJobFit, FitAnalysis } from "@/lib/analysisEngine";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface ImportedJob {
  id: string;
  title: string;
  company: string;
  description: string;
  originalScore?: number;
  optimizedScore?: number;
  analysis?: FitAnalysis | null;
  status: "pending" | "analyzing" | "done";
}

export default function JobBoardImporter() {
  const navigate = useNavigate();
  const [rawInput, setRawInput] = useState("");
  const [importedJobs, setImportedJobs] = useState<ImportedJob[]>([]);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseJobsFromText = (text: string): ImportedJob[] => {
    // Split by common separators (double newlines, dashes, numbered items)
    const sections = text.split(/\n{2,}|---+|\n(?=\d+[\.\)]\s)/).filter(s => s.trim().length > 30);
    
    return sections.map(section => {
      const lines = section.trim().split("\n").filter(Boolean);
      // Try to extract title and company from first lines
      let title = lines[0]?.replace(/^\d+[\.\)]\s*/, "").trim() || "Unknown Role";
      let company = "";
      
      // Common patterns: "Title at Company" or "Title - Company" or "Company: Title"
      const atMatch = title.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
      const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
      
      if (atMatch) { title = atMatch[1]; company = atMatch[2]; }
      else if (dashMatch) { title = dashMatch[1]; company = dashMatch[2]; }
      else if (lines[1] && lines[1].length < 60) { company = lines[1].trim(); }

      return {
        id: crypto.randomUUID(),
        title: title.slice(0, 100),
        company: company.slice(0, 100) || "Unknown Company",
        description: section.trim(),
        status: "pending" as const,
      };
    }).filter(j => j.title !== "Unknown Role" || j.description.length > 50);
  };

  const handleImport = () => {
    if (!rawInput.trim()) { toast.error("Paste your saved jobs or application history"); return; }
    const jobs = parseJobsFromText(rawInput);
    if (!jobs.length) { toast.error("Couldn't parse any jobs. Try pasting with more detail."); return; }
    setImportedJobs(jobs);
    toast.success(`Parsed ${jobs.length} jobs from your import`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      setRawInput(text);
      const jobs = parseJobsFromText(text);
      setImportedJobs(jobs);
      toast.success(`Parsed ${jobs.length} jobs from file`);
    } catch {
      toast.error("Failed to read file");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const analyzeAll = async () => {
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      // Get user resume
      const { data: versions } = await supabase
        .from("resume_versions" as any)
        .select("resume_text")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1) as any;

      let resumeText = versions?.[0]?.resume_text || "";
      if (!resumeText) {
        const { data: profile } = await supabase
          .from("job_seeker_profiles")
          .select("skills, summary, full_name")
          .eq("user_id", session.user.id)
          .maybeSingle();
        resumeText = [profile?.full_name, profile?.summary, (profile?.skills as string[])?.join(", ")].filter(Boolean).join("\n");
      }

      if (!resumeText) { toast.error("No resume found. Upload one first."); return; }

      let missedCount = 0;
      const updated = importedJobs.map(job => {
        const analysis = analyzeJobFit(job.description, resumeText);
        const isMissed = analysis.overallScore >= 60;
        if (isMissed) missedCount++;
        return { ...job, analysis, originalScore: analysis.overallScore, status: "done" as const };
      });

      setImportedJobs(updated);
      const missedPct = importedJobs.length > 0 ? Math.round((missedCount / importedJobs.length) * 100) : 0;
      toast.success(`Analysis complete! You missed ${missedPct}% of opportunities.`);
    } catch (e) {
      console.error(e);
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const doneJobs = importedJobs.filter(j => j.status === "done");
  const missedOpportunities = doneJobs.filter(j => (j.originalScore || 0) >= 60);
  const missedPct = doneJobs.length > 0 ? Math.round((missedOpportunities.length / doneJobs.length) * 100) : 0;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
          <Upload className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h3 className="font-display font-bold text-foreground">Import My Job Search</h3>
          <p className="text-xs text-muted-foreground">Re-analyze saved jobs from Indeed, LinkedIn, or other boards</p>
        </div>
      </div>

      {importedJobs.length === 0 ? (
        <div className="space-y-4">
          <Textarea
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder={"Paste your saved jobs, application history, or job descriptions here...\n\nFormats supported:\n• Indeed saved jobs (copy from your saved list)\n• LinkedIn applications (copy application history)\n• Any list of job titles + descriptions"}
            rows={8}
          />
          <div className="flex gap-3">
            <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90" onClick={handleImport} disabled={!rawInput.trim()}>
              <Target className="w-4 h-4 mr-2" /> Import & Parse
            </Button>
            <input ref={fileRef} type="file" accept=".txt,.csv,.json" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4 mr-2" /> Upload File</>}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Results summary */}
          {doneJobs.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-display font-bold text-destructive mb-1">
                You missed {missedPct}% of opportunities.
              </p>
              <p className="text-sm text-muted-foreground">
                {missedOpportunities.length} of {doneJobs.length} jobs were strong matches that could have been optimized.
              </p>
              <p className="text-xs text-accent mt-2">AI can rewrite your resume for each — fixing what you missed.</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {doneJobs.length === 0 && (
              <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90" onClick={analyzeAll} disabled={analyzing}>
                {analyzing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing {importedJobs.length} jobs...</> : <><Target className="w-4 h-4 mr-2" /> Re-Analyze All Jobs</>}
              </Button>
            )}
            <Button variant="outline" onClick={() => { setImportedJobs([]); setRawInput(""); }}>
              <RefreshCw className="w-4 h-4 mr-2" /> New Import
            </Button>
          </div>

          {/* Job list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {importedJobs.map(job => (
              <div key={job.id} className={`p-3 rounded-lg border ${
                job.status === "done" && (job.originalScore || 0) >= 60 ? "border-success/20 bg-success/5" :
                job.status === "done" ? "border-border bg-muted/20" : "border-border"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.company}</p>
                  </div>
                  {job.status === "done" && job.originalScore !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className={`text-lg font-display font-bold ${
                        job.originalScore >= 70 ? "text-success" : job.originalScore >= 50 ? "text-warning" : "text-destructive"
                      }`}>{job.originalScore}%</div>
                      {job.originalScore >= 60 ? (
                        <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Missed Opportunity</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Low Match</Badge>
                      )}
                    </div>
                  )}
                  {job.status === "pending" && <Badge variant="outline" className="text-xs">Pending</Badge>}
                  {job.status === "analyzing" && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
                </div>
                {job.status === "done" && job.originalScore && job.originalScore >= 60 && (
                  <Button variant="ghost" size="sm" className="mt-2 text-xs text-accent" onClick={() => {
                    navigate("/job-seeker", { state: { prefillJob: job.description } });
                  }}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Optimize & Re-Apply
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
