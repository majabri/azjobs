import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AdminAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  status: string;
  created_at: string;
}

const severityColors: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-white",
  low: "bg-muted text-muted-foreground",
};

const severityBorder: Record<string, string> = {
  critical: "border-destructive/30",
  high: "border-orange-500/30",
  medium: "border-yellow-500/30",
  low: "border-border",
};

export default function AdminAlertsPanel() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_alerts" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setAlerts((data as any[]) ?? []);
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleResolve = async (alertId: string) => {
    if (!user) return;
    setResolving(alertId);
    try {
      const { error } = await supabase
        .from("admin_alerts" as any)
        .update({
          status: "resolved",
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        } as any)
        .eq("id", alertId);
      if (error) throw error;
      toast.success("Alert resolved");
      load();
    } catch {
      toast.error("Failed to resolve alert");
    }
    setResolving(null);
  };

  const unresolvedCount = alerts.filter((a) => a.status === "unresolved").length;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent" /> Admin Alerts
            {unresolvedCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">{unresolvedCount}</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={load}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No alerts. All clear!</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${severityBorder[alert.severity] ?? "border-border"} ${alert.status === "resolved" ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-[10px] ${severityColors[alert.severity] ?? ""}`}>
                        {alert.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {alert.alert_type.replace(/_/g, " ")}
                      </Badge>
                      {alert.status === "resolved" && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Resolved
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  {alert.status === "unresolved" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs h-7"
                      onClick={() => handleResolve(alert.id)}
                      disabled={resolving === alert.id}
                    >
                      {resolving === alert.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Resolve"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
