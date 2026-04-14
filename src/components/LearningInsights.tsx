import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, TrendingUp, Sparkles } from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Insight {
  pattern: string;
  recommendation: string;
  impact: string;
}

export default function LearningInsights() {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[] | null>(null);

  const analyze = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learning-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setInsights(data.insights || []);
    } catch { toast.error("Failed to generate insights"); }
    finally { setLoading(false); }
  };

  if (!insights) {
    return (
      <Card className="p-6 text-center">
        <Brain className="w-10 h-10 text-accent mx-auto mb-3" />
        <h3 className="font-display font-bold text-primary text-lg mb-2 flex items-center justify-center gap-1.5">Learning Insights <HelpTooltip text="AI analyzes your application outcomes to find patterns — what's working, what isn't, and how to improve your hit rate." /></h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Discover patterns from your application outcomes to improve your strategy.
        </p>
        <Button className="gradient-brand text-white shadow-brand hover:opacity-90" onClick={analyze} disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Insights</>}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-primary text-lg flex items-center gap-2"><Brain className="w-5 h-5 text-accent" /> Learning Insights <HelpTooltip text="AI analyzes your application outcomes to find patterns — what's working, what isn't, and how to improve your hit rate." /></h3>
        <Button variant="ghost" size="sm" onClick={analyze} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-start gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-foreground">{insight.pattern}</p>
            </div>
            <p className="text-xs text-muted-foreground ml-6">{insight.recommendation}</p>
            <Badge variant="outline" className="text-[10px] ml-6 mt-1">{insight.impact} impact</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
