import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Loader2, Sparkles, Trash2, Edit2, Eye, FileText, MapPin, DollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface JobPosting {
  id: string;
  title: string;
  company: string;
  department: string | null;
  location: string | null;
  job_type: string | null;
  is_remote: boolean | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  requirements: string | null;
  nice_to_haves: string | null;
  status: string;
  candidates_matched: number | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  closed: "bg-destructive/10 text-destructive",
};

export default function JobPostings() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosting | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewPosting, setViewPosting] = useState<JobPosting | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState("full-time");
  const [isRemote, setIsRemote] = useState(false);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [niceToHaves, setNiceToHaves] = useState("");
  const [status, setStatus] = useState("draft");
  const [aiRequirements, setAiRequirements] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");

  useEffect(() => {
    loadPostings();
  }, []);

  const loadPostings = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase
      .from("job_postings")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) toast.error("Failed to load postings");
    else setPostings((data as JobPosting[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle(""); setCompany(""); setDepartment(""); setLocation("");
    setJobType("full-time"); setIsRemote(false); setSalaryMin(""); setSalaryMax("");
    setDescription(""); setRequirements(""); setNiceToHaves(""); setStatus("draft");
    setAiRequirements(""); setAiFeedback(""); setEditing(null);
  };

  const openEdit = (p: JobPosting) => {
    setEditing(p);
    setTitle(p.title); setCompany(p.company); setDepartment(p.department || "");
    setLocation(p.location || ""); setJobType(p.job_type || "full-time");
    setIsRemote(p.is_remote || false); setSalaryMin(p.salary_min?.toString() || "");
    setSalaryMax(p.salary_max?.toString() || ""); setDescription(p.description);
    setRequirements(p.requirements || ""); setNiceToHaves(p.nice_to_haves || "");
    setStatus(p.status);
    setDialogOpen(true);
  };

  const handleAIGenerate = async () => {
    if (!title.trim()) {
      toast.error("Enter a job title first");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-job-posting", {
        body: {
          title, company, department,
          requirements: aiRequirements,
          feedback: aiFeedback,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setTitle(data.title || title);
      setDescription(data.description || "");
      setRequirements(data.requirements || "");
      setNiceToHaves(data.nice_to_haves || "");
      if (data.salary_suggestion_min) setSalaryMin(String(data.salary_suggestion_min));
      if (data.salary_suggestion_max) setSalaryMax(String(data.salary_suggestion_max));
      toast.success("AI generated your job posting!");
    } catch (e: any) {
      toast.error(e.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Please sign in"); setSaving(false); return; }

    const payload = {
      user_id: session.user.id, title, company, department: department || null,
      location: location || null, job_type: jobType, is_remote: isRemote,
      salary_min: salaryMin ? Number(salaryMin) : null,
      salary_max: salaryMax ? Number(salaryMax) : null,
      description, requirements: requirements || null,
      nice_to_haves: niceToHaves || null, status, updated_at: new Date().toISOString(),
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("job_postings").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("job_postings").insert(payload));
    }

    if (error) toast.error("Failed to save");
    else {
      toast.success(editing ? "Updated!" : "Created!");
      resetForm();
      setDialogOpen(false);
      loadPostings();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("job_postings").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Deleted"); loadPostings(); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Job Postings</h1>
          <p className="text-sm text-muted-foreground">Create and manage your job postings</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Posting</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Create"} Job Posting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* AI Generator */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> AI Job Description Writer
                  </p>
                  <Textarea
                    placeholder="Tell AI what you're looking for... e.g. 'Need a senior React developer with 5+ years experience, familiar with AWS and CI/CD pipelines'"
                    value={aiRequirements}
                    onChange={(e) => setAiRequirements(e.target.value)}
                    className="h-20 resize-none text-sm"
                  />
                  <Textarea
                    placeholder="Any additional feedback or refinement..."
                    value={aiFeedback}
                    onChange={(e) => setAiFeedback(e.target.value)}
                    className="h-16 resize-none text-sm"
                  />
                  <Button
                    onClick={handleAIGenerate}
                    disabled={generating || !title.trim()}
                    size="sm"
                    className="gap-2"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? "Generating..." : "Generate with AI"}
                  </Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Job Title *</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Software Engineer" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Company</label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Department</label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Location</label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="New York, NY" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Job Type</label>
                  <Select value={jobType} onValueChange={setJobType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Salary Min ($)</label>
                  <Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="80000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Salary Max ($)</label>
                  <Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="120000" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="h-40 resize-none" placeholder="Full job description..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Requirements</label>
                <Textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} className="h-24 resize-none" placeholder="- 5+ years experience..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nice to Have</label>
                <Textarea value={niceToHaves} onChange={(e) => setNiceToHaves(e.target.value)} className="h-20 resize-none" placeholder="- Kubernetes experience..." />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editing ? "Update" : "Create"} Posting
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Postings List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : postings.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No job postings yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {postings.map((p) => (
            <Card key={p.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-primary">{p.title}</h3>
                      <Badge className={statusColors[p.status] || ""} variant="outline">
                        {p.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                      {p.company && <span>{p.company}</span>}
                      {p.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {p.location}
                        </span>
                      )}
                      {p.job_type && <span className="capitalize">{p.job_type}</span>}
                      {(p.salary_min || p.salary_max) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {p.salary_min ? `$${Number(p.salary_min).toLocaleString()}` : ""}
                          {p.salary_min && p.salary_max ? " – " : ""}
                          {p.salary_max ? `$${Number(p.salary_max).toLocaleString()}` : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <Button variant="ghost" size="sm" onClick={() => setViewPosting(p)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewPosting} onOpenChange={(o) => { if (!o) setViewPosting(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewPosting && (
            <>
              <DialogHeader>
                <DialogTitle>{viewPosting.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge className={statusColors[viewPosting.status]} variant="outline">{viewPosting.status}</Badge>
                  {viewPosting.company && <Badge variant="outline">{viewPosting.company}</Badge>}
                  {viewPosting.location && <Badge variant="outline">{viewPosting.location}</Badge>}
                  {viewPosting.job_type && <Badge variant="outline" className="capitalize">{viewPosting.job_type}</Badge>}
                </div>
                {viewPosting.description && (
                  <div>
                    <h4 className="font-medium mb-1">Description</h4>
                    <p className="whitespace-pre-wrap text-muted-foreground">{viewPosting.description}</p>
                  </div>
                )}
                {viewPosting.requirements && (
                  <div>
                    <h4 className="font-medium mb-1">Requirements</h4>
                    <p className="whitespace-pre-wrap text-muted-foreground">{viewPosting.requirements}</p>
                  </div>
                )}
                {viewPosting.nice_to_haves && (
                  <div>
                    <h4 className="font-medium mb-1">Nice to Have</h4>
                    <p className="whitespace-pre-wrap text-muted-foreground">{viewPosting.nice_to_haves}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
