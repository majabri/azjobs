import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Edit2, Eye, Pause, Play, XCircle, Trash2, FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import type { JobPostingFormData } from "./JobPostingForm";
import JobPostingPreview from "./JobPostingPreview";

interface JobPosting {
  id: string;
  title: string;
  company: string;
  description: string;
  department: string | null;
  location: string | null;
  job_type: string | null;
  is_remote: boolean | null;
  salary_min: number | null;
  salary_max: number | null;
  requirements: string | null;
  nice_to_haves: string | null;
  status: string;
  candidates_matched: number | null;
  created_at: string;
  skills: string[] | null;
  experience_level: string | null;
  benefits: string[] | null;
  remote_type: string | null;
}

const statusConfig: Record<string, { class: string; label: string }> = {
  draft: { class: "bg-muted text-muted-foreground", label: "Draft" },
  active: { class: "bg-success/10 text-success", label: "Active" },
  paused: { class: "bg-warning/10 text-warning", label: "Paused" },
  closed: { class: "bg-destructive/10 text-destructive", label: "Closed" },
};

interface Props {
  onEdit: (data: JobPostingFormData) => void;
  onNew: () => void;
  refreshKey: number;
}

export default function JobPostingList({ onEdit, onNew, refreshKey }: Props) {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewPosting, setViewPosting] = useState<JobPosting | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("job_postings")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) toast.error("Failed to load postings");
    else setPostings((data as unknown as JobPosting[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("job_postings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Failed to update status");
    else { toast.success(`Posting ${status}`); load(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("job_postings").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Posting deleted"); load(); }
  };

  const toFormData = (p: JobPosting): JobPostingFormData => ({
    id: p.id,
    title: p.title,
    company: p.company,
    description: p.description,
    salaryMin: p.salary_min?.toString() || "",
    salaryMax: p.salary_max?.toString() || "",
    remoteType: p.remote_type || (p.is_remote ? "remote" : "on-site"),
    skills: p.skills || [],
    experienceLevel: p.experience_level || "",
    benefits: p.benefits || [],
    location: p.location || "",
    jobType: p.job_type || "full-time",
    requirements: p.requirements || "",
    niceToHaves: p.nice_to_haves || "",
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Your Job Postings</h2>
          <p className="text-sm text-muted-foreground">{postings.length} posting{postings.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={onNew} className="gap-2">
          <Plus className="w-4 h-4" /> New Posting
        </Button>
      </div>

      {postings.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No job postings yet. Create your first one!</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Applications</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {postings.map((p) => {
                const sc = statusConfig[p.status] || statusConfig.draft;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.company}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={sc.class} variant="outline">{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {p.candidates_matched ?? 0}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(p.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewPosting(p)} title="View">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(toFormData(p))} title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {p.status === "active" && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, "paused")} title="Pause">
                            <Pause className="w-4 h-4" />
                          </Button>
                        )}
                        {p.status === "paused" && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, "active")} title="Resume">
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        {p.status !== "closed" && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, "closed")} title="Close">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)} title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewPosting} onOpenChange={(o) => { if (!o) setViewPosting(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewPosting && (
            <>
              <DialogHeader>
                <DialogTitle>Job Posting Preview</DialogTitle>
              </DialogHeader>
              <JobPostingPreview
                data={toFormData(viewPosting)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
