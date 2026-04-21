import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2, MapPin, Building2, ExternalLink, Target,
  Briefcase, Plus, DollarSign, AlertTriangle, TrendingUp,
  Zap, Shield, Clock, EyeOff, Sparkles, CheckCircle, BookOpen,
  ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, ShieldX,
} from "lucide-react";
import { TRUST_LEVEL_CONFIG } from "@/lib/job-search/jobQualityEngine";
import type { EnrichedJob } from "@/services/matching/api";

// ── Salary helpers ────────────────────────────────────────────────────────────

function parseSalaryNumber(salary: string): number | null {
  const match = salary.replace(/,/g, "").match(/(\d+)/g);
  if (!match) return null;
  const nums = match.map(Number);
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  return nums[0];
}

const MARKET_BENCHMARKS: Record<string, number> = {
  entry: 65000, junior: 75000, mid: 105000, senior: 140000, lead: 165000,
  staff: 185000, principal: 210000, director: 195000, vp: 230000,
};

function estimateMarketRate(title: string): number {
  const lower = title.toLowerCase();
  for (const [key, val] of Object.entries(MARKET_BENCHMARKS)) { if (lower.includes(key)) return val; }
  if (lower.includes("engineer") || lower.includes("developer")) return 120000;
  if (lower.includes("manager")) return 130000;
  if (lower.includes("analyst")) return 90000;
  if (lower.includes("designer")) return 100000;
  return 100000;
}

function SalaryBadge({ salary, title }: { salary: string; title?: string }) {
  const parsed = parseSalaryNumber(salary);
  if (!parsed) return null;
  const diff = ((parsed - estimateMarketRate(title || "")) / estimateMarketRate(title || "")) * 100;
  if (diff >= 10) return <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-300 dark:text-green-400">↑ Above Market</Badge>;
  if (diff <= -10) return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">↓ Below Market</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/30">≈ Market Rate</Badge>;
}

// ── Smart tag ─────────────────────────────────────────────────────────────────

const AI_SMART_TAG_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  hot_match:  { label: "Hot Match",  color: "text-green-600 border-green-300 dark:text-green-400 bg-green-500/10", icon: TrendingUp },
  good_fit:   { label: "Good Fit",   color: "text-primary border-primary/30",                                      icon: Target },
  stretch:    { label: "Stretch",    color: "text-amber-600 border-amber-300 dark:text-amber-400",                 icon: Zap },
  reach:      { label: "Reach",      color: "text-orange-600 border-orange-300 dark:text-orange-400",              icon: Shield },
  low_roi:    { label: "Low ROI",    color: "text-destructive/70 border-destructive/20",                           icon: AlertTriangle },
  apply_fast: { label: "Apply Fast", color: "text-orange-600 border-orange-300 dark:text-orange-400",              icon: Zap },
};

function getSmartTagUI(job: EnrichedJob): { label: string; color: string; icon: React.ElementType } {
  if (job.smart_tag && AI_SMART_TAG_CONFIG[job.smart_tag]) {
    return AI_SMART_TAG_CONFIG[job.smart_tag];
  }
  const prob = job.responseProbability || 0;
  if (job.is_flagged) return { label: "Low Confidence", color: "text-destructive border-destructive/30", icon: AlertTriangle };
  if ((job.effortEstimate || 0) > 70 && prob < 40) return { label: "Low ROI", color: "text-destructive/70 border-destructive/20", icon: AlertTriangle };
  if (prob >= 70) return { label: "High Chance", color: "text-green-600 border-green-300 dark:text-green-400", icon: TrendingUp };
  if (prob >= 50 && job.first_seen_at) {
    const days = (Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 3) return { label: "Apply Fast", color: "text-orange-600 border-orange-300 dark:text-orange-400", icon: Zap };
  }
  if (prob < 35) return { label: "Improve Resume First", color: "text-amber-600 border-amber-300 dark:text-amber-400", icon: Shield };
  return { label: "Worth Applying", color: "text-primary border-primary/30", icon: Target };
}

function getFitScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function getFitScoreBg(score: number): string {
  if (score >= 80) return "bg-green-500/10 border-green-300/50";
  if (score >= 60) return "bg-amber-500/10 border-amber-300/50";
  return "bg-destructive/10 border-destructive/30";
}

