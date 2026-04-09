import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Project, Proposal } from "./types";
import { PROPOSAL_STATUS_CONFIG } from "./types";

interface Props {
  project: Project;
  onBack: () => void;
}

export default function ProposalManagement({ project, onBack }: Props) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_proposals")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load proposals");
    else setProposals((data as unknown as Proposal[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [project.id]);

  const updateStatus = async (id: string, status: string) => {
    setActing(id);
    const { error } = await supabase
      .from("project_proposals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error(`Failed to ${status} proposal`);
    } else {
      toast.success(`Proposal ${status}!`);
      if (status === "accepted") {
        // Create contract via edge function
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.functions.invoke("project-service", {
            body: { action: "create_contract", proposal_id: id },
          });
        }
      }
      load();
    }
    setActing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h2 className="text-lg font-semibold">Proposals for: {project.title}</h2>
          <p className="text-sm text-muted-foreground">{proposals.length} proposal{proposals.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : proposals.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No proposals yet.</CardContent></Card>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Talent</TableHead>
                <TableHead>Proposed Rate</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map(p => {
                const sc = PROPOSAL_STATUS_CONFIG[p.status] || PROPOSAL_STATUS_CONFIG.pending;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.talent_id.slice(0, 8)}...</TableCell>
                    <TableCell>${p.price.toLocaleString()}</TableCell>
                    <TableCell>{p.timeline_days ? `${p.timeline_days} days` : "—"}</TableCell>
                    <TableCell><Badge className={sc.class} variant="outline">{sc.label}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {p.status === "pending" && (
                          <>
                            <Button size="sm" variant="ghost" disabled={acting === p.id} onClick={() => updateStatus(p.id, "accepted")} className="text-success gap-1">
                              {acting === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Accept
                            </Button>
                            <Button size="sm" variant="ghost" disabled={acting === p.id} onClick={() => updateStatus(p.id, "rejected")} className="text-destructive gap-1">
                              <XCircle className="w-4 h-4" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
