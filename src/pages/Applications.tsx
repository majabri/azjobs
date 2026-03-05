import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Briefcase, Search, Filter, Trash2, ExternalLink,
  CalendarClock, CheckCircle2, Loader2, Bell, BellOff, Clock
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";

interface JobApplication {
  id: string;
  job_title: string;
  company: string;
  job_url: string | null;
  status: string;
  notes: string | null;
  applied_at: string;
  updated_at: string;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  followed_up: boolean;
}

const STATUS_OPTIONS = ["applied", "interview", "offer", "rejected"] as const;

const statusColors: Record<string, string> = {
  applied: "bg-accent/15 text-accent border-accent/30",
  interview: "bg-warning/15 text-warning border-warning/30",
  offer: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusIcons: Record<string, string> = {
  applied: "📤",
  interview: "🎤",
  offer: "🎉",
  rejected: "❌",
};

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingFollowUp, setEditingFollowUp] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("job_applications")
      .select("*")
      .order("applied_at", { ascending: false });
    if (data) setApplications(data as unknown as JobApplication[]);
    setIsLoading(false);
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

  const handleDelete = async (id: string) => {
    await supabase.from("job_applications").delete().eq("id", id);
    setApplications((prev) => prev.filter((a) => a.id !== id));
    toast.success("Application removed");
  };

  const handleSetFollowUp = async (id: string) => {
    if (!followUpDate) {
      toast.error("Please select a follow-up date");
      return;
    }
    await supabase
      .from("job_applications")
      .update({
        follow_up_date: new Date(followUpDate).toISOString(),
        follow_up_notes: followUpNotes,
        followed_up: false,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", id);
    setApplications((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, follow_up_date: new Date(followUpDate).toISOString(), follow_up_notes: followUpNotes, followed_up: false }
          : a
      )
    );
    setEditingFollowUp(null);
    setFollowUpDate("");
    setFollowUpNotes("");
    toast.success("Follow-up reminder set!");
  };

  const handleMarkFollowedUp = async (id: string) => {
    await supabase
      .from("job_applications")
      .update({ followed_up: true, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, followed_up: true } : a))
    );
    toast.success("Marked as followed up!");
  };

  const handleClearFollowUp = async (id: string) => {
    await supabase
      .from("job_applications")
      .update({ follow_up_date: null, follow_up_notes: "", followed_up: false, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, follow_up_date: null, follow_up_notes: null, followed_up: false } : a))
    );
    toast.success("Follow-up cleared");
  };

  const filtered = applications.filter((app) => {
    const matchesSearch =
      !searchQuery ||
      app.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const needsFollowUp = applications.filter(
    (a) => a.follow_up_date && !a.followed_up && new Date(a.follow_up_date) <= new Date()
  );

  const stats = {
    total: applications.length,
    applied: applications.filter((a) => a.status === "applied").length,
    interview: applications.filter((a) => a.status === "interview").length,
    offer: applications.filter((a) => a.status === "offer").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-hero text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold flex items-center gap-2">
                <Briefcase className="w-6 h-6" /> Applications Dashboard
              </h1>
              <p className="text-primary-foreground/60 text-sm mt-0.5">
                Track, manage & follow up on your job applications
              </p>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Follow-up Alerts */}
        {needsFollowUp.length > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 animate-fade-up">
            <h3 className="text-sm font-bold text-warning flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4" /> Follow-Up Reminders ({needsFollowUp.length})
            </h3>
            <div className="space-y-2">
              {needsFollowUp.map((app) => (
                <div key={app.id} className="flex items-center justify-between bg-background rounded-xl p-3 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{app.job_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.company} — Due {new Date(app.follow_up_date!).toLocaleDateString()}
                    </p>
                    {app.follow_up_notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{app.follow_up_notes}"</p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => handleMarkFollowedUp(app.id)} className="text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Applied", value: stats.applied, color: "text-accent" },
            { label: "Interview", value: stats.interview, color: "text-warning" },
            { label: "Offer", value: stats.offer, color: "text-success" },
            { label: "Rejected", value: stats.rejected, color: "text-destructive" },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-xl p-4 border border-border shadow-card text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or company…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", ...STATUS_OPTIONS].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="capitalize text-xs"
              >
                {s === "all" ? "All" : `${statusIcons[s]} ${s}`}
              </Button>
            ))}
          </div>
        </div>

        {/* Applications List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading applications…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No applications yet</p>
            <p className="text-sm mt-1">Run an analysis and track your first application!</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/job-seeker")}>
              Go to Job Seeker
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((app, i) => (
              <div
                key={app.id}
                className="bg-card rounded-2xl border border-border shadow-card p-5 space-y-3 animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">{app.job_title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {app.company || "Unknown company"} • Applied {new Date(app.applied_at).toLocaleDateString()}
                    </p>
                    {app.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{app.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className={`capitalize ${statusColors[app.status] || ""}`}>
                      {statusIcons[app.status]} {app.status}
                    </Badge>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                  <select
                    className="text-xs rounded-lg px-2 py-1.5 bg-muted border border-border text-foreground"
                    value={app.status}
                    onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      if (editingFollowUp === app.id) {
                        setEditingFollowUp(null);
                      } else {
                        setEditingFollowUp(app.id);
                        setFollowUpDate(app.follow_up_date ? new Date(app.follow_up_date).toISOString().split("T")[0] : "");
                        setFollowUpNotes(app.follow_up_notes || "");
                      }
                    }}
                  >
                    <CalendarClock className="w-3.5 h-3.5 mr-1" />
                    {app.follow_up_date ? "Edit Follow-Up" : "Set Follow-Up"}
                  </Button>

                  {app.follow_up_date && !app.followed_up && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => handleMarkFollowedUp(app.id)}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Done
                    </Button>
                  )}

                  {app.follow_up_date && app.followed_up && (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                      ✓ Followed up
                    </Badge>
                  )}

                  {app.follow_up_date && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(app.follow_up_date).toLocaleDateString()}
                    </span>
                  )}

                  <div className="flex-1" />

                  {app.job_url && (
                    <a href={app.job_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="text-xs">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> View Job
                      </Button>
                    </a>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDelete(app.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Follow-up editor */}
                {editingFollowUp === app.id && (
                  <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border animate-fade-in">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Follow-up Date</label>
                        <Input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Reminder Notes</label>
                        <Input
                          value={followUpNotes}
                          onChange={(e) => setFollowUpNotes(e.target.value)}
                          placeholder="e.g. Send thank-you email"
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSetFollowUp(app.id)} className="text-xs">
                        <CalendarClock className="w-3.5 h-3.5 mr-1" /> Save Follow-Up
                      </Button>
                      {app.follow_up_date && (
                        <Button variant="outline" size="sm" onClick={() => handleClearFollowUp(app.id)} className="text-xs text-destructive">
                          <BellOff className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setEditingFollowUp(null)} className="text-xs">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