function getProbColor(prob: number): string {
  if (prob >= 70) return "text-green-600 dark:text-green-400";
  if (prob >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

// ── Main card component ───────────────────────────────────────────────────────

interface JobCardProps {
  job: EnrichedJob;
  onSave: () => void;
  onAnalyze: () => void;
  onIgnore: () => void;
  onApply: () => void;
  isSaving: boolean;
}

export function JobCard({ job, onSave, onAnalyze, onIgnore, onApply, isSaving }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasAiScore = job.fit_score != null;
  const displayProb = hasAiScore ? (job.response_prob ?? job.responseProbability ?? 0) : (job.responseProbability ?? 0);
  const tag = getSmartTagUI(job);
  const TagIcon = tag.icon;
  const trustCfg = job.trustLevel ? TRUST_LEVEL_CONFIG[job.trustLevel] : TRUST_LEVEL_CONFIG.trusted;
  const TrustIcon = trustCfg.icon === "shield-check" ? ShieldCheck : trustCfg.icon === "shield-alert" ? ShieldAlert : ShieldX;
  const hasFlags = job.flags && job.flags.length > 0;
  const hasDanger = job.flags?.some(f => f.severity === "danger");
  const hasSkillData = (job.matched_skills?.length ?? 0) > 0 || (job.skill_gaps?.length ?? 0) > 0;
  const daysAgo = job.first_seen_at
    ? Math.round((Date.now() - new Date(job.first_seen_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card className={"p-5 transition-all " + (hasDanger ? "border-destructive/30 bg-destructive/5" : hasFlags ? "border-warning/30 bg-warning/5" : "hover:border-accent/50")}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">

          {/* Title row */}
          <div className="flex items-start gap-2 mb-1">
            <h3 className="font-semibold text-foreground text-lg leading-tight">{job.title}</h3>
            {hasDanger && <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-1" />}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {job.company}</span>
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>
            {job.type && <Badge variant="outline" className="capitalize text-xs"><Briefcase className="w-3 h-3 mr-1" />{job.type}</Badge>}
            {job.salary && (
              <span className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />{job.salary}</Badge>
                <SalaryBadge salary={job.salary} title={job.title} />
              </span>
            )}
            {job.source && <Badge variant="outline" className="text-xs capitalize">{job.source.split(":")[0]}</Badge>}
            {daysAgo !== null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{daysAgo}d ago</span>}
          </div>

          {/* Description (collapsible) */}
          <p className={"text-sm text-muted-foreground mt-2 leading-relaxed " + (expanded ? "" : "line-clamp-3")}>
            {job.description}
          </p>

          {/* AI score + tags row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {hasAiScore && (
              <div className={"flex items-center gap-1.5 rounded-lg border px-2.5 py-1 " + getFitScoreBg(job.fit_score!)}>
                <Sparkles className={"w-3.5 h-3.5 " + getFitScoreColor(job.fit_score!)} />
                <span className={"text-sm font-bold " + getFitScoreColor(job.fit_score!)}>{job.fit_score}% fit</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <TrustIcon className={"w-3.5 h-3.5 " + trustCfg.colorClass} />
              <span className={"text-xs font-semibold " + trustCfg.colorClass}>{trustCfg.label}</span>
            </div>
            <Badge variant="outline" className={"text-xs " + tag.color}>
              <TagIcon className="w-3 h-3 mr-1" />{tag.label}
            </Badge>
            {displayProb > 0 && (
              <span className={"text-sm font-semibold " + getProbColor(displayProb)}>{displayProb}% response prob.</span>
            )}
          </div>

          {/* AI skill breakdown (expandable) */}
          {hasSkillData && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? "Hide" : "Show"} AI skill analysis
              </button>

              {expanded && (
                <div className="mt-2 space-y-2">
                  {(job.matched_skills?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Skills you have ({job.matched_skills!.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {job.matched_skills!.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-300/50 dark:text-green-400">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(job.skill_gaps?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Skills to develop ({job.skill_gaps!.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {job.skill_gaps!.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300/50 dark:text-amber-400">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {job.match_summary && (
                    <p className="text-xs text-muted-foreground italic mt-1">💡 {job.match_summary}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Flags */}
          {hasFlags && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {job.flags!.map((flag, fi) => (
                <Badge
                  key={fi}
                  variant="outline"
                  className={"text-[10px] " + (flag.severity === "danger" ? "border-destructive/40 text-destructive bg-destructive/5" : "border-warning/40 text-warning bg-warning/5")}
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />{flag.label}
                </Badge>
              ))}
            </div>
          )}

          {/* Match reason (non-AI) */}
          {!hasAiScore && job.matchReason && !hasDanger && (
            <p className="text-xs text-accent mt-2 italic">💡 {job.matchReason}</p>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div className="flex sm:flex-col gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="text-xs" onClick={onSave} disabled={isSaving}>
            {isSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Saving</> : <><Plus className="w-3.5 h-3.5 mr-1" />Save</>}
          </Button>
          <Button size="sm" className="gradient-indigo text-white text-xs" onClick={onAnalyze}>
            <Target className="w-3.5 h-3.5 mr-1" />Check Fit
          </Button>
          {job.url && (
            <Button variant="outline" size="sm" className="text-xs" onClick={onApply}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" />Apply
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={onIgnore}>
            <EyeOff className="w-3.5 h-3.5 mr-1" />Ignore
          </Button>
        </div>
      </div>
    </Card>
  );
}
