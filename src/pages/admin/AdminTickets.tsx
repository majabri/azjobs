import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LifeBuoy,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  CircleDot,
  ChevronDown,
  ChevronUp,
  Mail,
  Globe,
  Send,
  Loader2,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SupportTicket {
  id: string;
  user_id: string | null;
  ticket_number: string;
  request_type: string;
  category: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_on_user" | "resolved" | "closed";
  source: "web" | "email";
  email: string | null;
  guest_email: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assigned_to: string | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string | null;
  body: string;
  is_internal_note: boolean;
  is_staff_reply: boolean;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground border-muted",
  medium: "text-warning border-warning/40",
  high: "text-destructive border-destructive/40",
  urgent: "text-destructive border-destructive font-semibold",
};

const STATUS_COLORS: Record<string, string> = {
  open: "text-warning border-warning/40",
  in_progress: "text-accent border-accent/40",
  waiting_on_user: "text-primary border-primary/40",
  resolved: "text-success border-success/40",
  closed: "text-muted-foreground border-muted",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <CircleDot className="w-3.5 h-3.5" />,
  in_progress: <Clock className="w-3.5 h-3.5" />,
  waiting_on_user: <Clock className="w-3.5 h-3.5" />,
  resolved: <CheckCircle2 className="w-3.5 h-3.5" />,
  closed: <CheckCircle2 className="w-3.5 h-3.5" />,
};

const STATUSES = ["open", "in_progress", "waiting_on_user", "resolved", "closed"];

