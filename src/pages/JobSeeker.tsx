import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target, Sparkles, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Lightbulb, Link2, Linkedin, ExternalLink, Download, Loader2, Upload, FileText, Copy } from "lucide-react";
import { analyzeJobFit, type FitAnalysis } from "@/lib/analysisEngine";
import { ScoreRingInline, AnimatedBar } from "@/components/ScoreDisplay";
import { scrapeUrl } from "@/lib/api/scrapeUrl";
import { parseDocument } from "@/lib/api/parseDocument";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";

const EXAMPLE_JOB = `Senior Product Manager — SaaS Growth

We're looking for an experienced Product Manager to lead our growth squad.

Requirements:
- 4+ years of product management experience
- Strong data analysis and SQL skills
- Experience with Agile and Scrum methodologies
- Track record of driving user growth metrics
- Excellent communication and leadership skills
- Experience with A/B testing and experimentation
- Familiarity with customer success processes
- Python or data tooling experience a plus`;

const EXAMPLE_RESUME = `Jane Doe | Product Manager
jane@email.com

Experience:
Senior PM at TechCorp (3 years)
- Led agile product teams across 4 squads
- Drove 35% user growth through feature optimization
- Collaborated cross-functionally with engineering and design
- Managed product roadmap using Scrum methodology

PM at StartupXYZ (2 years)
- Communication strategy for product launches
- Used Excel and Tableau for reporting

Skills: Agile, Scrum, Communication, Leadership, Excel, Tableau, Customer Success
Education: MBA — Business Strategy`;

type Step = "input" | "result";

