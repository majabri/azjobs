import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail, Copy, ExternalLink, Package, Briefcase, CheckCircle2,
  Loader2, Trash2, LayoutDashboard
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ApplicationToolkitProps {
  jobLink: string;
  jobDesc: string;
  resume: string;
  coverLetter: string;
  aiResume: string;
  overallScore: number;
}

interface JobApplication {
  id: string;
  job_title: string;
  company: string;
  job_url: string | null;
  status: string;
  notes: string | null;
  applied_at: string;
}

const STATUS_OPTIONS = ["applied", "interview", "offer", "rejected"] as const;

const statusColors: Record<string, string> = {
  applied: "bg-accent/15 text-accent border-accent/30",
  interview: "bg-warning/15 text-warning border-warning/30",
  offer: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};


export default function ApplicationToolkit({
  jobLink,
  jobDesc,
  resume,
  coverLetter,
  aiResume,
  overallScore,
}: ApplicationToolkitProps) {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trackTitle, setTrackTitle] = useState("");
  const [trackCompany, setTrackCompany] = useState("");

  // Extract job title and company from description
  useEffect(() => {
    if (jobDesc) {
      const firstLine = jobDesc.split("\n").find((l) => l.trim())?.trim() || "";
      setTrackTitle(firstLine.slice(0, 100));
      const companyMatch = jobDesc.match(/(?:at|@|company[:\s]*)\s*([A-Z][A-Za-z0-9 &.]+)/i);
      setTrackCompany(companyMatch?.[1]?.trim() || "");
    }
  }, [jobDesc]);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("job_applications")
      .select("*")
      .order("applied_at", { ascending: false })
      .limit(10);
    if (data) setApplications(data as unknown as JobApplication[]);
    setIsLoading(false);
  };

  const handleTrackApplication = async () => {
    if (!trackTitle.trim()) {
      toast.error("Please enter a job title");
      return;
    }
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to track applications");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("job_applications").insert({
      user_id: session.user.id,
      job_title: trackTitle.trim(),
      company: trackCompany.trim(),
      job_url: jobLink || null,
      status: "applied",
      notes: `Fit score: ${overallScore}%`,
    } as any);

    if (error) {
      toast.error("Failed to save application");
    } else {
      toast.success("Application tracked!");
      loadApplications();
    }
    setIsSaving(false);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await supabase
      .from("job_applications")
      .update({ status, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    toast.success(`Status updated to ${status}`);
  };

  const handleDeleteApplication = async (id: string) => {
    await supabase.from("job_applications").delete().eq("id", id);
    setApplications((prev) => prev.filter((a) => a.id !== id));
    toast.success("Application removed");
  };

  // Build application package text
  const getApplicationPackage = () => {
    const finalResume = aiResume || resume;
    let pkg = "=== APPLICATION PACKAGE ===\n\n";
    pkg += "--- RESUME ---\n" + finalResume + "\n\n";
    if (coverLetter) {
      pkg += "--- COVER LETTER ---\n" + coverLetter + "\n\n";
    }
    if (jobLink) {
      pkg += "--- JOB LINK ---\n" + jobLink + "\n";
    }
    return pkg;
  };

  const handleCopyPackage = () => {
    navigator.clipboard.writeText(getApplicationPackage());
    toast.success("Application package copied to clipboard!");
  };

  // Build mailto link
  const getMailtoLink = () => {
    const subject = encodeURIComponent(`Application: ${trackTitle || "Job Application"}`);
    const body = encodeURIComponent(
      `Dear Hiring Manager,\n\n${coverLetter || "Please find my resume attached for your consideration."}\n\n---\nResume:\n${aiResume || resume}\n\nBest regards`
    );
    return `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-card space-y-6">
      <h3 className="font-display font-bold text-primary text-lg flex items-center gap-2">
        <Package className="w-5 h-5 text-accent" /> Application Toolkit
      </h3>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Apply Now */}
        {jobLink && (
          <a
            href={jobLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 rounded-xl gradient-teal text-sm font-bold text-white shadow-lg hover:opacity-90 transition-opacity text-center justify-center"
          >
            <ExternalLink className="w-4 h-4" /> Apply Now
          </a>
        )}

        {/* Mailto */}
        <a
          href={getMailtoLink()}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted border border-border text-sm font-medium text-foreground hover:border-accent hover:text-accent transition-colors justify-center"
        >
          <Mail className="w-4 h-4" /> Email Application
        </a>

        {/* Copy Package */}
        <Button
          variant="outline"
          className="h-auto py-3 text-sm"
          onClick={handleCopyPackage}
        >
          <Copy className="w-4 h-4 mr-1.5" /> Copy All Materials
        </Button>

        {/* Track */}
        <Button
          variant="outline"
          className="h-auto py-3 text-sm"
          onClick={handleTrackApplication}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Briefcase className="w-4 h-4 mr-1.5" />
          )}
          Track Application
        </Button>
      </div>

      {/* Track form */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Job Title</label>
          <Input
            value={trackTitle}
            onChange={(e) => setTrackTitle(e.target.value)}
            placeholder="e.g. Senior Product Manager"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Company</label>
          <Input
            value={trackCompany}
            onChange={(e) => setTrackCompany(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="text-sm"
          />
        </div>
      </div>

      {/* Tracked Applications */}
      {applications.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
            <Briefcase className="w-4 h-4" /> Your Applications ({applications.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {applications.map((app) => (
              <div
                key={app.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {app.job_title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {app.company || "Unknown company"} • {new Date(app.applied_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    className="text-xs rounded-lg px-2 py-1 bg-background border border-border text-foreground"
                    value={app.status}
                    onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${statusColors[app.status] || ""}`}
                  >
                    {app.status}
                  </Badge>
                  {app.job_url && (
                    <a href={app.job_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-accent" />
                    </a>
                  )}
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => handleDeleteApplication(app.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading applications…
        </div>
      )}

      {/* Dashboard Link */}
      <div className="flex justify-center pt-2">
        <Button
          variant="outline"
          onClick={() => navigate("/applications")}
          className="text-sm"
        >
          <LayoutDashboard className="w-4 h-4 mr-1.5" /> Open Applications Dashboard
        </Button>
      </div>

    </div>
  );
}
