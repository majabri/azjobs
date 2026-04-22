import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SupportTicket {
  id: string;
  user_id: string;
  ticket_number: string;
  request_type: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  email: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
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
  resolved: "text-success border-success/40",
  closed: "text-muted-foreground border-muted",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <CircleDot className="w-3.5 h-3.5" />,
  in_progress: <Clock className="w-3.5 h-3.5" />,
  resolved: <CheckCircle2 className="w-3.5 h-3.5" />,
  closed: <CheckCircle2 className="w-3.5 h-3.5" />,
};

export default function AdminTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
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
      toast.success("Ticket status updated");
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, ...(updates as Partial<SupportTicket>) }
            : t,
        ),
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to update ticket");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
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
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Support Tickets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tickets.length} total · {counts.open} open · {counts.in_progress}{" "}
            in progress
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
          {
            label: "In Progress",
            count: counts.in_progress,
            color: "text-accent",
          },
          { label: "Resolved", count: counts.resolved, color: "text-success" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-xl p-4 shadow-sm"
          >
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-display font-bold ${s.color}`}>
              {s.count}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
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
                <div
                  key={ticket.id}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  {/* Row header */}
                  <div
                    className="flex items-center justify-between gap-3 p-3 bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() =>
                      setExpandedId((prev) =>
                        prev === ticket.id ? null : ticket.id,
                      )
                    }
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
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${PRIORITY_COLORS[ticket.priority] ?? ""}`}
                      >
                        {ticket.priority}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] flex items-center gap-1 ${STATUS_COLORS[ticket.status] ?? ""}`}
                      >
                        {STATUS_ICONS[ticket.status]}
                        {ticket.status.replace("_", " ")}
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
                    <div className="p-4 border-t border-border space-y-3 bg-background">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-0.5">Type</p>
                          <p className="font-medium capitalize">
                            {ticket.request_type.replace(/_/g, " ")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Email</p>
                          <p className="font-medium">{ticket.email ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">
                            Submitted
                          </p>
                          <p className="font-medium">
                            {new Date(ticket.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">
                            User ID
                          </p>
                          <p className="font-mono text-[10px]">
                            {ticket.user_id.slice(0, 12)}…
                          </p>
                        </div>
                      </div>

                      {ticket.description && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Description
                          </p>
                          <p className="text-sm bg-muted/20 rounded-lg p-3 leading-relaxed">
                            {ticket.description}
                          </p>
                        </div>
                      )}

                      {/* Status update */}
                      <div className="flex items-center gap-2 pt-1">
                        <p className="text-xs text-muted-foreground shrink-0">
                          Update status:
                        </p>
                        {["open", "in_progress", "resolved", "closed"].map(
                          (s) => (
                            <Button
                              key={s}
                              variant={
                                ticket.status === s ? "default" : "outline"
                              }
                              size="sm"
                              className="h-7 text-[11px] capitalize"
                              disabled={
                                ticket.status === s || updatingId === ticket.id
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(ticket.id, s);
                              }}
                            >
                              {s.replace("_", " ")}
                            </Button>
                          ),
                        )}
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
