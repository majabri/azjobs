import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Loader2,
  Search,
  DollarSign,
  Clock,
  Send,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SkillsTagInput from "@/components/hiring-manager/SkillsTagInput";
import type { Project } from "./types";
import { PROJECT_STATUS_CONFIG } from "./types";

export default function TalentProjectBrowser() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [skillsFilter, setSkillsFilter] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  // Detail & proposal
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    price: "",
    timelineDays: "",
    coverMessage: "",
    portfolioLinks: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) toast.error("Failed to load projects");
      else setProjects((data as unknown as Project[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = projects;

    if (skillsFilter.length > 0) {
      result = result.filter((p) =>
        skillsFilter.every((skill) =>
          p.skills_required.some(
            (s) => s.toLowerCase() === skill.toLowerCase(),
          ),
        ),
      );
    }
    if (budgetMin)
      result = result.filter((p) => (p.budget_max || 0) >= Number(budgetMin));
    if (budgetMax)
      result = result.filter((p) => (p.budget_min || 0) <= Number(budgetMax));
    if (timelineFilter !== "all") {
      const max = Number(timelineFilter);
      result = result.filter((p) => p.timeline_days && p.timeline_days <= max);
    }

    if (sortBy === "budget")
      result = [...result].sort(
        (a, b) => (b.budget_max || 0) - (a.budget_max || 0),
      );
    else if (sortBy === "deadline")
      result = [...result].sort(
        (a, b) => (a.timeline_days || 999) - (b.timeline_days || 999),
      );
    // default: recent (already sorted)

    return result;
  }, [projects, skillsFilter, budgetMin, budgetMax, timelineFilter, sortBy]);

  const handleSubmitProposal = async () => {
    if (!selectedProject) return;
    if (!proposalForm.price) {
      toast.error("Proposed rate is required");
      return;
    }
    setSubmitting(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("project_proposals").insert({
      project_id: selectedProject.id,
      talent_id: session.user.id,
      price: Number(proposalForm.price),
      timeline_days: proposalForm.timelineDays
        ? Number(proposalForm.timelineDays)
        : 0,
      cover_message: proposalForm.coverMessage,
      status: "pending",
    });

    if (error) {
      toast.error(
        error.message.includes("already")
          ? "You already submitted a proposal"
          : "Failed to submit proposal",
      );
    } else {
      toast.success("Proposal submitted!");
      setProposalOpen(false);
      setProposalForm({
        price: "",
        timelineDays: "",
        coverMessage: "",
        portfolioLinks: "",
      });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Skills
              </label>
              <SkillsTagInput
                value={skillsFilter}
                onChange={setSkillsFilter}
                placeholder="Filter by skills..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Budget Range ($)
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Timeline
              </label>
              <Select value={timelineFilter} onValueChange={setTimelineFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="7">≤ 1 week</SelectItem>
                  <SelectItem value="14">≤ 2 weeks</SelectItem>
                  <SelectItem value="30">≤ 1 month</SelectItem>
                  <SelectItem value="90">≤ 3 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Sort By
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="budget">Highest Budget</SelectItem>
                  <SelectItem value="deadline">Closest Deadline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No projects match your filters.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} project{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className="hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setSelectedProject(p)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium">{p.title}</h3>
                    <Badge
                      className={PROJECT_STATUS_CONFIG[p.status]?.class}
                      variant="outline"
                    >
                      {PROJECT_STATUS_CONFIG[p.status]?.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {p.description}
                  </p>
                  {p.skills_required.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.skills_required.slice(0, 4).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                      {p.skills_required.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{p.skills_required.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(p.budget_min || p.budget_max) && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {p.budget_min && p.budget_max
                          ? `$${p.budget_min.toLocaleString()} – $${p.budget_max.toLocaleString()}`
                          : p.budget_max
                            ? `Up to $${p.budget_max.toLocaleString()}`
                            : `From $${p.budget_min!.toLocaleString()}`}
                      </span>
                    )}
                    {p.timeline_days && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {p.timeline_days}d
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Project Detail Side Panel */}
      <Sheet
        open={!!selectedProject}
        onOpenChange={(o) => {
          if (!o) setSelectedProject(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedProject && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedProject.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    className={
                      PROJECT_STATUS_CONFIG[selectedProject.status]?.class
                    }
                    variant="outline"
                  >
                    {PROJECT_STATUS_CONFIG[selectedProject.status]?.label}
                  </Badge>
                  {(selectedProject.budget_min ||
                    selectedProject.budget_max) && (
                    <Badge variant="outline" className="gap-1">
                      <DollarSign className="w-3 h-3" />
                      {selectedProject.budget_min && selectedProject.budget_max
                        ? `$${selectedProject.budget_min.toLocaleString()} – $${selectedProject.budget_max.toLocaleString()}`
                        : selectedProject.budget_max
                          ? `Up to $${selectedProject.budget_max.toLocaleString()}`
                          : `From $${selectedProject.budget_min!.toLocaleString()}`}
                    </Badge>
                  )}
                  {selectedProject.timeline_days && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />{" "}
                      {selectedProject.timeline_days} days
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedProject.description}
                </p>
                {selectedProject.skills_required.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      Required Skills
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProject.skills_required.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedProject.deliverables.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Deliverables</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {selectedProject.deliverables.map((d, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Posted{" "}
                  {format(new Date(selectedProject.created_at), "MMM d, yyyy")}
                </p>
                <Button
                  className="w-full gap-2"
                  onClick={() => setProposalOpen(true)}
                >
                  <Send className="w-4 h-4" /> Submit Proposal
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Proposal Submission Modal */}
      <Dialog
        open={proposalOpen}
        onOpenChange={(o) => {
          if (!o) setProposalOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Proposed Rate ($) *
              </label>
              <Input
                type="number"
                value={proposalForm.price}
                onChange={(e) =>
                  setProposalForm((prev) => ({
                    ...prev,
                    price: e.target.value,
                  }))
                }
                placeholder="2500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Timeline (days)
              </label>
              <Input
                type="number"
                value={proposalForm.timelineDays}
                onChange={(e) =>
                  setProposalForm((prev) => ({
                    ...prev,
                    timelineDays: e.target.value,
                  }))
                }
                placeholder="14"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Cover Letter
              </label>
              <Textarea
                value={proposalForm.coverMessage}
                onChange={(e) =>
                  setProposalForm((prev) => ({
                    ...prev,
                    coverMessage: e.target.value,
                  }))
                }
                className="h-28 resize-none"
                placeholder="Why you're the best fit for this project..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Portfolio Links (one per line)
              </label>
              <Textarea
                value={proposalForm.portfolioLinks}
                onChange={(e) =>
                  setProposalForm((prev) => ({
                    ...prev,
                    portfolioLinks: e.target.value,
                  }))
                }
                className="h-20 resize-none"
                placeholder="https://github.com/you/project\nhttps://yourportfolio.com"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProposalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitProposal}
                disabled={submitting}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Proposal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
