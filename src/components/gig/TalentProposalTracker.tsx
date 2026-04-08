import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Proposal } from "./types";
import { PROPOSAL_STATUS_CONFIG } from "./types";

export default function TalentProposalTracker() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("project_proposals")
        .select("*")
        .eq("talent_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) toast.error("Failed to load proposals");
      else setProposals((data as unknown as Proposal[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (proposals.length === 0) {
    return (
      <Card><CardContent className="py-16 text-center text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No proposals submitted yet. Browse projects to get started!</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{proposals.length} proposal{proposals.length !== 1 ? "s" : ""}</p>
      {proposals.map(p => {
        const sc = PROPOSAL_STATUS_CONFIG[p.status] || PROPOSAL_STATUS_CONFIG.pending;
        return (
          <Card key={p.id} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">Proposal #{p.id.slice(0, 8)}</p>
                  <Badge className={sc.class} variant="outline">{sc.label}</Badge>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>${p.price.toLocaleString()}</span>
                  {p.timeline_days && <span>{p.timeline_days} days</span>}
                  <span>{format(new Date(p.created_at), "MMM d, yyyy")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Updated {format(new Date(p.updated_at), "MMM d, h:mm a")}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
