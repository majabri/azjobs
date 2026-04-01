import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCompareArrows, CheckCircle2, XCircle, UserCheck, Clock, UserX } from "lucide-react";
import { type CandidateAnalysis } from "@/lib/analysisEngine";
import { AnimatedBar } from "@/components/ScoreDisplay";

interface CandidateComparisonProps {
  candidates: CandidateAnalysis[];
}

const recConfig = {
  interview: { label: "Interview", icon: UserCheck, cls: "bg-success/10 text-success border-success/20" },
  maybe: { label: "Consider", icon: Clock, cls: "bg-warning/10 text-warning border-warning/20" },
  pass: { label: "Pass", icon: UserX, cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function CandidateComparison({ candidates }: CandidateComparisonProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : prev.length < 4 ? [...prev, name] : prev
    );
  };

  const compared = candidates.filter((c) => selected.includes(c.name));

  // Collect all unique skills across selected candidates
  const allSkills = Array.from(
    new Set(compared.flatMap((c) => [...c.matchedSkills, ...c.gaps]))
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <GitCompareArrows className="w-4 h-4" />
          Compare Candidates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Candidate Comparison</DialogTitle>
        </DialogHeader>

        {/* Selection */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">Select 2–4 candidates to compare:</p>
          <div className="flex flex-wrap gap-3">
            {candidates.map((c) => (
              <label
                key={c.name}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  selected.includes(c.name)
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/40"
                }`}
              >
                <Checkbox
                  checked={selected.includes(c.name)}
                  onCheckedChange={() => toggle(c.name)}
                  disabled={!selected.includes(c.name) && selected.length >= 4}
                />
                <span className="text-sm font-medium">{c.name}</span>
                <span className={`text-xs font-bold ${c.score >= 70 ? "text-success" : c.score >= 45 ? "text-warning" : "text-destructive"}`}>
                  {c.score}%
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Comparison Table */}
        {compared.length >= 2 ? (
          <ScrollArea className="max-h-[55vh]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold text-muted-foreground w-40">Criteria</th>
                    {compared.map((c) => (
                      <th key={c.name} className="text-center p-3 font-semibold text-primary min-w-[160px]">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Score */}
                  <tr className="border-b border-border">
                    <td className="p-3 font-medium text-muted-foreground">Fit Score</td>
                    {compared.map((c) => (
                      <td key={c.name} className="p-3 text-center">
                        <span className={`text-2xl font-display font-bold ${c.score >= 70 ? "text-success" : c.score >= 45 ? "text-warning" : "text-destructive"}`}>
                          {c.score}%
                        </span>
                        <div className="mt-2 px-4"><AnimatedBar value={c.score} height="h-1.5" /></div>
                      </td>
                    ))}
                  </tr>

                  {/* Recommendation */}
                  <tr className="border-b border-border">
                    <td className="p-3 font-medium text-muted-foreground">Recommendation</td>
                    {compared.map((c) => {
                      const cfg = recConfig[c.recommendation];
                      return (
                        <td key={c.name} className="p-3 text-center">
                          <Badge className={`border ${cfg.cls}`}>{cfg.label}</Badge>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Skills */}
                  {allSkills.map((skill) => (
                    <tr key={skill} className="border-b border-border/50">
                      <td className="p-3 text-xs font-medium text-foreground">{skill}</td>
                      {compared.map((c) => {
                        const has = c.matchedSkills.includes(skill);
                        return (
                          <td key={c.name} className="p-3 text-center">
                            {has ? (
                              <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-destructive/50 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Gaps count */}
                  <tr className="border-b border-border">
                    <td className="p-3 font-medium text-muted-foreground">Total Gaps</td>
                    {compared.map((c) => (
                      <td key={c.name} className="p-3 text-center font-bold text-destructive">
                        {c.gaps.length}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Select at least 2 candidates to see the comparison.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
