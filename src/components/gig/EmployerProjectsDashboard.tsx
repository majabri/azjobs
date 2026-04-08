import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Briefcase, FileText, DollarSign, Users, Plus, Edit2, Eye, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Project } from "./types";
import { PROJECT_STATUS_CONFIG } from "./types";

interface Props {
  onNew: () => void;
  onEdit: (p: Project) => void;
  onView: (p: Project) => void;
  onManageProposals: (p: Project) => void;
  refreshKey: number;
}

export default function EmployerProjectsDashboard({ onNew, onEdit, onView, onManageProposals, refreshKey }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("employer_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) toast.error("Failed to load projects");
      else setProjects((data as unknown as Project[]) || []);
      setLoading(false);
    };
    load();
  }, [refreshKey]);

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === "open" || p.status === "in_progress").length;
  const totalProposals = projects.reduce((sum, p) => sum + p.proposals_count, 0);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("projects").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error("Failed to update");
    else { toast.success(`Project ${status}`); setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p)); }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Briefcase, label: "Total Projects", value: totalProjects },
          { icon: FileText, label: "Active Projects", value: activeProjects },
          { icon: Users, label: "Proposals Received", value: totalProposals },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Project List */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Projects</h2>
        <Button onClick={onNew} className="gap-2"><Plus className="w-4 h-4" /> New Project</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : projects.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No projects yet. Post your first one!</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {projects.map(p => {
            const sc = PROJECT_STATUS_CONFIG[p.status] || PROJECT_STATUS_CONFIG.open;
            return (
              <Card key={p.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{p.title}</h3>
                      <Badge className={sc.class} variant="outline">{sc.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {(p.budget_min || p.budget_max) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {p.budget_min && p.budget_max ? `$${p.budget_min.toLocaleString()} – $${p.budget_max.toLocaleString()}` : p.budget_max ? `Up to $${p.budget_max.toLocaleString()}` : `From $${p.budget_min!.toLocaleString()}`}
                        </span>
                      )}
                      <span>{p.proposals_count} proposal{p.proposals_count !== 1 ? "s" : ""}</span>
                      <span>{format(new Date(p.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <Button variant="ghost" size="sm" onClick={() => onView(p)} title="View"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(p)} title="Edit"><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onManageProposals(p)} title="Proposals"><Users className="w-4 h-4" /></Button>
                    {p.status !== "closed" && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => updateStatus(p.id, "closed")} title="Close"><XCircle className="w-4 h-4" /></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
