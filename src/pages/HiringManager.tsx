import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  HelpCircle,
  Linkedin,
  Download,
  Loader2,
} from "lucide-react";
import { analyzeCandidates, type CandidateAnalysis } from "@/lib/analysisEngine";
import { ScoreRingInline, AnimatedBar } from "@/components/ScoreDisplay";
import { scrapeUrl } from "@/lib/api/scrapeUrl";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";

const EXAMPLE_JOB = `Senior Data Analyst — FinTech

We're hiring a Senior Data Analyst to join our risk team.

Requirements:
- 4+ years of data analysis experience  
- Advanced SQL and Python skills
- Experience with Tableau or Power BI
- Knowledge of machine learning basics
- Strong communication and leadership skills
- Agile / Scrum experience
- Finance or banking industry background preferred`;

const EXAMPLE_CANDIDATES = [
  {
    name: "Sarah Chen",
    resumeText: `Senior Data Analyst, 5 years experience. Expert in SQL, Python, and Tableau. 
Led analytics team of 4 at a fintech startup. Machine learning projects using scikit-learn. 
Strong communication skills, Agile team member. Finance background from investment bank.`,
  },
  {
    name: "Marcus Johnson",
    resumeText: `Data Analyst, 3 years experience. Proficient in SQL and Excel. 
Some Python scripting. Used Power BI for reporting. 
No formal leadership experience. E-commerce background.`,
  },
  {
    name: "Priya Patel",
    resumeText: `Data Scientist, 6 years experience. Python and machine learning expert. 
PhD in Statistics. Published researcher. 
Limited SQL experience. No industry-specific finance background. Strong communication.`,
  },
];

interface CandidateInput {
  id: string;
  name: string;
  resumeText: string;
  linkedinUrl: string;
}

type Step = "input" | "result";

const recommendationConfig = {
  interview: {
    label: "Recommend Interview",
    icon: UserCheck,
    badgeClass: "bg-success/10 text-success border-success/20",
    ringColor: "text-success",
  },
  maybe: {
    label: "Consider",
    icon: HelpCircle,
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    ringColor: "text-warning",
  },
  pass: {
    label: "Pass",
    icon: UserX,
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    ringColor: "text-destructive",
  },
};

