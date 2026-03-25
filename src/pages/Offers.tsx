import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, DollarSign, TrendingUp, Trash2,
  CheckCircle, XCircle, Clock, Loader2, Scale, Bell, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface Offer {
  id: string;
  job_title: string;
  company: string;
  base_salary: number | null;
  bonus: number | null;
  equity: number | null;
  total_comp: number | null;
  market_rate: number | null;
  status: string;
  notes: string | null;
  negotiation_strategy: any;
  created_at: string;
  updated_at: string;
  deadline: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  negotiating: { label: "Negotiating", icon: Clock, className: "bg-warning/10 text-warning border-warning/20" },
  accepted: { label: "Accepted", icon: CheckCircle, className: "bg-success/10 text-success border-success/20" },
  declined: { label: "Declined", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : "—";

function getDeadlineInfo(deadline: string | null): { label: string; urgent: boolean; expired: boolean; daysLeft: number } | null {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: `Expired ${Math.abs(daysLeft)}d ago`, urgent: false, expired: true, daysLeft };
  if (daysLeft === 0) return { label: "Due today!", urgent: true, expired: false, daysLeft };
  if (daysLeft <= 3) return { label: `${daysLeft}d left`, urgent: true, expired: false, daysLeft };
  return { label: `${daysLeft}d left`, urgent: false, expired: false, daysLeft };
}

export default function Offers() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ job_title: "", company: "", base_salary: "", bonus: "", equity: "", notes: "", deadline: "" });

  useEffect(() => { loadOffers(); }, []);

  const loadOffers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOffers((data || []) as Offer[]);
    } catch { toast.error("Failed to load offers"); }
    finally { setLoading(false); }
  };

  const addOffer = async () => {
    if (!form.job_title || !form.company) { toast.error("Title and company required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const base = Number(form.base_salary) || 0;
      const bonus = Number(form.bonus) || 0;
      const equity = Number(form.equity) || 0;

      const insertData: Record<string, any> = {
        user_id: session.user.id,
        job_title: form.job_title,
        company: form.company,
        base_salary: base,
        bonus,
        equity,
        total_comp: base + bonus + equity,
        notes: form.notes || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      };

      const { error } = await supabase.from("offers").insert(insertData as any);
      if (error) throw error;
      toast.success("Offer saved");
      setForm({ job_title: "", company: "", base_salary: "", bonus: "", equity: "", notes: "", deadline: "" });
      setShowAdd(false);
      loadOffers();
    } catch (e: any) { toast.error(e.message || "Failed to save offer"); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await (supabase.from("offers") as any).update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setOffers(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      toast.success(`Offer marked as ${status}`);
    } catch { toast.error("Failed to update"); }
  };

  const deleteOffer = async (id: string) => {
    try {
      const { error } = await (supabase.from("offers") as any).delete().eq("id", id);
      if (error) throw error;
      setOffers(prev => prev.filter(o => o.id !== id));
      setComparing(prev => prev.filter(c => c !== id));
      toast.success("Offer removed");
    } catch { toast.error("Failed to delete"); }
  };

  const toggleCompare = (id: string) => {
    setComparing(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const comparedOffers = offers.filter(o => comparing.includes(o.id));

  const chartData = comparedOffers.map(o => ({
    name: `${o.company}\n${o.job_title}`.slice(0, 30),
    Base: o.base_salary || 0,
    Bonus: o.bonus || 0,
    Equity: o.equity || 0,
  }));

  // Check for expiring offers and show reminder
  const urgentOffers = offers.filter(o => {
    const info = getDeadlineInfo(o.deadline);
    return info && info.urgent && !info.expired && o.status === "negotiating";
  });

  return (
    <div className="bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Urgent deadline banner */}
        {urgentOffers.length > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-center gap-3">
            <Bell className="w-5 h-5 text-warning flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-warning">
                {urgentOffers.length} offer{urgentOffers.length > 1 ? "s" : ""} expiring soon!
              </p>
              <p className="text-xs text-muted-foreground">
                {urgentOffers.map(o => `${o.company} (${getDeadlineInfo(o.deadline)?.label})`).join(" • ")}
              </p>
            </div>
          </div>
        )}

        {/* Comparison Chart */}
        {comparedOffers.length >= 2 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-5 h-5 text-accent" />
              <h2 className="font-display font-bold text-primary">Side-by-Side Comparison</h2>
              <Badge variant="secondary">{comparedOffers.length} offers</Badge>
            </div>

            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="Base" stackId="comp" fill="hsl(var(--accent))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Bonus" stackId="comp" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Equity" stackId="comp" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Metric</th>
                    {comparedOffers.map(o => (
                      <th key={o.id} className="text-right py-2 font-medium text-foreground">{o.company}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { label: "Base Salary", key: "base_salary" as const },
                    { label: "Bonus", key: "bonus" as const },
                    { label: "Equity", key: "equity" as const },
                    { label: "Total Comp", key: "total_comp" as const },
                  ].map(row => {
                    const values = comparedOffers.map(o => o[row.key] || 0);
                    const maxVal = Math.max(...values);
                    return (
                      <tr key={row.key}>
                        <td className="py-2 text-muted-foreground">{row.label}</td>
                        {comparedOffers.map((o, i) => (
                          <td key={o.id} className={`text-right py-2 font-medium ${values[i] === maxVal && maxVal > 0 ? "text-success" : "text-foreground"}`}>
                            {fmt(o[row.key])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="py-2 text-muted-foreground">Status</td>
                    {comparedOffers.map(o => (
                      <td key={o.id} className="text-right py-2">
                        <Badge className={STATUS_CONFIG[o.status]?.className || ""}>{STATUS_CONFIG[o.status]?.label || o.status}</Badge>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">Deadline</td>
                    {comparedOffers.map(o => {
                      const info = getDeadlineInfo(o.deadline);
                      return (
                        <td key={o.id} className={`text-right py-2 text-sm ${info?.urgent ? "text-warning font-semibold" : info?.expired ? "text-destructive" : "text-foreground"}`}>
                          {info ? info.label : "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {comparedOffers.length === 1 && (
          <div className="text-center py-3 text-sm text-muted-foreground bg-muted/20 rounded-lg border border-border">
            Select at least one more offer to compare
          </div>
        )}

        {/* Offers List */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
        ) : offers.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-primary mb-2">No offers yet</h3>
            <p className="text-muted-foreground mb-6">Add your first job offer to start tracking and comparing compensation.</p>
            <Button className="gradient-teal text-white" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Your First Offer
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {offers.map(offer => {
              const isCompared = comparing.includes(offer.id);
              const cfg = STATUS_CONFIG[offer.status] || STATUS_CONFIG.negotiating;
              const StatusIcon = cfg.icon;
              const deadlineInfo = getDeadlineInfo(offer.deadline);
              return (
                <Card key={offer.id} className={`overflow-hidden transition-all ${isCompared ? "ring-2 ring-accent/50" : ""} ${deadlineInfo?.urgent ? "border-warning/40" : ""}`}>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-display font-bold text-foreground">{offer.job_title}</h3>
                        <p className="text-sm text-muted-foreground">{offer.company}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={cfg.className}><StatusIcon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                        {deadlineInfo && (
                          <Badge variant="outline" className={`text-[10px] ${deadlineInfo.expired ? "text-destructive border-destructive/30" : deadlineInfo.urgent ? "text-warning border-warning/30" : "text-muted-foreground"}`}>
                            <Clock className="w-3 h-3 mr-1" /> {deadlineInfo.label}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <CompStat label="Base" value={offer.base_salary} />
                      <CompStat label="Bonus" value={offer.bonus} />
                      <CompStat label="Equity" value={offer.equity} />
                      <CompStat label="Total" value={offer.total_comp} highlight />
                    </div>

                    {offer.notes && <p className="text-xs text-muted-foreground italic">{offer.notes}</p>}

                    <div className="flex items-center gap-2 pt-1">
                      <Button variant={isCompared ? "default" : "outline"} size="sm" onClick={() => toggleCompare(offer.id)} className="flex-1">
                        <Scale className="w-3.5 h-3.5 mr-1" /> {isCompared ? "Comparing" : "Compare"}
                      </Button>
                      {offer.status === "negotiating" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => updateStatus(offer.id, "accepted")} className="text-success hover:text-success">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => updateStatus(offer.id, "declined")} className="text-destructive hover:text-destructive">
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteOffer(offer.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CompStat({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className={`text-sm font-bold ${highlight ? "text-accent" : "text-foreground"}`}>{fmt(value)}</p>
    </div>
  );
}
