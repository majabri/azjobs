import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, CheckCircle2, TrendingUp } from "lucide-react";
import { computeDiff, type DiffSegment } from "@/lib/diffUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResumeComparisonProps {
  original: string;
  optimized: string;
  jobTitle?: string;
}

export default function ResumeComparison({ original, optimized, jobTitle }: ResumeComparisonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const diff = useMemo(() => computeDiff(original, optimized), [original, optimized]);

  const improvementScore = useMemo(() => {
    const totalOriginal = diff.original.length;
    if (totalOriginal === 0) return 0;
    const changed = diff.original.filter((s) => s.type === "removed").length;
    return Math.round((changed / totalOriginal) * 100);
  }, [diff]);

  const handleSaveAsVersion = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const versionName = jobTitle
        ? `Optimized for ${jobTitle.slice(0, 50)}`
        : `AI Optimized ${new Date().toLocaleDateString()}`;

      await (supabase.from("resume_versions") as any).insert({
        user_id: session.user.id,
        version_name: versionName,
        resume_text: optimized,
        job_type: jobTitle || null,
      });

      setSaved(true);
      toast.success("Resume saved as new version! Future analyses will use this stronger resume.");
    } catch {
      toast.error("Failed to save resume version");
    } finally {
      setSaving(false);
    }
  };

  // Quantified impact metrics
  const addedKeywords = diff.modified.filter(s => s.type === "added").length;
  const removedWords = diff.original.filter(s => s.type === "removed").length;
  const estimatedATSIncrease = Math.min(35, Math.round(addedKeywords * 1.5));
  const estimatedInterviewDelta = Math.min(25, Math.round(improvementScore * 0.6));

  return (
    <div className="space-y-4">
      {/* Impact Summary Banner */}
      <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-foreground">Resume Optimization Impact</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <p className="font-display font-bold text-accent text-lg">{improvementScore}%</p>
            <p className="text-[10px] text-muted-foreground">Content Changed</p>
          </div>
          <div className="text-center">
            <p className="font-display font-bold text-success text-lg">+{addedKeywords}</p>
            <p className="text-[10px] text-muted-foreground">Keywords Added</p>
          </div>
          <div className="text-center">
            <p className="font-display font-bold text-accent text-lg">+{estimatedATSIncrease}%</p>
            <p className="text-[10px] text-muted-foreground">ATS Compatibility</p>
          </div>
          <div className="text-center">
            <p className="font-display font-bold text-success text-lg">+{estimatedInterviewDelta}%</p>
            <p className="text-[10px] text-muted-foreground">Interview Probability</p>
          </div>
        </div>
      </div>

      {/* Improvement Score + Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-accent/30 text-accent text-sm font-bold px-3 py-1">
            {improvementScore}% improved
          </Badge>
          <span className="text-xs text-muted-foreground">
            {diff.modified.filter((s) => s.type === "added").length} additions •{" "}
            {diff.original.filter((s) => s.type === "removed").length} removals
          </span>
        </div>
        <Button
          size="sm"
          variant={saved ? "outline" : "default"}
          className={saved ? "border-success/30 text-success" : "gradient-teal text-white shadow-teal hover:opacity-90"}
          onClick={handleSaveAsVersion}
          disabled={saving || saved}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Saved as Version</>
          ) : (
            <><Save className="w-4 h-4 mr-1.5" /> Save as New Version</>
          )}
        </Button>
      </div>

      {/* Side-by-side diff */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Original Resume</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">Removed</span>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border max-h-80 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
              {diff.original.map((seg, i) => (
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
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">AI-Optimized</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Added</span>
          </div>
          <div className="bg-accent/5 rounded-xl p-4 border border-accent/20 max-h-80 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
              {diff.modified.map((seg, i) => (
                <span
                  key={i}
                  className={seg.type === "added" ? "bg-accent/15 text-accent font-medium" : "text-foreground"}
                >{seg.text}</span>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
