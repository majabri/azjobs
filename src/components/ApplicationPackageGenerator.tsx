import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Package, Copy, Download, FileText, Mail, Loader2, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

interface ApplicationPackageGeneratorProps {
  resume: string;
  aiResume: string;
  coverLetter: string;
  jobDesc: string;
  analysis: {
    overallScore: number;
    matchedSkills: { skill: string; matched: boolean }[];
    gaps: { area: string }[];
    strengths: string[];
  } | null;
}

const COMMON_QUESTIONS = [
  "Why are you interested in this role?",
  "What makes you a good fit for this position?",
  "Describe a challenging project you've worked on.",
  "What are your salary expectations?",
  "Why are you looking to leave your current position?",
];

export default function ApplicationPackageGenerator({
  resume, aiResume, coverLetter, jobDesc, analysis,
}: ApplicationPackageGeneratorProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState(false);

  const finalResume = aiResume || resume;
  const matchedSkills = analysis?.matchedSkills.filter(s => s.matched).map(s => s.skill) || [];
  const strengths = analysis?.strengths || [];

  const generateAnswers = () => {
    setGenerating(true);
    // Generate contextual answers based on resume and job
    const jobTitle = jobDesc.split("\n")[0]?.trim() || "this role";
    const companyMatch = jobDesc.match(/(?:at|@|company[:\s]*)\s*([A-Z][A-Za-z0-9 &.]+)/i);
    const company = companyMatch?.[1]?.trim() || "your company";
    const topSkills = matchedSkills.slice(0, 3).join(", ");

    const generated: Record<number, string> = {
      0: `I'm excited about ${jobTitle} because it aligns perfectly with my expertise in ${topSkills || "the key areas required"}. The opportunity to contribute to ${company}'s mission while growing professionally makes this an ideal next step in my career.`,
      1: `With my background in ${strengths.slice(0, 2).join(" and ") || "the required skill areas"}, I bring proven experience that directly maps to this role's requirements. My track record demonstrates consistent delivery in ${topSkills || "relevant competencies"}.`,
      2: `In my recent role, I led a project involving ${matchedSkills[0] || "cross-functional collaboration"} that resulted in measurable improvements. I navigated complex challenges by leveraging my ${matchedSkills[1] || "technical"} expertise and stakeholder management skills.`,
      3: `I'm flexible on compensation and focused on finding the right fit. Based on my experience level and the market, I'm targeting a range that reflects the value I bring. I'm happy to discuss specifics after learning more about the total compensation package.`,
      4: `I'm looking for a role that better leverages my strengths in ${topSkills || "my core competencies"} and offers opportunities for growth. ${jobTitle} represents exactly the kind of challenge and impact I'm seeking.`,
    };

    setAnswers(generated);
    setGenerating(false);
    toast.success("Answers generated!");
  };

  const getFullPackage = () => {
    let pkg = "═══════════════════════════════════════\n";
    pkg += "       APPLICATION PACKAGE\n";
    pkg += "═══════════════════════════════════════\n\n";

    pkg += "── TAILORED RESUME ──────────────────\n\n";
    pkg += finalResume + "\n\n";

    if (coverLetter) {
      pkg += "── COVER LETTER ─────────────────────\n\n";
      pkg += coverLetter + "\n\n";
    }

    if (Object.keys(answers).length > 0) {
      pkg += "── COMMON QUESTION ANSWERS ──────────\n\n";
      COMMON_QUESTIONS.forEach((q, i) => {
        if (answers[i]) {
          pkg += `Q: ${q}\nA: ${answers[i]}\n\n`;
        }
      });
    }

    return pkg;
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(getFullPackage());
    toast.success("Full application package copied!");
  };

  const handleDownload = () => {
    const blob = new Blob([getFullPackage()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "application-package.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Package downloaded!");
  };

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 50;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const content = getFullPackage();
    const lines = doc.splitTextToSize(content, pageWidth);
    let y = margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const line of lines) {
      if (y + 14 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 14;
    }
    doc.save("application-package.pdf");
    toast.success("PDF downloaded!");
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-card space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-primary text-lg flex items-center gap-2">
          <Package className="w-5 h-5 text-accent" /> Application Package
        </h3>
        <div className="flex items-center gap-2">
          {finalResume && <Badge variant="outline" className="text-xs text-success border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" />Resume</Badge>}
          {coverLetter && <Badge variant="outline" className="text-xs text-success border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" />Cover Letter</Badge>}
          {Object.keys(answers).length > 0 && <Badge variant="outline" className="text-xs text-success border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" />Q&A</Badge>}
        </div>
      </div>

      {/* Common Questions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-primary">Common Application Questions</h4>
          <Button size="sm" variant="outline" onClick={generateAnswers} disabled={generating} className="text-xs">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
            Auto-Generate Answers
          </Button>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {COMMON_QUESTIONS.map((q, i) => (
            <div key={i} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{q}</label>
              <Textarea
                value={answers[i] || ""}
                onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                placeholder="Click 'Auto-Generate' or type your answer..."
                className="text-sm min-h-[60px] resize-none"
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <Button size="sm" onClick={handleCopyAll} className="gradient-teal text-white text-xs">
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy Full Package
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownload} className="text-xs">
          <Download className="w-3.5 h-3.5 mr-1" /> Download TXT
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="text-xs">
          <Download className="w-3.5 h-3.5 mr-1" /> Download PDF
        </Button>
      </div>
    </div>
  );
}