export default function AdminTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Per-ticket message state keyed by ticket id
  const [messages, setMessages] = useState<Record<string, TicketMessage[]>>({});
  const [loadingMsgs, setLoadingMsgs] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [isInternalNote, setIsInternalNote] = useState<Record<string, boolean>>({});
  const [sendingReply, setSendingReply] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMessages = async (ticketId: string) => {
    setLoadingMsgs((prev) => ({ ...prev, [ticketId]: true }));
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((prev) => ({ ...prev, [ticketId]: (data || []) as TicketMessage[] }));
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoadingMsgs((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  const toggleExpanded = async (ticketId: string) => {
    if (expandedId === ticketId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(ticketId);
    if (!messages[ticketId]) {
      await loadMessages(ticketId);
    }
  };

  const updateStatus = async (ticketId: string, newStatus: string) => {
    setUpdatingId(ticketId);
    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === "resolved" || newStatus === "closed") {
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketId);
      if (error) throw error;
      toast.success("Status updated");
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, ...(updates as Partial<SupportTicket>) } : t,
        ),
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to update ticket");
    } finally {
      setUpdatingId(null);
    }
  };

  const sendReply = async (ticketId: string) => {
    const body = (replyText[ticketId] || "").trim();
    if (!body) return;
    setSendingReply((prev) => ({ ...prev, [ticketId]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); return; }

      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        user_id: session.user.id,
        body,
        is_internal_note: isInternalNote[ticketId] ?? false,
        is_staff_reply: true,
      });
      if (error) throw error;

      setReplyText((prev) => ({ ...prev, [ticketId]: "" }));
      await loadMessages(ticketId);

      const ticket = tickets.find((t) => t.id === ticketId);

      // Auto-move to in_progress if still open and it's a user-facing reply
      if (ticket?.status === "open" && !isInternalNote[ticketId]) {
        await updateStatus(ticketId, "in_progress");
      }

      // Fire confirmation email to user (non-blocking, only for user-facing replies)
      if (!isInternalNote[ticketId] && ticket) {
        const recipientEmail = ticket.guest_email || ticket.email;
        if (recipientEmail) {
          supabase.functions.invoke("support-notify", {
            body: {
              event: "staff_reply",
              to: recipientEmail,
              ticketNumber: ticket.ticket_number,
              ticketTitle: ticket.title,
              replyBody: body,
            },
          }).catch(() => { /* non-critical */ });
        }
      }

      toast.success(isInternalNote[ticketId] ? "Note added" : "Reply sent");
    } catch (e) {
      console.error(e);
      toast.error("Failed to send reply");
    } finally {
      setSendingReply((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  const filtered = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
    return true;
  });

  const counts = {
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Support Inbox
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tickets.length} total · {counts.open} open · {counts.in_progress} in progress
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open", count: counts.open, color: "text-warning" },
          { label: "In Progress", count: counts.in_progress, color: "text-accent" },
          { label: "Resolved", count: counts.resolved, color: "text-success" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-display font-bold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {["urgent", "high", "medium", "low"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ticket list */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-accent" />
            Tickets ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No tickets match the current filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((ticket) => (
                <div key={ticket.id} className="border border-border rounded-lg overflow-hidden">
                  {/* Row header */}
                  <div
                    className="flex items-center justify-between gap-3 p-3 bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => toggleExpanded(ticket.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {ticket.ticket_number}
                      </span>
                      <p className="text-sm font-medium text-foreground truncate">
                        {ticket.title || "(no title)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Source badge */}
                      {ticket.source === "email" ? (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30 gap-1">
                          <Mail className="w-2.5 h-2.5" /> email
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                          <Globe className="w-2.5 h-2.5" /> web
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] flex items-center gap-1 ${STATUS_COLORS[ticket.status] ?? ""}`}>
                        {STATUS_ICONS[ticket.status]}
                        {ticket.status.replace(/_/g, " ")}
                      </Badge>
                      {expandedId === ticket.id ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === ticket.id && (
                    <div className="p-4 border-t border-border space-y-4 bg-background">
                      {/* Metadata grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-0.5">Category</p>
                          <p className="font-medium capitalize">{ticket.category}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Type</p>
                          <p className="font-medium capitalize">{ticket.request_type.replace(/_/g, " ")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Contact</p>
                          <p className="font-medium">{ticket.guest_email || ticket.email || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Submitted</p>
                          <p className="font-medium">{new Date(ticket.created_at).toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Description */}
                      {ticket.description && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Description</p>
                          <p className="text-sm bg-muted/20 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                            {ticket.description}
                          </p>
                        </div>
                      )}

                      {/* Status update */}
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-muted-foreground shrink-0">Status:</p>
                        {STATUSES.map((s) => (
                          <Button
                            key={s}
                            variant={ticket.status === s ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-[11px] capitalize"
                            disabled={ticket.status === s || updatingId === ticket.id}
                            onClick={(e) => { e.stopPropagation(); updateStatus(ticket.id, s); }}
                          >
                            {s.replace(/_/g, " ")}
                          </Button>
                        ))}
                      </div>

                      {/* Message thread */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Conversation</p>
                        {loadingMsgs[ticket.id] ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : !messages[ticket.id]?.length ? (
                          <p className="text-xs text-muted-foreground italic">No messages yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {messages[ticket.id].map((m) => (
                              <div
                                key={m.id}
                                className={`rounded-lg p-3 text-sm border ${
                                  m.is_internal_note
                                    ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800/30"
                                    : m.is_staff_reply
                                    ? "bg-primary/5 border-primary/20"
                                    : "bg-muted/30 border-border"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {m.is_internal_note && (
                                    <Badge variant="outline" className="text-[10px] text-yellow-700 border-yellow-400 gap-1">
                                      <Lock className="w-2.5 h-2.5" /> Internal
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={m.is_staff_reply ? "default" : "secondary"}
                                    className="text-[10px]"
                                  >
                                    {m.is_staff_reply ? "Support Team" : "User"}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(m.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-foreground whitespace-pre-wrap leading-relaxed">{m.body}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Staff reply input */}
                      <div className="space-y-2 border-t border-border pt-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">
                            {isInternalNote[ticket.id] ? "Internal Note (not visible to user)" : "Reply to User"}
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 text-[10px] gap-1 ${isInternalNote[ticket.id] ? "text-yellow-700" : "text-muted-foreground"}`}
                            onClick={() =>
                              setIsInternalNote((prev) => ({
                                ...prev,
                                [ticket.id]: !prev[ticket.id],
                              }))
                            }
                          >
                            <Lock className="w-3 h-3" />
                            {isInternalNote[ticket.id] ? "Internal Note" : "Make Internal"}
                          </Button>
                        </div>
                        <Textarea
                          value={replyText[ticket.id] || ""}
                          onChange={(e) =>
                            setReplyText((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                          }
                          placeholder={
                            isInternalNote[ticket.id]
                              ? "Add a note for your team…"
                              : "Type your reply to the user…"
                          }
                          rows={3}
                          className={isInternalNote[ticket.id] ? "border-yellow-300 dark:border-yellow-800" : ""}
                        />
                        <Button
                          size="sm"
                          disabled={sendingReply[ticket.id] || !(replyText[ticket.id] || "").trim()}
                          onClick={() => sendReply(ticket.id)}
                          className={isInternalNote[ticket.id] ? "bg-yellow-600 hover:bg-yellow-700 text-white" : ""}
                        >
                          {sendingReply[ticket.id] ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Sending…</>
                          ) : isInternalNote[ticket.id] ? (
                            <><Lock className="w-3.5 h-3.5 mr-1.5" /> Save Note</>
                          ) : (
                            <><Send className="w-3.5 h-3.5 mr-1.5" /> Send Reply</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
