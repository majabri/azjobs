import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  FileText,
  Plus,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Contract, Milestone } from "./types";
import { MILESTONE_STATUS_CONFIG } from "./types";

export default function ContractManagement() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(
    null,
  );
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);

  // Milestone form
  const [msFormOpen, setMsFormOpen] = useState(false);
  const [msForm, setMsForm] = useState({
    title: "",
    description: "",
    amount: "",
    dueDate: "",
  });
  const [msCreating, setMsCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .or(`employer_id.eq.${session.user.id},talent_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false });
      if (error) toast.error("Failed to load contracts");
      else setContracts((data as unknown as Contract[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const loadMilestones = async (contractId: string) => {
    setMilestonesLoading(true);
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .eq("contract_id", contractId)
      .order("due_date", { ascending: true });
    if (error) toast.error("Failed to load milestones");
    else setMilestones((data as unknown as Milestone[]) || []);
    setMilestonesLoading(false);
  };

  const selectContract = (c: Contract) => {
    setSelectedContract(c);
    loadMilestones(c.id);
  };

  const createMilestone = async () => {
    if (!selectedContract || !msForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setMsCreating(true);
    const { error } = await supabase.from("milestones").insert({
      contract_id: selectedContract.id,
      title: msForm.title,
      description: msForm.description,
      amount: msForm.amount ? Number(msForm.amount) : 0,
      due_date: msForm.dueDate ?? "",
      status: "pending",
    } as any);
    if (error) toast.error("Failed to create milestone");
    else {
      toast.success("Milestone added!");
      setMsFormOpen(false);
      setMsForm({ title: "", description: "", amount: "", dueDate: "" });
      loadMilestones(selectedContract.id);
    }
    setMsCreating(false);
  };

  const updateMilestoneStatus = async (id: string, status: string) => {
    const update: any = { status, updated_at: new Date().toISOString() };
    if (status === "completed") {
      update.completed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("milestones")
      .update(update)
      .eq("id", id);
    if (error) toast.error("Failed to update");
    else {
      toast.success(`Milestone ${status}`);
      if (selectedContract) loadMilestones(selectedContract.id);
    }
  };

  const statusColor: Record<string, string> = {
    active: "bg-success/10 text-success",
    completed: "bg-muted text-muted-foreground",
    closed: "bg-destructive/10 text-destructive",
  };

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (selectedContract) {
    return (
      <div className="space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedContract(null);
            setMilestones([]);
          }}
        >
          ← Back to Contracts
        </Button>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Contract #{selectedContract.id.slice(0, 8)}
              </h2>
              <Badge
                className={statusColor[selectedContract.status] || ""}
                variant="outline"
              >
                {selectedContract.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Agreed Price</p>
                <p className="font-medium">
                  ${selectedContract.agreed_price.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timeline</p>
                <p className="font-medium">
                  {selectedContract.agreed_timeline_days
                    ? `${selectedContract.agreed_timeline_days} days`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Started</p>
                <p className="font-medium">
                  {format(new Date(selectedContract.started_at), "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium capitalize">
                  {selectedContract.status}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Milestones */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Milestones</h3>
          <Button
            size="sm"
            onClick={() => setMsFormOpen(true)}
            className="gap-1"
          >
            <Plus className="w-4 h-4" /> Add Milestone
          </Button>
        </div>

        {milestonesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : milestones.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No milestones yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {milestones.map((ms, idx) => {
              const sc =
                MILESTONE_STATUS_CONFIG[ms.status] ||
                MILESTONE_STATUS_CONFIG.pending;
              return (
                <Card key={ms.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center mt-1">
                          <div
                            className={`w-3 h-3 rounded-full ${ms.status === "completed" || ms.status === "reviewed" ? "bg-success" : ms.status === "in_progress" ? "bg-primary" : "bg-muted-foreground/30"}`}
                          />
                          {idx < milestones.length - 1 && (
                            <div className="w-px h-8 bg-border mt-1" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{ms.title}</p>
                          {ms.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {ms.description}
                            </p>
                          )}
                          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                            {ms.amount > 0 && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />$
                                {ms.amount.toLocaleString()}
                              </span>
                            )}
                            {ms.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(ms.due_date), "MMM d")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={sc.class} variant="outline">
                          {sc.label}
                        </Badge>
                        {ms.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateMilestoneStatus(ms.id, "in_progress")
                            }
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        )}
                        {ms.status === "in_progress" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateMilestoneStatus(ms.id, "completed")
                            }
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Milestone Form Dialog */}
        <Dialog
          open={msFormOpen}
          onOpenChange={(o) => {
            if (!o) setMsFormOpen(false);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Milestone</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Title *
                </label>
                <Input
                  value={msForm.title}
                  onChange={(e) =>
                    setMsForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Design mockups"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <Textarea
                  value={msForm.description}
                  onChange={(e) =>
                    setMsForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="h-20 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Amount ($)
                  </label>
                  <Input
                    type="number"
                    value={msForm.amount}
                    onChange={(e) =>
                      setMsForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    placeholder="500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={msForm.dueDate}
                    onChange={(e) =>
                      setMsForm((prev) => ({
                        ...prev,
                        dueDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMsFormOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createMilestone} disabled={msCreating}>
                  {msCreating && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}{" "}
                  Add Milestone
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Contracts</h2>
      {contracts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No contracts yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {contracts.map((c) => (
            <Card
              key={c.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => selectContract(c)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">Contract #{c.id.slice(0, 8)}</p>
                    <Badge
                      className={statusColor[c.status] || ""}
                      variant="outline"
                    >
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>${c.agreed_price.toLocaleString()}</span>
                    <span>
                      Started {format(new Date(c.started_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
