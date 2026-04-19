/**
 * Support Page — Modular support center with ticket submission,
 * category cards, FAQ, and ticket status viewer with conversation thread.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useAdminRole } from "@/hooks/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import {
  Bug, Lightbulb, TrendingUp, MessageCircle, Search,
  Loader2, CheckCircle2, Clock, AlertCircle, Send,
} from "lucide-react";
import {
  createTicket, getUserTickets, getFaqs,
  REQUEST_TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS,
} from "../api";
import type {
  RequestType, Priority, SupportTicket, FaqEntry,
} from "../types";

const CATEGORY_CARDS = [
  { type: "bug_report" as RequestType, label: "Report a Bug", icon: Bug, color: "text-destructive" },
  { type: "feature_request" as RequestType, label: "Request a Feature", icon: Lightbulb, color: "text-primary" },
  { type: "enhancement_request" as RequestType, label: "Suggest Improvement", icon: TrendingUp, color: "text-accent-foreground" },
  { type: "general_feedback" as RequestType, label: "Contact Support", icon: MessageCircle, color: "text-muted-foreground" },
];

const FAQ_CATEGORY_LABELS: Record<string, string> = {
  // Legacy categories (kept for backward compatibility)
  getting_started: "Getting Started",
  job_search: "Job Search Features",
  account: "Account Management",
  // Job Seeker categories
  seeker_dashboard: "Dashboard",
  seeker_analyze_job: "Analyze a Job",
  seeker_find_jobs: "Find Jobs",
  seeker_applications: "Applications",
  seeker_offers: "Offers",
  seeker_career: "Career Planning",
  seeker_interview_prep: "Interview Prep",
  seeker_auto_apply: "Auto Apply",
  seeker_profile: "Profile & Resume",
  // Hiring Manager / Recruiter categories
  recruiter_screener: "Candidate Screener",
  recruiter_candidates: "Candidates Database",
  recruiter_job_postings: "Job Postings",
  recruiter_interview_scheduling: "Interview Scheduling",
  // Admin categories
  admin_support_tickets: "Support Tickets",
  admin_system_health: "System Health & Agents",
  admin_users_roles: "Users & Roles",
};

function statusIcon(status: string) {
  switch (status) {
    case "open": return <AlertCircle className="h-4 w-4 text-warning" />;
    case "in_progress": return <Clock className="h-4 w-4 text-primary" />;
    case "resolved": return <CheckCircle2 className="h-4 w-4 text-accent-foreground" />;
    default: return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
  }
}

// The DB roles ('job_seeker', 'recruiter', 'admin') may not match the TypeScript
// UserRole type which reflects an older enum. We normalise to string for comparison.
function isRecruiterRole(role: string | null | undefined): boolean {
  return role === "recruiter";
}

export default function SupportPage() {
  const { user } = useAuthReady();
  const { role, isAdmin } = useAdminRole();
  const userId = user?.id;

  // Form state
  const [requestType, setRequestType] = useState<RequestType>("general_feedback");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [email, setEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);

  // Data state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [faqSearch, setFaqSearch] = useState("");
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Ticket detail dialog
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketResponses, setTicketResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- email intentionally excluded; runs once on mount
  }, [user?.email]);

  const loadTickets = useCallback(async () => {
    if (!userId) return;
    setLoadingTickets(true);
    try {
      const data = await getUserTickets(userId);
      setTickets(data);
    } catch { /* non-critical */ }
    setLoadingTickets(false);
  }, [userId]);

  useEffect(() => {
    loadTickets();
    getFaqs().then(setFaqs).catch(() => {});
  }, [loadTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!title.trim() || title.trim().length > 100) {
      toast({ title: "Title is required (max 100 characters)", variant: "destructive" });
      return;
    }
    if (!description.trim() || description.trim().length < 20) {
      toast({ title: "Description must be at least 20 characters", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const result = await createTicket(userId, {
      request_type: requestType,
      title: title.trim(),
      description: description.trim(),
      priority,
      email: email || undefined,
    });
    setSubmitting(false);

    if (result.ok && result.ticket) {
      toast({
        title: "Ticket Submitted!",
        description: `Your ticket ${result.ticket.ticket_number} has been created. We'll get back to you soon.`,
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setRequestType("general_feedback");
      loadTickets();
    } else {
      toast({ title: "Failed to submit ticket", description: result.error, variant: "destructive" });
    }
  };

  const selectCategory = (type: RequestType) => {
    setRequestType(type);
    document.getElementById("support-form")?.scrollIntoView({ behavior: "smooth" });
  };

  // Role-based FAQ visibility:
  // Admin → sees all published FAQs.
  // Recruiter → sees audience='all' and audience='recruiter'.
  // Job seeker (default) → sees audience='all' and audience='job_seeker'.
  const visibleFaqs = useMemo(() => {
    if (isAdmin) return faqs;
    const allowed = new Set(isRecruiterRole(role) ? ["all", "recruiter"] : ["all", "job_seeker"]);
    return faqs.filter((f) => allowed.has(f.audience ?? "all"));
  }, [faqs, isAdmin, role]);

  // FAQ search + category grouping
  const filteredFaqs = visibleFaqs.filter(
    (f) =>
      !faqSearch ||
      f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.answer.toLowerCase().includes(faqSearch.toLowerCase())
  );
  const faqCategories = [...new Set(filteredFaqs.map((f) => f.category))];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Support Center</h1>
          <p className="text-muted-foreground mt-1">
            Get help, report issues, or share feedback to improve iCareerOS.
          </p>
        </div>

        <Tabs defaultValue="submit" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="submit">Submit Request</TabsTrigger>
            <TabsTrigger value="faq">Knowledge Base</TabsTrigger>
            <TabsTrigger value="tickets">My Tickets</TabsTrigger>
          </TabsList>

          {/* ─── Submit Tab ─── */}
          <TabsContent value="submit" className="space-y-6">
            {/* Category Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CATEGORY_CARDS.map((cat) => (
                <Card
                  key={cat.type}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    requestType === cat.type ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => selectCategory(cat.type)}
                >
                  <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                    <cat.icon className={`h-6 w-6 ${cat.color}`} />
                    <span className="text-xs font-medium text-foreground">{cat.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Submission Form */}
            <Card id="support-form">
              <CardHeader>
                <CardTitle className="text-lg">Submit a Request</CardTitle>
                <CardDescription>Fill out the form below and we'll respond as soon as possible.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="request-type">Request Type</Label>
                      <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
                        <SelectTrigger id="request-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(REQUEST_TYPE_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                        <SelectTrigger id="priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Brief summary of your request"
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground">{title.length}/100</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide details (min 20 characters)..."
                      rows={5}
                    />
                    <p className="text-xs text-muted-foreground">{description.length} characters (min 20)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                    {submitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                    ) : (
                      <><Send className="mr-2 h-4 w-4" /> Submit Request</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── FAQ Tab ─── */}
          <TabsContent value="faq" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search knowledge base..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {faqCategories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No matching articles found.</p>
            ) : (
              faqCategories.map((cat) => (
                <Card key={cat}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{FAQ_CATEGORY_LABELS[cat] || cat}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple">
                      {filteredFaqs
                        .filter((f) => f.category === cat)
                        .map((faq) => (
                          <AccordionItem key={faq.id} value={faq.id}>
                            <AccordionTrigger className="text-sm text-left">
                              {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground">
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ─── My Tickets Tab ─── */}
          <TabsContent value="tickets" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Your Tickets</h2>
              <Button variant="outline" size="sm" onClick={loadTickets} disabled={loadingTickets}>
                {loadingTickets ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>

            {tickets.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No tickets yet.</p>
                  <p className="text-xs text-muted-foreground">Submit a request and it will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={async () => {
                      setSelectedTicket(ticket);
                      setLoadingResponses(true);
                      try {
                        const { data } = await supabase
                          .from("ticket_responses")
                          .select("*")
                          .eq("ticket_id", ticket.id)
                          .order("created_at", { ascending: true });
                        setTicketResponses((data as any[]) || []);
                      } catch { setTicketResponses([]); }
                      setLoadingResponses(false);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {statusIcon(ticket.status)}
                            <span className="text-sm font-medium text-foreground truncate">
                              {ticket.title}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">{ticket.ticket_number}</Badge>
                            <Badge variant="secondary" className="text-xs">
                              {REQUEST_TYPE_LABELS[ticket.request_type as keyof typeof REQUEST_TYPE_LABELS] || ticket.request_type}
                            </Badge>
                            <Badge variant={ticket.priority === "high" ? "destructive" : "outline"} className="text-xs">
                              {PRIORITY_LABELS[ticket.priority as keyof typeof PRIORITY_LABELS] || ticket.priority}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] || ticket.status}
                            </Badge>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedTicket.title}</DialogTitle>
                  <DialogDescription className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className="font-mono text-xs">{selectedTicket.ticket_number}</Badge>
                    <Badge variant="secondary" className="text-xs">
                      {STATUS_LABELS[selectedTicket.status as keyof typeof STATUS_LABELS] || selectedTicket.status}
                    </Badge>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Your Description</Label>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap bg-muted/30 rounded-md p-3">
                      {selectedTicket.description}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Responses</Label>
                    {loadingResponses ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : ticketResponses.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2">
                        No responses yet. Our team will get back to you soon.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {ticketResponses.map((r: any) => (
                          <div
                            key={r.id}
                            className={`rounded-lg p-3 text-sm ${
                              r.is_admin_response
                                ? "bg-primary/5 border border-primary/20"
                                : "bg-muted/50 border border-border"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={r.is_admin_response ? "default" : "secondary"} className="text-xs">
                                {r.is_admin_response ? "Support Team" : "You"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(r.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-foreground whitespace-pre-wrap">{r.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
