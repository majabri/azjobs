import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Loader2, Trash2, Edit2, Calendar, Clock, Video, MapPin, Star,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useInterviewSchedules, useCreateInterviewSchedule, useDeleteInterviewSchedule } from "@/hooks/queries/useInterviewSchedules";
import { useJobPostings } from "@/hooks/queries/useJobPostings";
import { useQueryClient } from "@tanstack/react-query";
import { INTERVIEW_SCHEDULES_QUERY_KEY } from "@/hooks/queries/useInterviewSchedules";
import type { Database } from "@/integrations/supabase/types";

type InterviewScheduleRow = Database["public"]["Tables"]["interview_schedules"]["Row"];

interface JobPostingOption {
  id: string;
  title: string;
  company: string;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-warning/10 text-warning",
};

export default function InterviewScheduling() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InterviewScheduleRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [interviewType, setInterviewType] = useState("screening");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("30");
  const [locationVal, setLocationVal] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState("");
  const [jobPostingId, setJobPostingId] = useState("none");

  const { data: interviews = [], isLoading: loading } = useInterviewSchedules();
  const { data: jobPostingsData = [] } = useJobPostings();
  const jobPostings: JobPostingOption[] = jobPostingsData.map(jp => ({ id: jp.id, title: jp.title, company: jp.company }));

  const createScheduleMutation = useCreateInterviewSchedule();
  const deleteScheduleMutation = useDeleteInterviewSchedule();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setCandidateName(""); setCandidateEmail(""); setInterviewType("screening");
    setScheduledAt(""); setDuration("30"); setLocationVal(""); setMeetingLink("");
    setNotes(""); setStatus("scheduled"); setFeedback(""); setRating("");
    setJobPostingId("none"); setEditing(null);
  };

  const openEdit = (i: InterviewScheduleRow) => {
    setEditing(i);
    setCandidateName(i.candidate_name); setCandidateEmail(i.candidate_email || "");
    setInterviewType(i.interview_type); setScheduledAt(i.scheduled_at.slice(0, 16));
    setDuration(String(i.duration_minutes)); setLocationVal(i.location || "");
    setMeetingLink(i.meeting_link || ""); setNotes(i.notes || "");
    setStatus(i.status); setFeedback(i.feedback || "");
    setRating(i.rating?.toString() || ""); setJobPostingId(i.job_posting_id || "none");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!candidateName.trim() || !scheduledAt) {
      toast.error("Name and date are required");
      return;
    }
    setSaving(true);

    const payload = {
      candidate_name: candidateName,
      candidate_email: candidateEmail || null,
      interview_type: interviewType,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: Number(duration),
      location: locationVal || null,
      meeting_link: meetingLink || null,
      notes: notes || null,
      status,
      feedback: feedback || null,
      rating: rating ? Number(rating) : null,
      job_posting_id: jobPostingId === "none" ? null : jobPostingId,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editing) {
        // Update uses direct supabase (no update mutation in hook yet)
        const { error } = await supabase.from("interview_schedules").update(payload).eq("id", editing.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: INTERVIEW_SCHEDULES_QUERY_KEY });
        toast.success("Updated!");
      } else {
        await createScheduleMutation.mutateAsync(payload);
      }
      resetForm();
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteScheduleMutation.mutateAsync(id);
  };

  const upcoming = interviews.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at) >= new Date());
  const past = interviews.filter((i) => i.status !== "scheduled" || new Date(i.scheduled_at) < new Date());

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Interview Scheduling</h1>
          <p className="text-sm text-muted-foreground">{upcoming.length} upcoming interviews</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Schedule Interview</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Schedule"} Interview</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Candidate Name *</label>
                  <Input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="jane@email.com" />
                </div>
              </div>
              {jobPostings.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Job Posting</label>
                  <Select value={jobPostingId} onValueChange={setJobPostingId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No posting linked</SelectItem>
                      {jobPostings.map((jp) => (
                        <SelectItem key={jp.id} value={jp.id}>{jp.title} — {jp.company}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <Select value={interviewType} onValueChange={setInterviewType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="screening">Phone Screen</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="behavioral">Behavioral</SelectItem>
                      <SelectItem value="panel">Panel</SelectItem>
                      <SelectItem value="final">Final Round</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Duration (min)</label>
                  <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date & Time *</label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Location</label>
                  <Input value={locationVal} onChange={(e) => setLocationVal(e.target.value)} placeholder="Room 204 / Office" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Meeting Link</label>
                  <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://zoom.us/..." />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="h-16 resize-none" placeholder="Interview notes..." />
              </div>
              {(status === "completed") && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Feedback</label>
                    <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className="h-16 resize-none" placeholder="How did the interview go?" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Rating (1-5)</label>
                    <Input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editing ? "Update" : "Schedule"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : interviews.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No interviews scheduled yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((i) => (
                  <InterviewCard key={i.id} interview={i} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Past / Other</h2>
              <div className="space-y-3">
                {past.map((i) => (
                  <InterviewCard key={i.id} interview={i} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InterviewCard({ interview: i, onEdit, onDelete }: {
  interview: InterviewScheduleRow;
  onEdit: (i: InterviewScheduleRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-primary">{i.candidate_name}</h3>
              <Badge className={statusColors[i.status] || ""} variant="outline">{i.status}</Badge>
              <Badge variant="outline" className="capitalize">{i.interview_type}</Badge>
              {i.rating && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="w-3 h-3" /> {i.rating}/5
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(i.scheduled_at), "MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(i.scheduled_at), "h:mm a")} · {i.duration_minutes}min
              </span>
              {i.meeting_link && (
                <a href={i.meeting_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Video className="w-3 h-3" /> Join
                </a>
              )}
              {i.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {i.location}
                </span>
              )}
            </div>
            {i.feedback && (
              <p className="text-xs text-muted-foreground mt-2 italic">"{i.feedback}"</p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-3">
            <Button variant="ghost" size="sm" onClick={() => onEdit(i)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(i.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
