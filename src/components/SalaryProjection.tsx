import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, TrendingUp, Sparkles, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface Projection {
  year: number;
  low: number;
  mid: number;
  high: number;
  label: string;
}

interface SalaryData {
  currentEstimate: number;
  projections: Projection[];
  insights: string[];
  topPayingSkills: string[];
}

interface Props {
  skills: string[];
  careerLevel: string;
  salaryMin: string;
  salaryMax: string;
  salaryTarget: string;
  targetTitles: string[];
  experience: any[];
}

export default function SalaryProjection({ skills, careerLevel, salaryMin, salaryMax, salaryTarget, targetTitles, experience }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SalaryData | null>(null);

  const analyze = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const { data: projData, error: projError } = await supabase.functions.invoke('salary-projection', {
        body: { skills, careerLevel, salaryMin, salaryMax, salaryTarget, targetTitles, experience },
      });

      if (projError) throw new Error(projError.message || "Failed to generate projection");

      setData(projData);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate salary projection");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`;

  const chartData = data ? [
    { name: "Now", low: data.currentEstimate, mid: data.currentEstimate, high: data.currentEstimate },
    ...data.projections.map(p => ({ name: `Year ${p.year}`, low: p.low, mid: p.mid, high: p.high })),
  ] : [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-primary text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-accent" /> Salary Projections
        </h2>
        <Button variant="outline" size="sm" onClick={analyze} disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Analyzing...</> : <><Sparkles className="w-4 h-4 mr-1" /> Project Salary</>}
        </Button>
      </div>

      {!data ? (
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Generate AI-powered salary projections based on your profile, skills, and market data.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current estimate */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estimated Current Market Value</p>
              <p className="font-display font-bold text-primary text-xl">{fmt(data.currentEstimate)}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="high" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.1} strokeWidth={1} strokeDasharray="4 4" name="High" />
                <Area type="monotone" dataKey="mid" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.25} strokeWidth={2} name="Mid" />
                <Area type="monotone" dataKey="low" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" fillOpacity={0.15} strokeWidth={1} strokeDasharray="4 4" name="Low" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Projection cards */}
          <div className="grid grid-cols-3 gap-3">
            {data.projections.map(p => (
              <Card key={p.year} className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{p.label}</p>
                <p className="font-display font-bold text-primary">{fmt(p.mid)}</p>
                <p className="text-[10px] text-muted-foreground">{fmt(p.low)} – {fmt(p.high)}</p>
              </Card>
            ))}
          </div>

          {/* Top paying skills */}
          {data.topPayingSkills?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Highest-Value Skills</h4>
              <div className="flex flex-wrap gap-2">
                {data.topPayingSkills.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
              </div>
            </div>
          )}

          {/* Insights */}
          {data.insights?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1"><Lightbulb className="w-4 h-4" /> Salary Growth Insights</h4>
              <ul className="space-y-1">
                {data.insights.map((ins, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <Sparkles className="w-3 h-3 mt-1 text-accent flex-shrink-0" />{ins}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