export default function HiringManagerPage() {
  const navigate = useNavigate();
  const [jobDesc, setJobDesc] = useState("");
  const [candidates, setCandidates] = useState<CandidateInput[]>([
    { id: "1", name: "", resumeText: "", linkedinUrl: "" },
  ]);
  const [step, setStep] = useState<Step>("input");
  const [results, setResults] = useState<CandidateAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateAnalysis | null>(null);

  const addCandidate = () => {
    if (candidates.length >= 8) return;
    setCandidates((prev) => [...prev, { id: Date.now().toString(), name: "", resumeText: "", linkedinUrl: "" }]);
  };

  const removeCandidate = (id: string) => {
    if (candidates.length === 1) return;
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCandidate = (id: string, field: "name" | "resumeText" | "linkedinUrl", value: string) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const [fetchingLinkedin, setFetchingLinkedin] = useState<Record<string, boolean>>({});

  const handleFetchLinkedin = async (candidateId: string, url: string) => {
    if (!url.trim()) {
      toast.error("Please enter a LinkedIn URL first");
      return;
    }
    if (url.includes("linkedin.com")) {
      toast.error("LinkedIn profiles can't be auto-fetched due to site restrictions. Please copy & paste the profile text instead.");
      return;
    }
    setFetchingLinkedin((prev) => ({ ...prev, [candidateId]: true }));
    try {
      const result = await scrapeUrl(url);
      if (result.success && result.markdown) {
        updateCandidate(candidateId, "resumeText", result.markdown);
        toast.success("Profile fetched successfully");
      } else {
        toast.error(result.error || "Could not extract content from URL");
      }
    } catch {
      toast.error("Failed to fetch profile");
    } finally {
      setFetchingLinkedin((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  const loadExamples = () => {
    setJobDesc(EXAMPLE_JOB);
    setCandidates(
      EXAMPLE_CANDIDATES.map((c, i) => ({ id: String(i + 1), name: c.name, resumeText: c.resumeText, linkedinUrl: "" }))
    );
  };

  const handleAnalyze = () => {
    const validCandidates = candidates.filter((c) => c.name.trim() && c.resumeText.trim());
    if (!jobDesc.trim() || validCandidates.length === 0) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const analyzed = analyzeCandidates(jobDesc, validCandidates);
      setResults(analyzed);
      setSelectedCandidate(analyzed[0] ?? null);
      setStep("result");
      setIsAnalyzing(false);
    }, 1800);
  };

  const handleReset = () => {
    setStep("input");
    setResults([]);
    setJobDesc("");
    setCandidates([{ id: "1", name: "", resumeText: "", linkedinUrl: "" }]);
    setSelectedCandidate(null);
  };

  const canAnalyze =
    jobDesc.trim() && candidates.some((c) => c.name.trim() && c.resumeText.trim());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 gradient-teal rounded-lg flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-bold text-primary">Candidate Screener</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {step === "result" && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                New Screening
              </Button>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* INPUT STEP */}
        {step === "input" && (
          <div className="animate-fade-up">
            <div className="text-center mb-10">
              <h1 className="font-display text-4xl font-bold text-primary mb-3">
                Find your <span className="text-gradient-teal">best fit</span> candidates
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Paste your job description and candidate profiles. Get ranked results with fit scores and gap analysis instantly.
              </p>
              <button
                className="mt-4 text-sm text-accent hover:underline"
                onClick={loadExamples}
              >
                Load example data →
              </button>
            </div>

            <div className="grid md:grid-cols-5 gap-6 mb-8">
              {/* Job description */}
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold text-primary">Job Description</label>
                <Textarea
                  className="h-80 resize-none bg-card border-border focus:border-accent text-sm leading-relaxed"
                  placeholder="Paste the full job description including requirements…"
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                />
              </div>

              {/* Candidates */}
              <div className="md:col-span-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-primary">
                    Candidates ({candidates.length}/8)
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addCandidate}
                    disabled={candidates.length >= 8}
                    className="text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Candidate
                  </Button>
                </div>

                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {candidates.map((c, i) => (
                    <div key={c.id} className="bg-card rounded-xl border border-border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 gradient-teal rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {i + 1}
                        </div>
                        <Input
                          placeholder="Candidate name"
                          value={c.name}
                          onChange={(e) => updateCandidate(c.id, "name", e.target.value)}
                          className="h-8 text-sm font-medium"
                        />
                        {candidates.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCandidate(c.id)}
                            className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Linkedin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          placeholder="LinkedIn profile URL"
                          value={c.linkedinUrl}
                          onChange={(e) => updateCandidate(c.id, "linkedinUrl", e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 flex-shrink-0"
                          disabled={fetchingLinkedin[c.id]}
                          onClick={() => handleFetchLinkedin(c.id, c.linkedinUrl)}
                        >
                          {fetchingLinkedin[c.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Paste resume, LinkedIn summary, or profile…"
                        value={c.resumeText}
                        onChange={(e) => updateCandidate(c.id, "resumeText", e.target.value)}
                        className="h-24 resize-none text-xs leading-relaxed bg-muted/50"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                className="gradient-teal text-white font-semibold text-lg px-12 py-6 rounded-xl shadow-teal hover:opacity-90 transition-opacity"
                disabled={!canAnalyze || isAnalyzing}
                onClick={handleAnalyze}
              >
                {isAnalyzing ? (
                  <>
                    <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                    Screening candidates…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Screen All Candidates
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* RESULTS STEP */}
        {step === "result" && results.length > 0 && (
          <div className="animate-fade-up">
            <div className="mb-8 text-center">
              <h2 className="font-display text-3xl font-bold text-primary mb-2">
                Candidate Rankings
              </h2>
              <p className="text-muted-foreground">
                {results.filter((r) => r.recommendation === "interview").length} recommended for
                interview · {results.length} total screened
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Ranked list */}
              <div className="md:col-span-1 space-y-3">
                {results.map((r, i) => {
                  const cfg = recommendationConfig[r.recommendation];
                  const isSelected = selectedCandidate?.name === r.name;
                  return (
                    <button
                      key={r.name}
                      onClick={() => setSelectedCandidate(r)}
                      className={`w-full text-left bg-card rounded-xl border p-4 transition-all hover:shadow-elevated ${
                        isSelected
                          ? "border-accent shadow-teal ring-1 ring-accent/30"
                          : "border-border hover:border-accent/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0 ${
                            i === 0 ? "gradient-teal text-white shadow-teal" : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-primary truncate">{r.name}</div>
                          <Badge className={`text-xs mt-1 border ${cfg.badgeClass}`}>
                            {r.recommendation === "interview" && <UserCheck className="w-2.5 h-2.5 mr-1" />}
                            {r.recommendation === "maybe" && <Clock className="w-2.5 h-2.5 mr-1" />}
                            {r.recommendation === "pass" && <UserX className="w-2.5 h-2.5 mr-1" />}
                            {cfg.label}
                          </Badge>
                        </div>
                        <div
                          className={`text-xl font-display font-bold flex-shrink-0 ${
                            r.score >= 70
                              ? "text-success"
                              : r.score >= 45
                              ? "text-warning"
                              : "text-destructive"
                          }`}
                        >
                          {r.score}%
                        </div>
                      </div>
                      <div className="mt-3">
                        <AnimatedBar value={r.score} height="h-1.5" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detail panel */}
              {selectedCandidate && (
                <div className="md:col-span-2 space-y-5 animate-fade-in">
                  <div
                    className="rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6"
                    style={{ background: "var(--gradient-hero)" }}
                  >
                    <ScoreRingInline score={selectedCandidate.score} size={120} />
                    <div className="text-center sm:text-left">
                      <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Candidate</p>
                      <h3 className="font-display text-2xl font-bold text-white mb-2">{selectedCandidate.name}</h3>
                      <Badge
                        className={`border ${recommendationConfig[selectedCandidate.recommendation].badgeClass} text-sm px-3 py-1`}
                      >
                        {recommendationConfig[selectedCandidate.recommendation].label}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                      <h4 className="font-semibold text-primary text-sm mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success" /> Matched Skills
                      </h4>
                      <div className="space-y-3">
                        {selectedCandidate.matchedSkills.slice(0, 5).map((s) => (
                          <div key={s}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium text-foreground">{s}</span>
                              <span className="text-xs text-success">✓</span>
                            </div>
                            <AnimatedBar value={Math.floor(70 + Math.random() * 28)} height="h-1.5" />
                          </div>
                        ))}
                        {selectedCandidate.matchedSkills.length === 0 && (
                          <p className="text-muted-foreground text-xs">No strong skill matches found.</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                      <h4 className="font-semibold text-primary text-sm mb-4 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-destructive" /> Skill Gaps
                      </h4>
                      <div className="space-y-2">
                        {selectedCandidate.gaps.map((g) => (
                          <div key={g} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                            <span className="text-xs font-medium text-foreground">{g}</span>
                            <Badge variant="outline" className="text-xs text-muted-foreground">Missing</Badge>
                          </div>
                        ))}
                        {selectedCandidate.gaps.length === 0 && (
                          <p className="text-success text-xs font-medium">Full requirement coverage!</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                    <h4 className="font-semibold text-primary text-sm mb-3">Interview Decision</h4>
                    <div
                      className={`rounded-lg p-4 border ${
                        selectedCandidate.recommendation === "interview"
                          ? "bg-success/10 border-success/20 text-success"
                          : selectedCandidate.recommendation === "maybe"
                          ? "bg-warning/10 border-warning/20 text-warning"
                          : "bg-destructive/10 border-destructive/20 text-destructive"
                      }`}
                    >
                      <p className="text-sm font-medium leading-relaxed">
                        {selectedCandidate.recommendation === "interview"
                          ? `${selectedCandidate.name} meets the key requirements with a ${selectedCandidate.score}% match. Strong candidate — prioritize for interview. Focus on verifying the ${selectedCandidate.gaps[0] ?? "remaining"} skill gap.`
                          : selectedCandidate.recommendation === "maybe"
                          ? `${selectedCandidate.name} has a ${selectedCandidate.score}% fit — promising but missing some requirements. Consider a screening call to assess potential and learning speed.`
                          : `${selectedCandidate.name} currently has a ${selectedCandidate.score}% fit with ${selectedCandidate.gaps.length} skill gaps. Not recommended at this time. May be suitable for a different role or in the future.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4 mt-10">
              <Button variant="outline" onClick={handleReset}>
                New Screening
              </Button>
              <Button
                className="gradient-teal text-white shadow-teal hover:opacity-90"
                onClick={() => navigate("/job-seeker")}
              >
                Switch to Job Seeker View
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

