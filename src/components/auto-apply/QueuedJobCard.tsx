import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Briefcase,
  FileText,
  Copy,
  Target,
  Package,
  Mail,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { FitAnalysis } from "@/lib/analysisEngine";

export interface QueuedApplication {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  matchScore: number;
  status:
    | "review"
    | "analyzed"
    | "generating"
    | "ready"
    | "approved"
    | "skipped";
  resume?: string;
  coverLetter?: string;
  jobDescription?: string;
  analysis?: FitAnalysis | null;
}

interface QueuedJobCardProps {
  item: QueuedApplication;
  isExpanded: boolean;
  isGenerating: boolean;
  isAnalyzing: boolean;
  onToggleExpand: () => void;
  onAnalyze: () => void;
  onGeneratePackage: () => void;
  onApproveAndTrack: () => void;
  onSkip: () => void;
}

const statusLabel = (s: QueuedApplication["status"]) => {
  switch (s) {
    case "review":
      return "Review";
    case "analyzed":
      return "Analyzed";
    case "ready":
      return "Package Ready";
    case "approved":
      return "Tracked";
    case "skipped":
      return "Skipped";
    default:
      return s;
  }
};

const statusColor = (s: QueuedApplication["status"]) => {
  switch (s) {
    case "review":
      return "border-warning/30 text-warning";
    case "analyzed":
      return "border-primary/30 text-primary";
    case "ready":
      return "border-accent/30 text-accent";
    case "approved":
      return "border-success/30 text-success";
    case "skipped":
      return "border-muted text-muted-foreground";
    default:
      return "";
  }
};

export function QueuedJobCard({
  item,
  isExpanded,
  isGenerating,
  isAnalyzing,
  onToggleExpand,
  onAnalyze,
  onGeneratePackage,
  onApproveAndTrack,
  onSkip,
}: QueuedJobCardProps) {
  return (
    <Card
      className={`overflow-hidden transition-all ${
        item.status === "skipped"
          ? "opacity-50"
          : item.status === "approved"
            ? "border-success/30"
            : item.status === "ready"
              ? "border-accent/30"
              : ""
      }`}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Match Score */}
        <div className="flex-shrink-0 text-center">
          <div
            className={`text-xl font-display font-bold ${
              item.matchScore >= 70
                ? "text-success"
                : item.matchScore >= 50
                  ? "text-warning"
                  : "text-destructive"
            }`}
          >
            {item.matchScore}%
          </div>
          <div className="text-[10px] text-muted-foreground">match</div>
        </div>

        {/* Job Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">
            {item.jobTitle}
          </h3>
          <p className="text-sm text-muted-foreground">
            {item.company} · {item.location}
          </p>
        </div>

        {/* Status Badge */}
        <Badge
          variant="outline"
          className={`text-xs ${statusColor(item.status)}`}
        >
          {statusLabel(item.status)}
        </Badge>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          {item.status === "review" && (
            <>
              <Button
                size="sm"
                className="text-xs gradient-indigo text-white"
                onClick={() => {
                  onAnalyze();
                  onToggleExpand();
                }}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Target className="w-3 h-3 mr-1" /> Analyze Fit
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={onToggleExpand}
              >
                <Eye className="w-3 h-3 mr-1" /> View Job
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={onSkip}
              >
                Skip
              </Button>
            </>
          )}

          {item.status === "analyzed" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={onToggleExpand}
              >
                <Eye className="w-3 h-3 mr-1" />{" "}
                {isExpanded ? "Collapse" : "Review Analysis"}
              </Button>
              <Button
                size="sm"
                className="text-xs gradient-indigo text-white"
                onClick={onGeneratePackage}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Package className="w-3 h-3 mr-1" /> Generate Package
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => {
                  const jobDesc = `${item.jobTitle} at ${item.company}\n${item.jobDescription}`;
                  window.open(
                    `/job-seeker?prefillJob=${encodeURIComponent(jobDesc)}`,
                    "_blank",
                  );
                }}
              >
                <ExternalLink className="w-3 h-3 mr-1" /> Full Analysis
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={onSkip}
              >
                Skip
              </Button>
            </>
          )}

          {item.status === "ready" && (
            <>
              <Button size="sm" className="text-xs" onClick={onApproveAndTrack}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Track Application
              </Button>
              <Button size="sm" variant="ghost" onClick={onToggleExpand}>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
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

          {/* Fit Analysis */}
          {item.analysis && (
            <div>
              <h4 className="text-sm font-semibold text-primary flex items-center gap-1 mb-2">
                <Target className="w-3.5 h-3.5" /> Fit Analysis
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="text-center p-2 bg-card rounded-lg border border-border">
                  <div className="text-lg font-bold text-primary">
                    {item.analysis.overallScore}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Overall
                  </div>
                </div>
                <div className="text-center p-2 bg-card rounded-lg border border-border">
                  <div className="text-lg font-bold text-accent">
                    {item.analysis.interviewProbability}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Interview Prob.
                  </div>
                </div>
                <div className="text-center p-2 bg-card rounded-lg border border-border">
                  <div className="text-lg font-bold text-success">
                    {
                      item.analysis.matchedSkills.filter((s) => s.matched)
                        .length
                    }
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Skills Matched
                  </div>
                </div>
                <div className="text-center p-2 bg-card rounded-lg border border-border">
                  <div className="text-lg font-bold text-warning">
                    {item.analysis.gaps.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Gaps</div>
                </div>
              </div>
              {item.analysis.topActions &&
                item.analysis.topActions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1">
                      Top Actions:
                    </p>
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

          {/* Tailored Resume */}
          {item.resume && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Tailored Resume
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(item.resume!);
                    toast.success("Copied!");
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-card p-3 rounded-lg border border-border max-h-48 overflow-y-auto">
                {item.resume}
              </pre>
            </div>
          )}

          {/* Cover Letter */}
          {item.coverLetter && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Cover Letter
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(item.coverLetter!);
                    toast.success("Copied!");
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-card p-3 rounded-lg border border-border max-h-48 overflow-y-auto">
                {item.coverLetter}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
