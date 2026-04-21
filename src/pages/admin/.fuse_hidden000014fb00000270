// src/pages/admin/AdminInvitations.tsx
// Admin panel page for invite management and analytics.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  Users,
  TrendingUp,
  Clock,
  Search,
  Ban,
  Shield,
  GitBranch,
  BarChart3,
} from "lucide-react";

interface DashboardData {
  total_invites_sent: number;
  total_accepted: number;
  active_pending: number;
  conversion_rate: number;
  top_inviters: Array<{
    user_id: string;
    username: string;
    total_sent: number;
    total_accepted: number;
  }>;
  daily_activity: Array<{
    date: string;
    sent: number;
    accepted: number;
  }>;
  chain_stats: {
    max_depth: number;
    avg_depth: number;
    total_users_in_tree: number;
  };
  recent_invites: Array<{
    id: string;
    inviter_name: string;
    invitee_email: string | null;
    invite_type: string;
    invite_code: string | null;
    status: string;
    created_at: string;
  }>;
}

export default function AdminInvitations() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminInviteEmail, setAdminInviteEmail] = useState("");
  const [isSendingAdmin, setIsSendingAdmin] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-invite-dashboard"
      );

      if (error) {
        toast.error("Failed to load invite dashboard");
        return;
      }

      setDashboard(data);
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  async function handleAdminInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!adminInviteEmail.trim()) return;

    setIsSendingAdmin(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: { type: "email", email: adminInviteEmail.trim() },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Failed to send admin invite");
        return;
      }

      toast.success(`Admin invite sent to ${adminInviteEmail}`);
      setAdminInviteEmail("");
      fetchDashboard();
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setIsSendingAdmin(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "revoked" })
        .eq("id", inviteId);

      if (error) {
        toast.error("Failed to revoke invite");
        return;
      }

      toast.success("Invite revoked");
      fetchDashboard();
    } catch {
      toast.error("Failed to revoke invite");
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/20",
    accepted: "bg-green-500/10 text-green-600 border-green-500/20",
    expired: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    revoked: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load invite dashboard. Please try again.
      </div>
    );
  }

  // Filter recent invites by search
  const filteredRecent = searchQuery
    ? dashboard.recent_invites.filter(
        (inv) =>
          inv.inviter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (inv.invitee_email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (inv.invite_code || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : dashboard.recent_invites;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-[hsl(var(--primary))]" />
            Invite Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage the invite-only enrollment system.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Sent</span>
            </div>
            <div className="text-3xl font-bold">{dashboard.total_invites_sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Accepted</span>
            </div>
            <div className="text-3xl font-bold text-green-600">
              {dashboard.total_accepted}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-brand-gold" />
              <span className="text-sm text-muted-foreground">Conversion</span>
            </div>
            <div className="text-3xl font-bold">
              {(dashboard.conversion_rate * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <div className="text-3xl font-bold text-[hsl(var(--primary))]">
              {dashboard.active_pending}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chain Stats + Admin Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Referral Chain Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-[hsl(var(--primary))]" />
              Referral Chain Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{dashboard.chain_stats.max_depth}</div>
                <div className="text-xs text-muted-foreground">Max Depth</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{dashboard.chain_stats.avg_depth}</div>
                <div className="text-xs text-muted-foreground">Avg Depth</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{dashboard.chain_stats.total_users_in_tree}</div>
                <div className="text-xs text-muted-foreground">In Tree</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin: Send Invite (bypasses daily limit) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-brand-gold" />
              Admin Invite (No Limit)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="newuser@example.com"
                value={adminInviteEmail}
                onChange={(e) => setAdminInviteEmail(e.target.value)}
                disabled={isSendingAdmin}
              />
              <Button
                type="submit"
                className="bg-brand-gold hover:bg-brand-gold/85 text-white shrink-0"
                disabled={isSendingAdmin || !adminInviteEmail.trim()}
              >
                {isSendingAdmin ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Admin invites bypass the daily limit and are tracked separately.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Inviters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[hsl(var(--primary))]" />
            Top Inviters
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.top_inviters.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No inviters yet.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.top_inviters.slice(0, 10).map((inviter, i) => (
                <div
                  key={inviter.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground w-6 text-right">
                      #{i + 1}
                    </span>
                    <span className="font-medium">{inviter.username}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>
                      {inviter.total_sent} sent
                    </span>
                    <span className="text-green-600">
                      {inviter.total_accepted} accepted
                    </span>
                    <span className="text-muted-foreground">
                      {inviter.total_sent > 0
                        ? Math.round((inviter.total_accepted / inviter.total_sent) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Invites */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Invites</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRecent.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {searchQuery ? "No matches found." : "No invites yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredRecent.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {inv.invite_type === "email"
                          ? inv.invitee_email
                          : `Code: ${inv.invite_code}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        by {inv.inviter_name} &middot;{" "}
                        {new Date(inv.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={statusColors[inv.status] || ""}
                    >
                      {inv.status}
                    </Badge>
                    {inv.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
