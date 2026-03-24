import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target, Sparkles, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Lightbulb, Link2, Linkedin, ExternalLink, Download, Loader2, Upload, FileText, Copy, Mail, User, Plus } from "lucide-react";
import { analyzeJobFit, type FitAnalysis } from "@/lib/analysisEngine";
import { ScoreRingInline, AnimatedBar } from "@/components/ScoreDisplay";
import { scrapeUrl } from "@/lib/api/scrapeUrl";
import { parseDocument } from "@/lib/api/parseDocument";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import { computeDiff, type DiffSegment } from "@/lib/diffUtils";
import { supabase } from "@/integrations/supabase/client";
import ApplicationToolkit from "@/components/ApplicationToolkit";

const DEMO_JOB = `Senior Cybersecurity Engineer — Cloud Security

We're looking for an experienced Cybersecurity Engineer to lead our cloud security initiatives.

Requirements:
- 5+ years of cybersecurity experience
- Strong knowledge of cloud security (AWS, Azure, or GCP)
- Experience with SIEM tools and security operations
- Familiarity with compliance frameworks (NIST, ISO 27001, SOC 2)
- Incident response and threat detection skills
- Experience with vulnerability management and penetration testing
- Strong communication and documentation skills
- CISSP, CISM, or equivalent certification preferred
- Experience with zero trust architecture
- Knowledge of identity and access management (IAM)`;

const DEMO_RESUME = `Alex Morgan | Cybersecurity Professional
alex.morgan@email.com | (555) 123-4567 | San Francisco, CA

PROFESSIONAL SUMMARY
Results-driven cybersecurity professional with 6+ years of experience in information security, cloud security, and compliance. Proven track record in vulnerability management, incident response, and security architecture. CISSP certified with deep expertise in AWS and Azure security.

WORK EXPERIENCE

Senior Security Analyst at CloudDefend Inc (3 years)
- Led cloud security assessments across AWS and Azure environments
- Implemented SIEM monitoring using Splunk, reducing incident response time by 40%
- Managed vulnerability scanning program covering 2,000+ assets
- Developed security policies aligned with NIST CSF and ISO 27001
- Conducted threat intelligence analysis and created detection rules

Security Engineer at TechSecure Corp (2.5 years)
- Performed penetration testing on web applications and APIs
- Designed and implemented zero trust network architecture
- Managed IAM policies for 500+ users across multi-cloud environment
- Led incident response for 15+ security incidents
- Created security awareness training program

Junior Security Analyst at DataShield (1 year)
- Monitored SOC alerts and escalated security incidents
- Assisted with compliance audits (SOC 2, PCI DSS)
- Maintained firewall rules and access control lists

CERTIFICATIONS
CISSP, CompTIA Security+, AWS Certified Security Specialty

SKILLS
Cloud Security, AWS, Azure, SIEM, Splunk, Vulnerability Management, Penetration Testing, Incident Response, Threat Detection, NIST, ISO 27001, SOC 2, IAM, Zero Trust, Firewalls, Python, Bash

EDUCATION
B.S. Computer Science — University of California, Berkeley (2017)`;

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

// Check if we're in demo mode (no auth required)
function useDemoMode() {
  const [searchParams] = useSearchParams();
  return searchParams.get("demo") === "true";
}

interface ResumeVersionOption {
  id: string;
  version_name: string;
  job_type: string;
  resume_text: string;
}

