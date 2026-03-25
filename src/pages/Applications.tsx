import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Briefcase, Search, Trash2, ExternalLink,
  CalendarClock, CheckCircle2, Loader2, Bell, BellOff, Clock,
  Plus, Mail, GripVertical
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import ApplicationTimeline from "@/components/ApplicationTimeline";

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

const COLUMNS = [
  { id: "applied", label: "Applied", emoji: "📤", color: "border-accent/40 bg-accent/5" },
  { id: "interview", label: "Interview", emoji: "🎤", color: "border-warning/40 bg-warning/5" },
  { id: "offer", label: "Offer", emoji: "🎉", color: "border-success/40 bg-success/5" },
  { id: "rejected", label: "Rejected", emoji: "❌", color: "border-destructive/40 bg-destructive/5" },
] as const;

const statusColors: Record<string, string> = {
  applied: "bg-accent/15 text-accent border-accent/30",
  interview: "bg-warning/15 text-warning border-warning/30",
  offer: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "timeline">("kanban");
  const [editingFollowUp, setEditingFollowUp] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [addingApp, setAddingApp] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCompany, setNewCompany] = useState("");

  useEffect(() => { loadApplications(); }, []);

  const loadApplications = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("job_applications").select("*").order("applied_at", { ascending: false });
    if (data) setApplications(data as unknown as JobApplication[]);
    setIsLoading(false);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await supabase.from("job_applications").update({ status, updated_at: new Date().toISOString() } as any).eq("id", id);
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    toast.success(`Moved to ${status}`);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("job_applications").delete().eq("id", id);
    setApplications((prev) => prev.filter((a) => a.id !== id));
    toast.success("Application removed");
  };

  const handleSetFollowUp = async (id: string) => {
    if (!followUpDate) { toast.error("Please select a follow-up date"); return; }
    await supabase.from("job_applications").update({
      follow_up_date: new Date(followUpDate).toISOString(),
      follow_up_notes: followUpNotes,
      followed_up: false,
      updated_at: new Date().toISOString(),
    } as any).eq("id", id);
    setApplications((prev) =>
      prev.map((a) => a.id === id ? { ...a, follow_up_date: new Date(followUpDate).toISOString(), follow_up_notes: followUpNotes, followed_up: false } : a)
    );
    setEditingFollowUp(null);
    setFollowUpDate("");
    setFollowUpNotes("");
    toast.success("Follow-up set!");
  };

  const handleMarkFollowedUp = async (id: string) => {
    await supabase.from("job_applications").update({ followed_up: true, updated_at: new Date().toISOString() } as any).eq("id", id);
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, followed_up: true } : a)));
    toast.success("Marked as followed up!");
  };

  const handleAddApplication = async () => {
    if (!newTitle.trim()) { toast.error("Enter a job title"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Please sign in"); return; }
    const { error } = await supabase.from("job_applications").insert({
      user_id: session.user.id,
      job_title: newTitle.trim(),
      company: newCompany.trim(),
      status: "applied",
    } as any);
    if (error) { toast.error("Failed to add"); return; }
    setNewTitle("");
    setNewCompany("");
    setAddingApp(false);
    loadApplications();
    toast.success("Application added!");
  };

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    handleUpdateStatus(draggableId, newStatus);
  }, []);

  const filtered = applications.filter((app) =>
    !searchQuery || app.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const getColumnApps = (status: string) => filtered.filter((a) => a.status === status);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold flex items-center gap-2">
                <Briefcase className="w-6 h-6" /> Applications
              </h1>
              <p className="text-primary-foreground/60 text-sm mt-0.5">Track, manage & follow up on your job applications</p>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Offer Auto-Prompt Banner */}
        {stats.offer > 0 && (
          <div className="bg-success/10 border border-success/30 rounded-2xl p-4 animate-fade-up flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-success flex items-center gap-2">
                🎉 You have {stats.offer} offer{stats.offer > 1 ? "s" : ""}!
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Save your offer details and launch the negotiation engine to maximize your compensation.</p>
            </div>
            <Button size="sm" className="gradient-teal text-white" onClick={() => navigate("/offers")}>
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Manage Offers
            </Button>
          </div>
        )}

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
                    <p className="text-xs text-muted-foreground">{app.company} — Due {new Date(app.follow_up_date!).toLocaleDateString()}</p>
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

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by title or company…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" onClick={() => setViewMode("kanban")} className="text-xs">Board</Button>
            <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")} className="text-xs">List</Button>
            <Button variant={viewMode === "timeline" ? "default" : "outline"} size="sm" onClick={() => setViewMode("timeline")} className="text-xs">Timeline</Button>
            <Button variant="outline" size="sm" onClick={() => setAddingApp(!addingApp)} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>

        {/* Quick Add */}
        {addingApp && (
          <div className="bg-card rounded-xl p-4 border border-border shadow-card flex flex-col sm:flex-row gap-3 animate-fade-in">
            <Input placeholder="Job Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="flex-1" />
            <Input placeholder="Company" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} className="flex-1" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddApplication}>Add</Button>
              <Button variant="ghost" size="sm" onClick={() => setAddingApp(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : viewMode === "timeline" ? (
          <ApplicationTimeline applications={filtered as any} />
        ) : viewMode === "kanban" ? (
          /* KANBAN VIEW */
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {COLUMNS.map((col) => {
                const colApps = getColumnApps(col.id);
                return (
                  <div key={col.id} className={`rounded-2xl border-2 ${col.color} p-3 min-h-[200px]`}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <span>{col.emoji}</span> {col.label}
                        <Badge variant="secondary" className="text-xs ml-1">{colApps.length}</Badge>
                      </h3>
                    </div>
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`space-y-2 min-h-[100px] rounded-xl transition-colors ${snapshot.isDraggingOver ? "bg-accent/10" : ""}`}
                        >
                          {colApps.map((app, index) => (
                            <Draggable key={app.id} draggableId={app.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`bg-card rounded-xl border border-border p-3 shadow-sm transition-shadow ${snapshot.isDragging ? "shadow-elevated rotate-1" : "hover:shadow-card"}`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div {...provided.dragHandleProps} className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab">
                                      <GripVertical className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-foreground truncate">{app.job_title}</p>
                                      <p className="text-xs text-muted-foreground truncate">{app.company || "—"}</p>
                                      <p className="text-[10px] text-muted-foreground mt-1">
                                        {new Date(app.applied_at).toLocaleDateString()}
                                      </p>
                                      {app.follow_up_date && !app.followed_up && (
                                        <div className="flex items-center gap-1 mt-1.5">
                                          <Clock className="w-3 h-3 text-warning" />
                                          <span className="text-[10px] text-warning font-medium">
                                            Follow up {new Date(app.follow_up_date).toLocaleDateString()}
                                          </span>
                                        </div>
                                      )}
                                      {app.followed_up && (
                                        <Badge variant="outline" className="text-[10px] mt-1 border-success/30 text-success">✓ Followed up</Badge>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      {app.job_url && (
                                        <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent">
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                      <button
                                        onClick={() => {
                                          if (editingFollowUp === app.id) {
                                            setEditingFollowUp(null);
                                          } else {
                                            setEditingFollowUp(app.id);
                                            setFollowUpDate(app.follow_up_date ? new Date(app.follow_up_date).toISOString().split("T")[0] : "");
                                            setFollowUpNotes(app.follow_up_notes || "");
                                          }
                                        }}
                                        className="text-muted-foreground hover:text-accent"
                                      >
                                        <CalendarClock className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => handleDelete(app.id)} className="text-muted-foreground hover:text-destructive">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {editingFollowUp === app.id && (
                                    <div className="mt-3 pt-2 border-t border-border space-y-2">
                                      <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="text-xs h-8" />
                                      <Input value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} placeholder="Reminder notes…" className="text-xs h-8" />
                                      <div className="flex gap-1">
                                        <Button size="sm" className="text-[10px] h-6 px-2" onClick={() => handleSetFollowUp(app.id)}>Save</Button>
                                        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => setEditingFollowUp(null)}>Cancel</Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        ) : (
          /* LIST VIEW */
          filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No applications yet</p>
              <p className="text-sm mt-1">Run an analysis and track your first application!</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/job-seeker")}>Go to Job Seeker</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((app, i) => (
                <div key={app.id} className="bg-card rounded-2xl border border-border shadow-card p-5 space-y-3 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground truncate">{app.job_title}</h3>
                      <p className="text-sm text-muted-foreground">{app.company || "Unknown"} • Applied {new Date(app.applied_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className={`capitalize ${statusColors[app.status] || ""}`}>
                      {app.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                    <select
                      className="text-xs rounded-lg px-2 py-1.5 bg-muted border border-border text-foreground"
                      value={app.status}
                      onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                    >
                      {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    {app.follow_up_date && !app.followed_up && (
                      <span className="text-xs text-warning flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(app.follow_up_date).toLocaleDateString()}
                      </span>
                    )}
                    <div className="flex-1" />
                    {app.job_url && (
                      <a href={app.job_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="text-xs"><ExternalLink className="w-3.5 h-3.5 mr-1" /> View</Button>
                      </a>
                    )}
                    <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(app.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