export default function JobSeekerPage() {
  const navigate = useNavigate();
  const [jobDesc, setJobDesc] = useState("");
  const [resume, setResume] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingJob, setIsFetchingJob] = useState(false);
  const [isFetchingLinkedin, setIsFetchingLinkedin] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [aiResume, setAiResume] = useState("");
  const resumeFileRef = useRef<HTMLInputElement>(null);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingResume(true);
    try {
      const result = await parseDocument(file);
      if (result.success && result.text) {
        setResume(result.text);
        toast.success("Resume extracted successfully!");
      } else {
        toast.error(result.error || "Could not extract text from document");
      }
    } catch {
      toast.error("Failed to parse document");
    } finally {
      setIsUploadingResume(false);
      if (resumeFileRef.current) resumeFileRef.current.value = "";
    }
  };

  const handleFetchJobLink = async () => {
    if (!jobLink.trim()) return;
    setIsFetchingJob(true);
    try {
      const result = await scrapeUrl(jobLink);
      if (result.success && result.markdown) {
        setJobDesc(result.markdown);
        toast.success("Job description fetched successfully!");
      } else {
        toast.error(result.error || "Could not fetch job description");
      }
    } catch {
      toast.error("Failed to fetch job posting");
    } finally {
      setIsFetchingJob(false);
    }
  };

  const handleFetchLinkedin = async () => {
    if (!linkedinUrl.trim()) return;
    if (linkedinUrl.includes("linkedin.com")) {
      toast.error("LinkedIn profiles can't be auto-fetched due to site restrictions. Please copy & paste your profile text instead.");
      return;
    }
    setIsFetchingLinkedin(true);
    try {
      const result = await scrapeUrl(linkedinUrl);
      if (result.success && result.markdown) {
        setResume(result.markdown);
        toast.success("Profile fetched successfully!");
      } else {
        toast.error(result.error || "Could not fetch profile");
      }
    } catch {
      toast.error("Failed to fetch profile");
    } finally {
      setIsFetchingLinkedin(false);
    }
  };

  const handleAnalyze = () => {
    if (!jobDesc.trim() || !resume.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const result = analyzeJobFit(jobDesc, resume);
      setAnalysis(result);
      setStep("result");
      setIsAnalyzing(false);
    }, 1800);
  };

  const handleReset = () => {
    setStep("input");
    setAnalysis(null);
    setJobDesc("");
    setResume("");
    setJobLink("");
    setLinkedinUrl("");
    setAiResume("");
  };

  const severityColor = {
    critical: "text-destructive",
    moderate: "text-warning",
    minor: "text-muted-foreground",
  };

  const severityBg = {
    critical: "bg-destructive/10 border-destructive/20",
    moderate: "bg-warning/10 border-warning/20",
    minor: "bg-muted border-border",
  };

  const handleAddExperience = (skill: string) => {
    const updatedResume = resume + `\n\nAdditional Skills: ${skill}`;
    setResume(updatedResume);
    setIsAnalyzing(true);
    setTimeout(() => {
      const result = analyzeJobFit(jobDesc, updatedResume);
      setAnalysis(result);
      setIsAnalyzing(false);
      toast.success(`"${skill}" added to your profile — score updated!`);
    }, 800);
  };

  const handleAIRewrite = async () => {
    if (!analysis) return;
    setIsRewriting(true);
    setAiResume("");

    const matchedSkills = analysis.matchedSkills.filter((s) => s.matched).map((s) => s.skill);
    const gaps = analysis.gaps.map((g) => g.area);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rewrite-resume`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ resume, jobDescription: jobDesc, matchedSkills, gaps }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed to rewrite resume" }));
        toast.error(err.error || "Failed to rewrite resume");
        setIsRewriting(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              full += content;
              setAiResume(full);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      toast.success("Resume rewritten with AI!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to rewrite resume");
    } finally {
      setIsRewriting(false);
    }
  };

  const getATSContent = () => aiResume || generateATSResume();

  const generateATSResume = (): string => {
    if (!analysis) return "";
    const matchedSkills = analysis.matchedSkills.filter((s) => s.matched).map((s) => s.skill);
    const allSkills = [
      ...matchedSkills,
      ...analysis.matchedSkills.filter((s) => !s.matched).map((s) => s.skill),
    ];
    const lines = resume.split("\n").filter((l) => l.trim());
    const nameGuess = lines[0]?.replace(/[|–—·•,]/g, " ").trim().split(/\s{2,}/)[0] || "YOUR NAME";

    return `${nameGuess.toUpperCase()}
${"=".repeat(nameGuess.length + 4)}

CONTACT
-------
[Phone] | [Email] | [City, State] | [LinkedIn URL]

PROFESSIONAL SUMMARY
---------------------
Results-driven professional with demonstrated expertise in ${matchedSkills.slice(0, 3).join(", ").toLowerCase() || "key industry areas"}. Proven track record of delivering impact through ${matchedSkills.slice(3, 5).join(" and ").toLowerCase() || "cross-functional collaboration"}. Seeking to leverage skills in a ${jobDesc.split("\n")[0]?.trim().substring(0, 60) || "new role"}.

CORE COMPETENCIES
-----------------
${allSkills.map((s) => `• ${s}`).join("\n")}

PROFESSIONAL EXPERIENCE
-----------------------
[Most Recent Job Title]
[Company Name] | [City, State] | [Start Date] – [End Date]
${matchedSkills.slice(0, 3).map((s) => `• Leveraged ${s.toLowerCase()} expertise to drive measurable outcomes`).join("\n")}
• [Add 2-3 more quantified accomplishments]

[Previous Job Title]
[Company Name] | [City, State] | [Start Date] – [End Date]
${matchedSkills.slice(3, 5).map((s) => `• Applied ${s.toLowerCase()} skills to support team objectives`).join("\n")}
• [Add 2-3 more quantified accomplishments]

EDUCATION
---------
[Degree] in [Field of Study]
[University Name] | [Graduation Year]

CERTIFICATIONS
--------------
${analysis.gaps.slice(0, 3).map((g) => `• [Relevant ${g.area} certification — consider obtaining]`).join("\n") || "• [Add relevant certifications]"}
`;
  };

  const handleDownloadATS = () => {
    const content = getATSContent();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ats-resume.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ATS resume downloaded!");
  };

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const content = getATSContent();
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 50;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const lines = doc.splitTextToSize(content, pageWidth);
    let y = margin;
    const lineHeight = 14;

    for (const line of lines) {
      if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      const isHeader = line === line.toUpperCase() && line.trim().length > 2 && !line.startsWith("[") && !line.startsWith("•");
      doc.setFont("helvetica", isHeader ? "bold" : "normal");
      doc.setFontSize(isHeader ? 12 : 10);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    doc.save("ats-resume.pdf");
    toast.success("PDF resume downloaded!");
  };

  const handleDownloadDocx = async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
    const { saveAs } = await import("file-saver");
    const content = getATSContent();
    const paragraphs = content.split("\n").map((line) => {
      const trimmed = line.trim();
      const isHeading = trimmed === trimmed.toUpperCase() && trimmed.length > 2 && !trimmed.startsWith("[") && !trimmed.startsWith("•") && !trimmed.startsWith("=") && !trimmed.startsWith("-");
      const isDivider = /^[=-]+$/.test(trimmed);
      if (isDivider) return new Paragraph({ text: "" });
      if (isHeading) {
        return new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: trimmed, bold: true, size: 24 })],
          spacing: { before: 200, after: 100 },
        });
      }
      return new Paragraph({
        children: [new TextRun({ text: line, size: 20 })],
        spacing: { after: 40 },
      });
    });

    const doc = new Document({
      sections: [{ children: paragraphs }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "ats-resume.docx");
    toast.success("Word document downloaded!");
  };

  const handleCopyATS = () => {
    const content = getATSContent();
    navigator.clipboard.writeText(content);
    toast.success("ATS resume copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 gradient-teal rounded-lg flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-bold text-primary">Job Seeker Fit Analyzer</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {step === "result" && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                Analyze Another Role
              </Button>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* STEP: Input */}
        {step === "input" && (
          <div className="animate-fade-up">
            <div className="text-center mb-10">
              <h1 className="font-display text-4xl font-bold text-primary mb-3">
                How do you <span className="text-gradient-teal">stack up?</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Paste a job description and your resume. Get your exact fit score, gaps, and a personalized roadmap in seconds.
              </p>
            </div>

            {/* Optional links row */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-accent" /> Job Posting URL <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    className="bg-card border-border focus:border-accent text-sm flex-1"
                    placeholder="https://company.com/jobs/..."
                    value={jobLink}
                    onChange={(e) => setJobLink(e.target.value)}
                    type="url"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!jobLink.trim() || isFetchingJob}
                    onClick={handleFetchJobLink}
                    className="shrink-0"
                  >
                    {isFetchingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="ml-1.5">Fetch</span>
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <Linkedin className="w-3.5 h-3.5 text-accent" /> Your LinkedIn Profile <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    className="bg-card border-border focus:border-accent text-sm flex-1"
                    placeholder="https://linkedin.com/in/your-name"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    type="url"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!linkedinUrl.trim() || isFetchingLinkedin}
                    onClick={handleFetchLinkedin}
                    className="shrink-0"
                  >
                    {isFetchingLinkedin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="ml-1.5">Fetch</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-primary">Job Description</label>
                  <button
                    className="text-xs text-accent hover:underline"
                    onClick={() => setJobDesc(EXAMPLE_JOB)}
                  >
                    Use example
                  </button>
                </div>
                <Textarea
                  className="h-72 resize-none bg-card border-border focus:border-accent text-sm leading-relaxed"
                  placeholder="Paste the full job description here — requirements, responsibilities, and all..."
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{jobDesc.length} characters</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-primary">Your Resume / Profile</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      disabled={isUploadingResume}
                      onClick={() => resumeFileRef.current?.click()}
                    >
                      {isUploadingResume ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                      Upload PDF/Word
                    </Button>
                    <input
                      ref={resumeFileRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleResumeUpload}
                    />
                    <button
                      className="text-xs text-accent hover:underline"
                      onClick={() => setResume(EXAMPLE_RESUME)}
                    >
                      Use example
                    </button>
                  </div>
                </div>
                <Textarea
                  className="h-72 resize-none bg-card border-border focus:border-accent text-sm leading-relaxed"
                  placeholder="Paste your resume, LinkedIn summary, or profile text here..."
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{resume.length} characters</p>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                className="gradient-teal text-white font-semibold text-lg px-12 py-6 rounded-xl shadow-teal hover:opacity-90 transition-opacity"
                disabled={!jobDesc.trim() || !resume.trim() || isAnalyzing}
                onClick={handleAnalyze}
              >
                {isAnalyzing ? (
                  <>
                    <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing your fit…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Analyze My Fit
                  </>
                )}
              </Button>
            </div>

            {isAnalyzing && (
              <div className="mt-8 max-w-sm mx-auto">
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full gradient-teal rounded-full animate-pulse" style={{ width: "60%" }} />
                </div>
                <p className="text-center text-muted-foreground text-sm mt-3">
                  Matching skills and identifying gaps…
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP: Results */}
        {step === "result" && analysis && (
          <div className="animate-fade-up space-y-8">
            {/* Score header */}
            <div
              className="rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-8"
              style={{ background: "var(--gradient-hero)" }}
            >
              <div className="flex-shrink-0">
                <ScoreRingInline score={analysis.overallScore} size={160} />
              </div>
              <div className="text-center md:text-left">
                <p className="text-white/50 text-sm font-medium uppercase tracking-widest mb-2">Overall Fit Score</p>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{analysis.summary}</h2>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {analysis.strengths.map((s) => (
                    <Badge key={s} className="bg-teal-500/20 text-teal-300 border-teal-500/30 font-medium">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Links bar */}
            {(jobLink || linkedinUrl) && (
              <div className="flex flex-wrap gap-3">
                {jobLink && (
                  <a
                    href={jobLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:border-accent hover:text-accent transition-colors"
                  >
                    <Link2 className="w-4 h-4" /> View Job Posting <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}
                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm font-medium text-foreground hover:border-accent hover:text-accent transition-colors"
                  >
                    <Linkedin className="w-4 h-4" /> View LinkedIn Profile <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}
              </div>
            )}

            {/* Skills grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Matched skills */}
              <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
                <h3 className="font-display font-bold text-primary text-lg mb-5 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" /> Skills You Have
                </h3>
                <div className="space-y-4">
                  {analysis.matchedSkills.filter((s) => s.matched).map((s) => (
                    <div key={s.skill}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium text-foreground">{s.skill}</span>
                        <span className="text-xs text-success font-semibold">{s.confidence}%</span>
                      </div>
                      <AnimatedBar value={s.confidence} />
                    </div>
                  ))}
                  {analysis.matchedSkills.filter((s) => s.matched).length === 0 && (
                    <p className="text-muted-foreground text-sm">No direct skill matches detected. Consider adding relevant keywords to your resume.</p>
                  )}
                </div>
              </div>

              {/* Missing skills */}
              <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
                <h3 className="font-display font-bold text-primary text-lg mb-5 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-destructive" /> Skills to Develop
                </h3>
                <div className="space-y-3">
                  {analysis.matchedSkills.filter((s) => !s.matched).slice(0, 6).map((s) => (
                    <div key={s.skill} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm font-medium text-foreground">{s.skill}</span>
                      <Badge variant="outline" className="text-xs text-muted-foreground">Missing</Badge>
                    </div>
                  ))}
                  {analysis.matchedSkills.filter((s) => !s.matched).length === 0 && (
                    <p className="text-success text-sm font-medium">You cover all detected skills!</p>
                  )}
                </div>
              </div>
            </div>

            {/* Gap Analysis */}
            {analysis.gaps.length > 0 && (
              <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
                <h3 className="font-display font-bold text-primary text-lg mb-5 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" /> Gap Analysis
                </h3>
                <div className="space-y-4">
                  {analysis.gaps.map((gap) => (
                    <div
                      key={gap.area}
                      className={`rounded-xl p-4 border ${severityBg[gap.severity]}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {gap.severity === "critical" ? (
                            <AlertTriangle className={`w-4 h-4 ${severityColor[gap.severity]}`} />
                          ) : (
                            <ChevronRight className={`w-4 h-4 ${severityColor[gap.severity]}`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-semibold ${severityColor[gap.severity]}`}>{gap.area}</span>
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize ${
                                gap.severity === "critical"
                                  ? "border-destructive/30 text-destructive"
                                  : gap.severity === "moderate"
                                  ? "border-warning/30 text-warning"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {gap.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed mb-2">{gap.action}</p>
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                            <Lightbulb className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                            <p className="text-xs text-accent leading-relaxed flex-1">
                              Already have {gap.area.toLowerCase()} experience? Add it to your profile to improve your match.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 shrink-0 border-accent/30 text-accent hover:bg-accent/10"
                              disabled={isAnalyzing}
                              onClick={() => handleAddExperience(gap.area)}
                            >
                              {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                              I have this
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Improvement Roadmap */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
              <h3 className="font-display font-bold text-primary text-lg mb-6 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-accent" /> Your Improvement Roadmap
              </h3>
              <div className="relative">
                <div className="absolute left-5 top-2 bottom-2 w-px bg-border" />
                <div className="space-y-6">
                  {analysis.improvementPlan.map((item, i) => (
                    <div key={i} className="flex gap-5">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full gradient-teal flex items-center justify-center text-white font-bold text-sm shadow-teal">
                          {i + 1}
                        </div>
                      </div>
                      <div className="pt-1.5">
                        <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-1">{item.week}</div>
                        <p className="text-sm text-foreground leading-relaxed">{item.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ATS Resume Rewrite & Export */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-bold text-primary text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent" /> ATS-Optimized Resume
                </h3>
                <Button
                  size="sm"
                  className="gradient-teal text-white shadow-teal hover:opacity-90 text-sm"
                  disabled={isRewriting}
                  onClick={handleAIRewrite}
                >
                  {isRewriting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Rewriting…</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-1.5" /> {aiResume ? "Rewrite Again" : "AI Rewrite"}</>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                {aiResume
                  ? "Your resume has been intelligently rewritten by AI to maximize ATS compatibility for this role."
                  : "Click \"AI Rewrite\" to have AI intelligently rewrite your resume for this job, or use the template below."}
              </p>
              <div className="bg-muted/50 rounded-xl p-4 border border-border mb-4 max-h-72 overflow-y-auto">
                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {getATSContent()}
                </pre>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={handleCopyATS} className="text-sm">
                  <Copy className="w-4 h-4 mr-1.5" /> Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadATS} className="text-sm">
                  <Download className="w-4 h-4 mr-1.5" /> .txt
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="text-sm">
                  <FileText className="w-4 h-4 mr-1.5" /> .pdf
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadDocx} className="text-sm">
                  <FileText className="w-4 h-4 mr-1.5" /> .docx
                </Button>
              </div>
            </div>

            {/* CTA */}
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleReset}>
                Analyze Another Role
              </Button>
              <Button
                className="gradient-teal text-white shadow-teal hover:opacity-90"
                onClick={() => navigate("/hiring-manager")}
              >
                Switch to Hiring Manager View
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
