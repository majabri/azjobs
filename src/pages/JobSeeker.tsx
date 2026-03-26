import { useState, useCallback } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { analyzeJobFit, type FitAnalysis } from "@/lib/analysisEngine";
import AnalysisForm from "@/components/job-seeker/AnalysisForm";
import AnalysisResults from "@/components/job-seeker/AnalysisResults";
import { supabase } from "@/integrations/supabase/client";

type Step = "input" | "result";

function useDemoMode() {
  const [searchParams] = useSearchParams();
  return searchParams.get("demo") === "true";
}

export default function JobSeekerPage() {
  const isDemo = useDemoMode();
  const location = useLocation();
  const navState = location.state as { prefillJob?: string; prefillJobLink?: string } | null;
  const [step, setStep] = useState<Step>("input");
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentJobDesc, setCurrentJobDesc] = useState("");
  const [currentResume, setCurrentResume] = useState("");
  const [currentJobLink, setCurrentJobLink] = useState("");

  const handleAnalyze = useCallback(async (jobDesc: string, resume: string, jobLink: string) => {
    if (!jobDesc.trim() || !resume.trim()) return;
    setIsAnalyzing(true);
    setCurrentJobDesc(jobDesc);
    setCurrentResume(resume);
    setCurrentJobLink(jobLink);

    setTimeout(async () => {
      const result = analyzeJobFit(jobDesc, resume);
      setAnalysis(result);
      setStep("result");
      setIsAnalyzing(false);

      if (!isDemo) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const firstLine = jobDesc.trim().split("\n")[0] || "";
            const titleMatch = firstLine.match(/^(.+?)(?:\s*[—–-]\s*|$)/);
            const jobTitle = titleMatch?.[1]?.trim().slice(0, 100) || "Untitled Role";
            await supabase.from("analysis_history").insert({
              user_id: session.user.id,
              job_title: jobTitle,
              job_description: jobDesc.slice(0, 5000),
              resume_text: resume.slice(0, 5000),
              overall_score: result.overallScore,
              matched_skills: result.matchedSkills as any,
              gaps: result.gaps as any,
              strengths: result.strengths as any,
              improvement_plan: result.improvementPlan as any,
              summary: result.summary,
            } as any);
          }
        } catch (e) { console.error("Failed to save analysis:", e); }
      }
    }, 1500);
  }, [isDemo]);

  const handleReset = () => {
    setStep("input");
    setAnalysis(null);
  };

  const handleReEvaluate = () => {
    // Re-run analysis with current job desc and resume
    handleAnalyze(currentJobDesc, currentResume, currentJobLink);
  };

  return (
    <div className="bg-background">
      <main className="max-w-5xl mx-auto px-6 py-8">
        {step === "input" && (
          <AnalysisForm
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            isDemo={isDemo}
            prefillJob={navState?.prefillJob}
            prefillJobLink={navState?.prefillJobLink}
          />
        )}
        {step === "result" && analysis && (
          <AnalysisResults
            analysis={analysis}
            jobDesc={currentJobDesc}
            resume={currentResume}
            jobLink={currentJobLink}
            isDemo={isDemo}
            onReset={handleReset}
            onReEvaluate={handleReEvaluate}
          />
        )}
      </main>
    </div>
  );
}