export default function JobSeekerPage() {
  const navigate = useNavigate();
  const isDemo = useDemoMode();
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
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [coverTone, setCoverTone] = useState<"professional" | "conversational" | "enthusiastic">("professional");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersionOption[]>([]);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [addingSkill, setAddingSkill] = useState<string | null>(null);
  const resumeFileRef = useRef<HTMLInputElement>(null);

  // Check for prefilled job description from Job Search or demo mode
  useEffect(() => {
    const state = window.history.state?.usr;
    if (state?.prefillJob) {
      setJobDesc(state.prefillJob);
    }
    if (isDemo && !resume && !jobDesc) {
      setJobDesc(DEMO_JOB);
      setResume(DEMO_RESUME);
    }
  }, [isDemo]);

  const diffResult = useMemo(() => {
    if (!aiResume || !resume) return { original: [], modified: [] };
    return computeDiff(resume, aiResume);
  }, [resume, aiResume]);

  const syncSkillsToProfile = async (resumeText: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { extractProfileFromResume } = await import("@/lib/analysisEngine");
      const extracted = extractProfileFromResume(resumeText);
      if (!extracted.skills.length) return;

      // Merge with existing profile
      const { data } = await supabase
        .from("job_seeker_profiles")
        .select("skills, certifications")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const currentSkills = (data?.skills as string[]) || [];
      const normalizedCurrent = currentSkills.map((s) => s.toLowerCase());
      const newSkills = extracted.skills.filter((s) => !normalizedCurrent.includes(s.toLowerCase()));

      const currentCerts = (data?.certifications as string[]) || [];
      const normalizedCerts = currentCerts.map((c) => c.toLowerCase());
      const newCerts = extracted.certifications.filter((c) => !normalizedCerts.includes(c.toLowerCase()));

      const updatePayload: Record<string, any> = {
        user_id: session.user.id,
        updated_at: new Date().toISOString(),
      };

      if (newSkills.length) updatePayload.skills = [...currentSkills, ...newSkills];
      if (newCerts.length) updatePayload.certifications = [...currentCerts, ...newCerts];
      if (extracted.careerLevel) updatePayload.career_level = extracted.careerLevel;
      if (extracted.jobTitles.length) updatePayload.target_job_titles = extracted.jobTitles;

      const { error } = await supabase
        .from("job_seeker_profiles")
        .upsert(updatePayload as any, { onConflict: "user_id" });

      if (error) throw error;

      const messages: string[] = [];
      if (newSkills.length) messages.push(`${newSkills.length} skill${newSkills.length > 1 ? "s" : ""}`);
      if (newCerts.length) messages.push(`${newCerts.length} certification${newCerts.length > 1 ? "s" : ""}`);
      if (extracted.careerLevel) messages.push(`career level: ${extracted.careerLevel}`);
      if (extracted.jobTitles.length) messages.push(`${extracted.jobTitles.length} job title${extracted.jobTitles.length > 1 ? "s" : ""}`);

      if (messages.length) {
        toast.success(`Profile updated: ${messages.join(", ")}`, { duration: 5000 });
      } else {
        toast.info("All detected skills are already in your profile");
      }
    } catch (e) {
      console.error("Skill sync error:", e);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingResume(true);
    try {
      const result = await parseDocument(file);
      if (result.success && result.text) {
        setResume(result.text);
        toast.success("Resume extracted successfully!");
        // Auto-sync extracted skills to profile
        syncSkillsToProfile(result.text);
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

  const handleLoadFromProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      // Load resume versions
      const { data: versionData } = await (supabase.from("resume_versions" as any) as any)
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (versionData?.length) {
        setResumeVersions(versionData.map((v: any) => ({
          id: v.id,
          version_name: v.version_name,
          job_type: v.job_type || "",
          resume_text: v.resume_text,
        })));
        setShowVersionPicker(true);
        setIsLoadingProfile(false);
        return;
      }

      // No versions, load default profile
      await loadDefaultProfile(session.user.id);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load profile");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadDefaultProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("job_seeker_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      toast.error("No profile found. Create one first!", { action: { label: "Go to Profile", onClick: () => navigate("/profile") } });
      return;
    }
    const lines: string[] = [];
    if (data.full_name) lines.push(data.full_name);
    const contact = [data.email, data.phone, data.location].filter(Boolean).join(" | ");
    if (contact) lines.push(contact);
    if (data.summary) { lines.push(""); lines.push("PROFESSIONAL SUMMARY"); lines.push(data.summary); }
    const skills = data.skills as string[] | null;
    if (skills?.length) { lines.push(""); lines.push("SKILLS"); lines.push(skills.join(", ")); }
    const workExp = data.work_experience as unknown as { title: string; company: string; startDate?: string; endDate?: string; description?: string }[] | null;
    if (workExp?.length) {
      lines.push(""); lines.push("WORK EXPERIENCE");
      workExp.forEach((w) => {
        lines.push(`${w.title} at ${w.company}${w.startDate ? ` (${w.startDate} – ${w.endDate || "Present"})` : ""}`);
        if (w.description) lines.push(w.description);
        lines.push("");
      });
    }
    const edu = data.education as unknown as { degree: string; institution: string; year?: string }[] | null;
    if (edu?.length) {
      lines.push("EDUCATION");
      edu.forEach((e) => lines.push(`${e.degree} — ${e.institution}${e.year ? ` (${e.year})` : ""}`));
    }
    const certs = data.certifications as string[] | null;
    if (certs?.length) { lines.push(""); lines.push("CERTIFICATIONS"); certs.forEach((c) => lines.push(`• ${c}`)); }
    setResume(lines.join("\n"));
    toast.success("Profile loaded into resume field!");
  };

  const handleSelectVersion = (version: ResumeVersionOption) => {
    setResume(version.resume_text);
    setShowVersionPicker(false);
    toast.success(`Loaded "${version.version_name}" resume version!`);
  };

  const handleLoadDefaultFromPicker = async () => {
    setShowVersionPicker(false);
    setIsLoadingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await loadDefaultProfile(session.user.id);
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleAddSkillToProfile = async (skill: string) => {
    setAddingSkill(skill);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const { data } = await supabase
        .from("job_seeker_profiles")
        .select("skills")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const currentSkills = (data?.skills as string[]) || [];
      if (currentSkills.includes(skill)) {
        toast.info(`"${skill}" is already in your profile`);
        return;
      }
      const { error } = await supabase
        .from("job_seeker_profiles")
        .upsert({
          user_id: session.user.id,
          skills: [...currentSkills, skill],
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success(`"${skill}" added to your profile!`);
    } catch {
      toast.error("Failed to add skill to profile");
    } finally {
      setAddingSkill(null);
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
    setTimeout(async () => {
      const result = analyzeJobFit(jobDesc, resume);
      setAnalysis(result);
      setStep("result");
      setIsAnalyzing(false);

      // Save analysis to history (only for authenticated users)
      if (!isDemo) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // Try to extract job title from first line of job description
            const firstLine = jobDesc.trim().split("\n")[0] || "";
            const titleMatch = firstLine.match(/^(.+?)(?:\s*[—–-]\s*|$)/);
            const jobTitle = titleMatch?.[1]?.trim().slice(0, 100) || "Untitled Role";

            await (supabase.from("analysis_history" as any) as any).insert({
              user_id: session.user.id,
              job_title: jobTitle,
              job_description: jobDesc.slice(0, 5000),
              resume_text: resume.slice(0, 5000),
              overall_score: result.overallScore,
              matched_skills: result.matchedSkills,
              gaps: result.gaps,
              strengths: result.strengths,
              improvement_plan: result.improvementPlan,
              summary: result.summary,
            });
          }
        } catch (e) {
          console.error("Failed to save analysis:", e);
        }
      }
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
    setCoverLetter("");
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Please sign in to use AI rewrite");
        setIsRewriting(false);
        return;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rewrite-resume`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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
      toast.success("Resume optimized with AI!");

      // Save optimized resume to analysis history
      if (!isDemo) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // Update the most recent analysis with optimized resume
            const { data: recent } = await (supabase.from("analysis_history" as any) as any)
              .select("id")
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false })
              .limit(1);
            if (recent?.[0]) {
              await (supabase.from("analysis_history" as any) as any)
                .update({ optimized_resume: full })
                .eq("id", recent[0].id);
            }
          }
        } catch (e) {
          console.error("Failed to save optimized resume:", e);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to optimize resume");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!analysis) return;
    setIsGeneratingCover(true);
    setCoverLetter("");

    const matchedSkills = analysis.matchedSkills.filter((s) => s.matched).map((s) => s.skill);
    const gaps = analysis.gaps.map((g) => g.area);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Please sign in to use cover letter generator");
        setIsGeneratingCover(false);
        return;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover-letter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ resume, jobDescription: jobDesc, matchedSkills, gaps, tone: coverTone }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed to generate cover letter" }));
        toast.error(err.error || "Failed to generate cover letter");
        setIsGeneratingCover(false);
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
              setCoverLetter(full);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      toast.success("Cover letter generated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate cover letter");
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleCopyCoverLetter = () => {
    navigator.clipboard.writeText(coverLetter);
    toast.success("Cover letter copied to clipboard!");
  };

  const handleDownloadCoverLetter = () => {
    const blob = new Blob([coverLetter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Cover letter downloaded!");
  };

  const handleDownloadCoverLetterPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 50;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const lines = doc.splitTextToSize(coverLetter, pageWidth);
    let y = margin;
    const lineHeight = 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    for (const line of lines) {
      if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    doc.save("cover-letter.pdf");
    toast.success("Cover letter PDF downloaded!");
  };

  const handleDownloadCoverLetterDocx = async () => {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const { saveAs } = await import("file-saver");
    const paragraphs = coverLetter.split("\n").map((line) =>
      new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { after: 80 },
      })
    );
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "cover-letter.docx");
    toast.success("Cover letter Word document downloaded!");
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
                      disabled={isLoadingProfile}
                      onClick={handleLoadFromProfile}
                    >
                      {isLoadingProfile ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <User className="w-3 h-3 mr-1" />}
                      Load from Profile
                    </Button>
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

            {/* Resume Version Picker */}
            {showVersionPicker && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                  <h3 className="font-display font-bold text-primary text-lg mb-4">Choose a Resume Version</h3>
                  <div className="space-y-2 mb-4">
                    <button
                      className="w-full text-left p-3 rounded-xl border border-border hover:border-accent transition-colors"
                      onClick={handleLoadDefaultFromPicker}
                    >
                      <span className="font-medium text-foreground">Default Profile</span>
                      <p className="text-xs text-muted-foreground">Generated from your profile data</p>
                    </button>
                    {resumeVersions.map((v) => (
                      <button
                        key={v.id}
                        className="w-full text-left p-3 rounded-xl border border-border hover:border-accent transition-colors"
                        onClick={() => handleSelectVersion(v)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{v.version_name}</span>
                          {v.job_type && <Badge variant="outline" className="text-xs capitalize">{v.job_type}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{v.resume_text.slice(0, 80)}...</p>
                      </button>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowVersionPicker(false)}>Cancel</Button>
                </div>
              </div>
            )}
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

            {/* Application Toolkit */}
            <ApplicationToolkit
              jobLink={jobLink}
              jobDesc={jobDesc}
              resume={resume}
              coverLetter={coverLetter}
              aiResume={aiResume}
              overallScore={analysis.overallScore}
            />

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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 border-accent/30 text-accent hover:bg-accent/10"
                          disabled={addingSkill === s.skill}
                          onClick={() => handleAddSkillToProfile(s.skill)}
                        >
                          {addingSkill === s.skill ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                          Add to Profile
                        </Button>
                        <Badge variant="outline" className="text-xs text-muted-foreground">Missing</Badge>
                      </div>
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
                  <FileText className="w-5 h-5 text-accent" /> Optimize My Resume
                </h3>
                <Button
                  size="sm"
                  className="gradient-teal text-white shadow-teal hover:opacity-90 text-sm"
                  disabled={isRewriting || isDemo}
                  onClick={handleAIRewrite}
                  title={isDemo ? "Sign up to use AI optimization" : ""}
                >
                  {isRewriting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Optimizing…</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-1.5" /> {aiResume ? "Re-Optimize" : "Optimize My Resume"}</>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                {isDemo
                  ? "Sign up to unlock AI-powered resume optimization tailored for this exact role."
                  : aiResume
                  ? "Your resume has been AI-optimized for maximum ATS compatibility with this role."
                  : "Click \"Optimize My Resume\" to have AI rewrite your resume for maximum ATS compatibility."}
              </p>

              {/* Side-by-side comparison when AI rewrite is available */}
              {aiResume ? (
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Original Resume</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">Removed</span>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 border border-border max-h-80 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                        {diffResult.original.map((seg, i) => (
                          <span
                            key={i}
                            className={seg.type === "removed" ? "bg-destructive/15 text-destructive line-through decoration-destructive/40" : "text-muted-foreground"}
                          >{seg.text}</span>
                        ))}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-xs font-semibold text-accent uppercase tracking-wider">AI-Rewritten (ATS-Optimized)</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Added</span>
                    </div>
                    <div className="bg-accent/5 rounded-xl p-4 border border-accent/20 max-h-80 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                        {diffResult.modified.map((seg, i) => (
                          <span
                            key={i}
                            className={seg.type === "added" ? "bg-accent/15 text-accent font-medium" : "text-foreground"}
                          >{seg.text}</span>
                        ))}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-xl p-4 border border-border mb-4 max-h-72 overflow-y-auto">
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {getATSContent()}
                  </pre>
                </div>
              )}

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

            {/* Cover Letter Generator */}
            <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-bold text-primary text-lg flex items-center gap-2">
                  <Mail className="w-5 h-5 text-accent" /> AI Cover Letter
                </h3>
                <Button
                  size="sm"
                  className="gradient-teal text-white shadow-teal hover:opacity-90 text-sm"
                  disabled={isGeneratingCover}
                  onClick={handleGenerateCoverLetter}
                >
                  {isGeneratingCover ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Generating…</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-1.5" /> {coverLetter ? "Regenerate" : "Generate Cover Letter"}</>
                  )}
                </Button>
              </div>

              {/* Tone selector */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground font-medium">Tone:</span>
                {(["professional", "conversational", "enthusiastic"] as const).map((tone) => (
                  <Button
                    key={tone}
                    variant={coverTone === tone ? "default" : "outline"}
                    size="sm"
                    className={`text-xs capitalize ${coverTone === tone ? "gradient-teal text-white" : ""}`}
                    onClick={() => setCoverTone(tone)}
                    disabled={isGeneratingCover}
                  >
                    {tone}
                  </Button>
                ))}
              </div>

              <p className="text-sm text-muted-foreground mb-5">
                {coverLetter
                  ? "Your cover letter has been tailored to this specific role based on your resume and the job requirements."
                  : "Generate a personalized cover letter that highlights your strengths and addresses the job requirements."}
              </p>

              {coverLetter && (
                <>
                  <div className="bg-muted/30 rounded-xl p-5 border border-border mb-4 max-h-80 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground">
                      {coverLetter}
                    </pre>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="sm" onClick={handleCopyCoverLetter} className="text-sm">
                      <Copy className="w-4 h-4 mr-1.5" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadCoverLetter} className="text-sm">
                      <Download className="w-4 h-4 mr-1.5" /> .txt
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadCoverLetterPDF} className="text-sm">
                      <FileText className="w-4 h-4 mr-1.5" /> .pdf
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadCoverLetterDocx} className="text-sm">
                      <FileText className="w-4 h-4 mr-1.5" /> .docx
                    </Button>
                  </div>
                </>
              )}
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
