import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, MapPin, Clock, Send, Mail, CheckCircle, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import SkillsTagInput from "@/components/hiring-manager/SkillsTagInput";

interface TalentProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  location: string | null;
  summary: string | null;
  skills: string[] | null;
  career_level: string | null;
  work_experience: any;
  education: any;
  certifications: string[] | null;
  preferred_job_types: string[] | null;
  remote_only: boolean | null;
  salary_min: string | null;
  salary_max: string | null;
  last_active_at: string | null;
}

interface ActiveJob {
  id: string;
  title: string;
  company: string;
}

interface InviteRecord {
  talent_id: string;
  status: string;
}

const AVAILABILITY_OPTIONS = [
  { value: "all", label: "Any Availability" },
  { value: "now", label: "Available Now" },
  { value: "2weeks", label: "Within 2 Weeks" },
  { value: "1month", label: "Within 1 Month" },
];

export default function TalentSearch() {
  const [profiles, setProfiles] = useState<TalentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [skillsFilter, setSkillsFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [minExperience, setMinExperience] = useState("");

  // Side panel
  const [selectedProfile, setSelectedProfile] = useState<TalentProfile | null>(null);

  // Invite modal
  const [inviteTarget, setInviteTarget] = useState<TalentProfile | null>(null);
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  // Invite statuses
  const [invites, setInvites] = useState<InviteRecord[]>([]);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load profiles
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("job_seeker_profiles")
      .select("id, user_id, full_name, email, location, summary, skills, career_level, work_experience, education, certifications, preferred_job_types, remote_only, salary_min, salary_max, last_active_at")
      .order("last_active_at", { ascending: false })
      .limit(100);

    if (locationFilter.trim()) {
      query = query.ilike("location", `%${locationFilter.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load talent profiles");
      setLoading(false);
      return;
    }
    setProfiles((data as TalentProfile[]) || []);
    setLoading(false);
  }, [locationFilter]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // Load active jobs and invites for the employer
  useEffect(() => {
    const loadEmployerData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [jobsRes, invitesRes] = await Promise.all([
        supabase.from("job_postings").select("id, title, company").eq("user_id", session.user.id).eq("status", "active"),
        supabase.from("talent_invites").select("talent_id, status").eq("employer_id", session.user.id),
      ]);

      if (jobsRes.data) setActiveJobs(jobsRes.data as ActiveJob[]);
      if (invitesRes.data) setInvites(invitesRes.data as InviteRecord[]);
    };
    loadEmployerData();
  }, []);

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = profiles;

    // Text search
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter((p) =>
        (p.full_name?.toLowerCase().includes(q)) ||
        (p.summary?.toLowerCase().includes(q)) ||
        (p.skills?.some((s) => s.toLowerCase().includes(q))) ||
        (p.location?.toLowerCase().includes(q))
      );
    }

    // Skills filter
    if (skillsFilter.length > 0) {
      result = result.filter((p) =>
        skillsFilter.every((skill) =>
          p.skills?.some((s) => s.toLowerCase() === skill.toLowerCase())
        )
      );
    }

    // Availability filter (based on last_active_at)
    if (availabilityFilter !== "all") {
      const now = Date.now();
      const cutoffs: Record<string, number> = {
        now: 3 * 24 * 60 * 60 * 1000,       // 3 days
        "2weeks": 14 * 24 * 60 * 60 * 1000,
        "1month": 30 * 24 * 60 * 60 * 1000,
      };
      const cutoff = cutoffs[availabilityFilter];
      if (cutoff) {
        result = result.filter((p) =>
          p.last_active_at && (now - new Date(p.last_active_at).getTime()) <= cutoff
        );
      }
    }

    // Min experience (estimate from work_experience array length or career_level)
    if (minExperience && Number(minExperience) > 0) {
      const min = Number(minExperience);
      result = result.filter((p) => {
        if (Array.isArray(p.work_experience)) return p.work_experience.length >= min;
        // Fallback: use career_level as rough proxy
        const levelYears: Record<string, number> = { "Entry-Level / Junior": 1, "Mid-Level": 3, "Senior": 5, "Manager": 7, "Director": 10 };
        return (levelYears[p.career_level || ""] || 0) >= min;
      });
    }

    return result;
  }, [profiles, debouncedQuery, skillsFilter, availabilityFilter, minExperience]);

  const getInviteStatus = (userId: string) => {
    const invite = invites.find((i) => i.talent_id === userId);
    return invite?.status || null;
  };

  const handleSendInvite = async () => {
    if (!inviteTarget || !selectedJobId) {
      toast.error("Please select a job posting");
      return;
    }
    setSendingInvite(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Please sign in"); setSendingInvite(false); return; }

    const { error } = await supabase.from("talent_invites").insert({
      talent_id: inviteTarget.user_id,
      job_id: selectedJobId,
      employer_id: session.user.id,
      message: inviteMessage,
      status: "pending",
    });

    if (error) {
      toast.error("Failed to send invite");
    } else {
      toast.success(`Invite sent to ${inviteTarget.full_name || "talent"}!`);
      setInvites((prev) => [...prev, { talent_id: inviteTarget.user_id, status: "pending" }]);
      setInviteTarget(null);
      setSelectedJobId("");
      setInviteMessage("");
    }
    setSendingInvite(false);
  };

  const inviteStatusBadge = (userId: string) => {
    const status = getInviteStatus(userId);
    if (!status) return null;
    const config: Record<string, { icon: typeof Mail; class: string; label: string }> = {
      pending: { icon: Mail, class: "bg-warning/10 text-warning", label: "Invited" },
      viewed: { icon: Eye, class: "bg-primary/10 text-primary", label: "Viewed" },
      accepted: { icon: CheckCircle, class: "bg-success/10 text-success", label: "Accepted" },
      declined: { icon: XCircle, class: "bg-destructive/10 text-destructive", label: "Declined" },
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <Badge className={`${c.class} gap-1 text-xs`} variant="outline">
        <Icon className="w-3 h-3" /> {c.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-primary">Talent Search</h1>
        <p className="text-sm text-muted-foreground">Find and invite candidates for your open positions</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, skills, or keywords..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Skills</label>
              <SkillsTagInput value={skillsFilter} onChange={setSkillsFilter} placeholder="Filter by skills..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Location</label>
              <Input
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="e.g. New York"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Availability</label>
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Min Years Experience</label>
              <Input
                type="number"
                min={0}
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No talent profiles found matching your filters.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className="hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => setSelectedProfile(p)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {(p.full_name || "?")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">
                          {p.full_name || "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {p.career_level || "Professional"}
                        </p>
                      </div>
                    </div>
                    {inviteStatusBadge(p.user_id)}
                  </div>

                  {p.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.summary}</p>
                  )}

                  {/* Top 3 skills */}
                  {p.skills && p.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.skills.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                      {p.skills.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{p.skills.length - 3}</Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {p.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {p.location}
                      </span>
                    )}
                    {p.work_experience && Array.isArray(p.work_experience) && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {p.work_experience.length} role{p.work_experience.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Profile Side Panel */}
      <Sheet open={!!selectedProfile} onOpenChange={(o) => { if (!o) setSelectedProfile(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedProfile && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {(selectedProfile.full_name || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <SheetTitle>{selectedProfile.full_name || "Anonymous"}</SheetTitle>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedProfile.career_level || "Professional"}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Invite button */}
                <Button
                  className="w-full gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInviteTarget(selectedProfile);
                  }}
                  disabled={!!getInviteStatus(selectedProfile.user_id)}
                >
                  <Send className="w-4 h-4" />
                  {getInviteStatus(selectedProfile.user_id) ? `Invite ${getInviteStatus(selectedProfile.user_id)}` : "Invite to Job"}
                </Button>

                {selectedProfile.summary && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Summary</h4>
                    <p className="text-sm text-muted-foreground">{selectedProfile.summary}</p>
                  </div>
                )}

                {selectedProfile.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" /> {selectedProfile.location}
                  </div>
                )}

                {selectedProfile.skills && selectedProfile.skills.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProfile.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProfile.work_experience && Array.isArray(selectedProfile.work_experience) && selectedProfile.work_experience.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Work Experience</h4>
                    <div className="space-y-2">
                      {selectedProfile.work_experience.map((exp: any, i: number) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium">{exp.title || exp.role || "Position"}</p>
                          <p className="text-muted-foreground">{exp.company || ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProfile.education && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Education</h4>
                    {Array.isArray(selectedProfile.education) ? (
                      selectedProfile.education.map((edu: any, i: number) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium">{edu.degree || edu.field || "Degree"}</p>
                          <p className="text-muted-foreground">{edu.school || edu.institution || ""}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">{String(selectedProfile.education)}</p>
                    )}
                  </div>
                )}

                {selectedProfile.certifications && selectedProfile.certifications.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Certifications</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProfile.certifications.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedProfile.salary_min || selectedProfile.salary_max) && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Salary Expectations</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedProfile.salary_min && `$${Number(selectedProfile.salary_min).toLocaleString()}`}
                      {selectedProfile.salary_min && selectedProfile.salary_max && " – "}
                      {selectedProfile.salary_max && `$${Number(selectedProfile.salary_max).toLocaleString()}`}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Invite Modal */}
      <Dialog open={!!inviteTarget} onOpenChange={(o) => { if (!o) { setInviteTarget(null); setSelectedJobId(""); setInviteMessage(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite {inviteTarget?.full_name || "Talent"} to a Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Select Job Posting *</label>
              {activeJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active job postings. Create one first.</p>
              ) : (
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger><SelectValue placeholder="Choose a job..." /></SelectTrigger>
                  <SelectContent>
                    {activeJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title} — {j.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Custom Message</label>
              <Textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Hi! We think you'd be a great fit for this role..."
                className="h-24 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setInviteTarget(null); setSelectedJobId(""); setInviteMessage(""); }}>
                Cancel
              </Button>
              <Button onClick={handleSendInvite} disabled={sendingInvite || !selectedJobId} className="gap-2">
                {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
