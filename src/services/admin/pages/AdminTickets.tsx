/**
 * Admin Tickets Management Page
 * View, filter, respond to, assign, and update support tickets.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  MessageCircle,
  Send,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
  User,
} from "lucide-react";

/* ─── Types (local to admin, no cross-service import) ─── */
interface Ticket {
  id: string;
  user_id: string;
  ticket_number: string;
  request_type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  email: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface TicketResponse {
  id: string;
  ticket_id: string;
  author_id: string;
  message: string;
  is_admin_response: boolean;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const TYPE_LABELS: Record<string, string> = {
  bug_report: "Bug Report",
  enhancement_request: "Enhancement",
  general_feedback: "Feedback",
  feature_request: "Feature Request",
  account_billing: "Account/Billing",
};

function statusBadge(status: string) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    open: "destructive",
    in_progress: "default",
    resolved: "secondary",
    closed: "outline",
  };
  const icons: Record<string, React.ReactNode> = {
    open: <AlertCircle className="h-3 w-3 mr-1" />,
    in_progress: <Clock className="h-3 w-3 mr-1" />,
    resolved: <CheckCircle2 className="h-3 w-3 mr-1" />,
    closed: <CheckCircle2 className="h-3 w-3 mr-1" />,
  };
  return (
    <Badge variant={variants[status] || "outline"} className="text-xs">
      {icons[status]}
      {STATUS_OPTIONS.find((s) => s.value === status)?.label || status}
    </Badge>
  );
}

function priorityBadge(priority: string) {
  const cls =
    priority === "high"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : priority === "medium"
        ? "bg-primary/10 text-primary border-primary/20"
        : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {PRIORITY_OPTIONS.find((p) => p.value === priority)?.label || priority}
    </Badge>
  );
}

export default function AdminTickets() {
  const { user } = useAuthReady();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Detail dialog
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [newResponse, setNewResponse] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [sendingResponse, setSendingResponse] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error && data) setTickets(data as unknown as Ticket[]);
    } catch {
      /* */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadResponses = useCallback(async (ticketId: string) => {
    setLoadingResponses(true);
    try {
      const { data } = await supabase
        .from("ticket_responses")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (data) setResponses(data as unknown as TicketResponse[]);
    } catch {
      /* */
    }
    setLoadingResponses(false);
  }, []);

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setNewResponse("");
    loadResponses(ticket.id);
  };

  const handleSendResponse = async () => {
    if (!selectedTicket || !user) return;

    setSendingResponse(true);
    try {
      // Update status if changed
      if (newStatus !== selectedTicket.status) {
        const updatePayload: {
          status: string;
          updated_at: string;
          resolved_at?: string;
        } = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        if (newStatus === "resolved")
          updatePayload.resolved_at = new Date().toISOString();

        await supabase
          .from("support_tickets")
          .update(updatePayload)
          .eq("id", selectedTicket.id);
      }

      // Add response if provided
      if (newResponse.trim()) {
        await supabase.from("ticket_responses").insert({
          ticket_id: selectedTicket.id,
          author_id: user.id,
          message: newResponse.trim(),
          is_admin_response: true,
        });
      }

      toast({ title: "Ticket updated successfully" });
      setNewResponse("");
      setSelectedTicket({ ...selectedTicket, status: newStatus });
      loadResponses(selectedTicket.id);
      loadTickets();
    } catch {
      toast({ title: "Failed to update ticket", variant: "destructive" });
    }
    setSendingResponse(false);
  };

  // Filtering
  const filtered = tickets.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterType !== "all" && t.request_type !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        t.title.toLowerCase().includes(term) ||
        t.ticket_number.toLowerCase().includes(term) ||
        (t.email || "").toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Stats
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "in_progress",
  ).length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Manage and respond to user support requests.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {tickets.length}
            </p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{openCount}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{inProgressCount}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-accent-foreground">
              {resolvedCount}
            </p>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="min-w-[130px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Status
              </Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[130px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Priority
              </Label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[130px]">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Type
              </Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={loadTickets}>
              <Filter className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No tickets found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => (
            <Card
              key={ticket.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openTicket(ticket)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-medium text-foreground truncate">
                        {ticket.title}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs font-mono">
                        {ticket.ticket_number}
                      </Badge>
                      {statusBadge(ticket.status)}
                      {priorityBadge(ticket.priority)}
                      <Badge variant="secondary" className="text-xs">
                        {TYPE_LABELS[ticket.request_type] ||
                          ticket.request_type}
                      </Badge>
                    </div>
                    {ticket.email && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <User className="h-3 w-3" /> {ticket.email}
                      </p>
                    )}
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

      {/* Ticket Detail Dialog */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  {selectedTicket.title}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedTicket.ticket_number}
                  </Badge>
                  {statusBadge(selectedTicket.status)}
                  {priorityBadge(selectedTicket.priority)}
                  <Badge variant="secondary" className="text-xs">
                    {TYPE_LABELS[selectedTicket.request_type] ||
                      selectedTicket.request_type}
                  </Badge>
                </DialogDescription>
              </DialogHeader>

              {/* Ticket Details */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Description
                  </Label>
                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap bg-muted/30 rounded-md p-3">
                    {selectedTicket.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Submitted
                    </Label>
                    <p className="text-foreground">
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Email
                    </Label>
                    <p className="text-foreground">
                      {selectedTicket.email || "—"}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Conversation Thread */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Conversation
                  </Label>
                  {loadingResponses ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : responses.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                      No responses yet.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {responses.map((r) => (
                        <div
                          key={r.id}
                          className={`rounded-lg p-3 text-sm ${
                            r.is_admin_response
                              ? "bg-primary/5 border border-primary/20"
                              : "bg-muted/50 border border-border"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={
                                r.is_admin_response ? "default" : "secondary"
                              }
                              className="text-xs"
                            >
                              {r.is_admin_response ? "Admin" : "User"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-foreground whitespace-pre-wrap">
                            {r.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Admin Response Form */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="admin-status">Update Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger id="admin-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-response">Response</Label>
                    <Textarea
                      id="admin-response"
                      value={newResponse}
                      onChange={(e) => setNewResponse(e.target.value)}
                      placeholder="Type your response to the user..."
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={handleSendResponse}
                    disabled={
                      sendingResponse ||
                      (!newResponse.trim() &&
                        newStatus === selectedTicket.status)
                    }
                    className="w-full"
                  >
                    {sendingResponse ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" /> Send Response & Update
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
