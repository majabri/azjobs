import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, TrendingUp, Target, Shield, FileText, Loader2,
  Sparkles, AlertTriangle, CheckCircle, Copy, ArrowUpRight, BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import HelpTooltip from "@/components/HelpTooltip";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BenchmarkData {
  marketLow: number;
  marketMedian: number;
  marketHigh: number;
  top10Percent: number;
  classification: string;
  targetRange: string;
  insights: string[];
  topPayingCompanies: string[];
  demandTrend: string;
}

interface OfferAnalysis {
  marketComparison: string;
  moneyLeftOnTable: number;
  overallRating: string;
  breakdownAnalysis: { baseVerdict: string; bonusVerdict: string; equityVerdict: string };
  riskFactors: string[];
  strengths: string[];
  recommendation: string;
}

interface NegotiationStrategy {
  targetSalary: number;
  walkAwayPoint: number;
  anchorPoint: number;
  justificationPoints: string[];
  tacticalAdvice: string[];
  timing: string;
  leveragePoints: string[];
  concessions: string[];
}

interface NegotiationScripts {
  emailSubject: string;
  emailBody: string;
  callScript: {
    opening: string;
    counterOffer: string;
    objectionHandling: { objection: string; response: string }[];
    closing: string;
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CompensationDashboard() {
  // Form state
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("Mid-level");
  const [baseSalary, setBaseSalary] = useState("");
  const [bonus, setBonus] = useState("");
  const [equity, setEquity] = useState("");

  // Results state
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [offerAnalysis, setOfferAnalysis] = useState<OfferAnalysis | null>(null);
  const [strategy, setStrategy] = useState<NegotiationStrategy | null>(null);
  const [scripts, setScripts] = useState<NegotiationScripts | null>(null);

  // Loading states
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [loadingScripts, setLoadingScripts] = useState(false);

  const invoke = async (action: string, extra: any) => {
    const { data, error } = await supabase.functions.invoke("negotiation-strategy", {
      body: { action, jobTitle, company, location, experienceLevel, ...extra },
    });
    if (error) throw new Error(error.message || "Request failed");
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const runBenchmark = async () => {
    if (!jobTitle) { toast.error("Enter a job title"); return; }
    setLoadingBenchmark(true);
    try {
      const data = await invoke("benchmark", { skills: [] });
      setBenchmark(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingBenchmark(false); }
  };

  const analyzeOffer = async () => {
    if (!baseSalary) { toast.error("Enter base salary"); return; }
    setLoadingOffer(true);
    try {
      const data = await invoke("analyze-offer", {
        baseSalary: Number(baseSalary), bonus: Number(bonus || 0), equity: Number(equity || 0),
      });
      setOfferAnalysis(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingOffer(false); }
  };

  const generateStrategy = async () => {
    if (!baseSalary) { toast.error("Enter offer details first"); return; }
    setLoadingStrategy(true);
    try {
      const data = await invoke("negotiate", {
        baseSalary: Number(baseSalary), bonus: Number(bonus || 0), equity: Number(equity || 0),
        skills: [], experience: [], marketData: benchmark || {},
      });
      setStrategy(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingStrategy(false); }
  };

  const generateScripts = async () => {
    if (!strategy) { toast.error("Generate a strategy first"); return; }
    setLoadingScripts(true);
    try {
      const data = await invoke("generate-scripts", {
        baseSalary: Number(baseSalary), targetSalary: strategy.targetSalary,
        justificationPoints: strategy.justificationPoints,
      });
      setScripts(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingScripts(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const fmt = (n: number) => `$${n.toLocaleString()}`;

  const ratingColors: Record<string, string> = {
    poor: "text-destructive", below_market: "text-warning", fair: "text-foreground",
    good: "text-success", excellent: "text-accent",
  };

  const benchmarkChartData = benchmark ? [
    { name: "25th %ile", value: benchmark.marketLow, fill: "hsl(var(--muted-foreground))" },
    { name: "Median", value: benchmark.marketMedian, fill: "hsl(var(--accent))" },
    { name: "75th %ile", value: benchmark.marketHigh, fill: "hsl(var(--accent))" },
    { name: "Top 10%", value: benchmark.top10Percent, fill: "hsl(var(--success))" },
  ] : [];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center">
          <DollarSign className="w-4 h-4 text-white" />
        </div>
        <h2 className="font-display font-bold text-primary text-lg flex items-center gap-1.5">Compensation Intelligence <HelpTooltip text="Compare your salary against market benchmarks, analyze job offers, get negotiation strategies, and generate ready-to-use scripts for salary discussions." /></h2>
      </div>

      {/* Input Form */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Input placeholder="Job Title *" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
        <Input placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
        <Input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
        <select value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option>Entry-level</option>
          <option>Mid-level</option>
          <option>Senior</option>
          <option>Staff/Principal</option>
          <option>Director+</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Input placeholder="Base Salary ($)" type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} />
        <Input placeholder="Bonus ($)" type="number" value={bonus} onChange={e => setBonus(e.target.value)} />
        <Input placeholder="Equity ($)" type="number" value={equity} onChange={e => setEquity(e.target.value)} />
      </div>

      <Tabs defaultValue="benchmark" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="benchmark" className="text-xs"><BarChart3 className="w-3 h-3 mr-1" />Benchmark</TabsTrigger>
          <TabsTrigger value="offer" className="text-xs"><Target className="w-3 h-3 mr-1" />Offer</TabsTrigger>
          <TabsTrigger value="strategy" className="text-xs"><Shield className="w-3 h-3 mr-1" />Strategy</TabsTrigger>
          <TabsTrigger value="scripts" className="text-xs"><FileText className="w-3 h-3 mr-1" />Scripts</TabsTrigger>
        </TabsList>

        {/* ─── Benchmark Tab ──────────────────────────── */}
        <TabsContent value="benchmark" className="space-y-4">
          <Button onClick={runBenchmark} disabled={loadingBenchmark} className="gradient-teal text-white w-full">
            {loadingBenchmark ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing Market...</> : <><Sparkles className="w-4 h-4 mr-2" />Run Salary Benchmark</>}
          </Button>

          {benchmark && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat label="25th Percentile" value={fmt(benchmark.marketLow)} />
                <MiniStat label="Median" value={fmt(benchmark.marketMedian)} accent />
                <MiniStat label="75th Percentile" value={fmt(benchmark.marketHigh)} />
                <MiniStat label="Top 10%" value={fmt(benchmark.top10Percent)} accent />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
                <Target className="w-5 h-5 text-accent flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">You should target</p>
                  <p className="font-display font-bold text-primary">{benchmark.targetRange}</p>
                </div>
                <Badge variant="secondary" className="ml-auto capitalize">{benchmark.classification}</Badge>
                <Badge variant="outline" className="capitalize">
                  <TrendingUp className="w-3 h-3 mr-1" />{benchmark.demandTrend}
                </Badge>
              </div>

              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={benchmarkChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {benchmarkChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {benchmark.topPayingCompanies?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">TOP-PAYING COMPANIES</p>
                  <div className="flex flex-wrap gap-2">
                    {benchmark.topPayingCompanies.map((c, i) => <Badge key={i} variant="outline">{c}</Badge>)}
                  </div>
                </div>
              )}

              <InsightList items={benchmark.insights} />
            </div>
          )}
        </TabsContent>

        {/* ─── Offer Analysis Tab ─────────────────────── */}
        <TabsContent value="offer" className="space-y-4">
          <Button onClick={analyzeOffer} disabled={loadingOffer} className="gradient-teal text-white w-full">
            {loadingOffer ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing Offer...</> : <><Target className="w-4 h-4 mr-2" />Analyze This Offer</>}
          </Button>

          {offerAnalysis && (
            <div className="space-y-4 animate-fade-in">
              {/* Money on table highlight */}
              {offerAnalysis.moneyLeftOnTable > 0 && (
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0" />
                  <div>
                    <p className="font-display font-bold text-foreground">You're leaving {fmt(offerAnalysis.moneyLeftOnTable)} on the table</p>
                    <p className="text-sm text-muted-foreground">{offerAnalysis.marketComparison}</p>
                  </div>
                </div>
              )}

              <div className={`text-center py-3 rounded-lg border ${
                offerAnalysis.overallRating === "excellent" || offerAnalysis.overallRating === "good"
                  ? "bg-success/10 border-success/30" : offerAnalysis.overallRating === "fair"
                  ? "bg-muted/30 border-border" : "bg-destructive/10 border-destructive/30"
              }`}>
                <p className="text-xs text-muted-foreground mb-1">Overall Rating</p>
                <p className={`font-display font-bold text-lg capitalize ${ratingColors[offerAnalysis.overallRating] || "text-foreground"}`}>
                  {offerAnalysis.overallRating.replace("_", " ")}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <VerdictCard label="Base" verdict={offerAnalysis.breakdownAnalysis.baseVerdict} />
                <VerdictCard label="Bonus" verdict={offerAnalysis.breakdownAnalysis.bonusVerdict} />
                <VerdictCard label="Equity" verdict={offerAnalysis.breakdownAnalysis.equityVerdict} />
              </div>

              {offerAnalysis.strengths?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">STRENGTHS</p>
                  {offerAnalysis.strengths.map((s, i) => (
                    <p key={i} className="text-sm text-foreground flex items-start gap-2 mb-1">
                      <CheckCircle className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />{s}
                    </p>
                  ))}
                </div>
              )}

              {offerAnalysis.riskFactors?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">RISK FACTORS</p>
                  {offerAnalysis.riskFactors.map((r, i) => (
                    <p key={i} className="text-sm text-foreground flex items-start gap-2 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />{r}
                    </p>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                <p className="text-sm text-foreground"><strong>Recommendation:</strong> {offerAnalysis.recommendation}</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── Strategy Tab ──────────────────────────── */}
        <TabsContent value="strategy" className="space-y-4">
          <Button onClick={generateStrategy} disabled={loadingStrategy} className="gradient-teal text-white w-full">
            {loadingStrategy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating Strategy...</> : <><Shield className="w-4 h-4 mr-2" />Generate Negotiation Plan</>}
          </Button>

          {strategy && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Walk-Away" value={fmt(strategy.walkAwayPoint)} />
                <MiniStat label="Target" value={fmt(strategy.targetSalary)} accent />
                <MiniStat label="Anchor (Ask)" value={fmt(strategy.anchorPoint)} />
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">TIMING</p>
                <p className="text-sm text-foreground">{strategy.timing}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">JUSTIFICATION POINTS</p>
                {strategy.justificationPoints.map((p, i) => (
                  <p key={i} className="text-sm text-foreground flex items-start gap-2 mb-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />{p}
                  </p>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">LEVERAGE</p>
                  {strategy.leveragePoints.map((l, i) => (
                    <p key={i} className="text-sm text-foreground mb-1">• {l}</p>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">STRATEGIC CONCESSIONS</p>
                  {strategy.concessions.map((c, i) => (
                    <p key={i} className="text-sm text-muted-foreground mb-1">• {c}</p>
                  ))}
                </div>
              </div>

              <InsightList items={strategy.tacticalAdvice} title="TACTICAL ADVICE" />
            </div>
          )}
        </TabsContent>

        {/* ─── Scripts Tab ───────────────────────────── */}
        <TabsContent value="scripts" className="space-y-4">
          <Button onClick={generateScripts} disabled={loadingScripts || !strategy} className="gradient-teal text-white w-full">
            {loadingScripts ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating Scripts...</> : <><FileText className="w-4 h-4 mr-2" />Generate Negotiation Scripts</>}
          </Button>
          {!strategy && <p className="text-xs text-muted-foreground text-center">Generate a strategy first to unlock scripts</p>}

          {scripts && (
            <div className="space-y-4 animate-fade-in">
              {/* Email */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">📧 Negotiation Email</p>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`Subject: ${scripts.emailSubject}\n\n${scripts.emailBody}`)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                  </Button>
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Subject: {scripts.emailSubject}</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{scripts.emailBody}</p>
                </div>
              </div>

              {/* Call Script */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">📞 Call Script</p>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(
                    `Opening:\n${scripts.callScript.opening}\n\nCounter:\n${scripts.callScript.counterOffer}\n\nClosing:\n${scripts.callScript.closing}`
                  )}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                  </Button>
                </div>
                <div className="p-4 space-y-3">
                  <ScriptSection label="Opening" text={scripts.callScript.opening} />
                  <ScriptSection label="Counter Offer" text={scripts.callScript.counterOffer} />
                  {scripts.callScript.objectionHandling?.map((o, i) => (
                    <div key={i} className="p-3 rounded bg-muted/20 border border-border">
                      <p className="text-xs font-semibold text-destructive mb-1">Objection: "{o.objection}"</p>
                      <p className="text-sm text-foreground">→ {o.response}</p>
                    </div>
                  ))}
                  <ScriptSection label="Closing" text={scripts.callScript.closing} />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border text-center ${accent ? "bg-accent/5 border-accent/20" : "bg-muted/20 border-border"}`}>
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className={`font-display font-bold ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function VerdictCard({ label, verdict }: { label: string; verdict: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/20 border border-border">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="text-xs text-foreground">{verdict}</p>
    </div>
  );
}

function InsightList({ items, title = "INSIGHTS" }: { items: string[]; title?: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">{title}</p>
      {items.map((item, i) => (
        <p key={i} className="text-sm text-foreground flex items-start gap-2 mb-1.5">
          <Sparkles className="w-3 h-3 text-accent mt-1 flex-shrink-0" />{item}
        </p>
      ))}
    </div>
  );
}

function ScriptSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-accent mb-1">{label}</p>
      <p className="text-sm text-foreground">{text}</p>
    </div>
  );
}
