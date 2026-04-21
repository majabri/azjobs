import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface ServiceHealthRow {
  id: string;
  service_name: string;
  status: string;
  last_check: string;
  error_count: number;
  circuit_breaker_open: boolean;
  last_error: string | null;
  response_time_ms: number;
}

const EDGE_FUNCTIONS = [
  "gig-service",
  "proposal-service",
  "project-service",
  "billing-service",
  "ai-recovery-service",
];

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  healthy: { icon: CheckCircle2, color: "text-success", label: "Operational" },
  degraded: { icon: AlertTriangle, color: "text-warning", label: "Degraded" },
  down: { icon: XCircle, color: "text-destructive", label: "Down" },
};

export default function EnhancedServiceHealthPanel() {
  const [services, setServices] = useState<ServiceHealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseHistory, setResponseHistory] = useState<{ time: string; ms: number }[]>([]);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("service_health")
        .select("*")
        .order("service_name");
      if (error) throw error;
      const rows = data ?? [];
      setServices(rows);

      // Build response time history from current snapshot (simulate 24h with available data)
      setResponseHistory((prev) => {
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const avgMs = rows.length > 0
          ? Math.round(rows.reduce((s, r) => s + (r.response_time_ms || 0), 0) / rows.length)
          : 0;
        const next = [...prev, { time: now, ms: avgMs }];
        return next.slice(-48); // keep last 48 data points (~24min at 30s intervals)
      });
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Overall platform status
  const overallStatus = services.some((s) => s.status === "down")
    ? "down"
    : services.some((s) => s.status === "degraded")
    ? "degraded"
    : "healthy";

  const overallConfig = STATUS_CONFIG[overallStatus];
  const OverallIcon = overallConfig.icon;

  // Database status
  const dbService = services.find((s) => s.service_name.toLowerCase().includes("database") || s.service_name.toLowerCase().includes("db"));
  const dbStatus = dbService?.status || "healthy";

  // Average response time
  const avgResponseTime = services.length > 0
    ? Math.round(services.reduce((s, r) => s + (r.response_time_ms || 0), 0) / services.length)
    : 0;

  // Edge function statuses
  const edgeFnStatuses = EDGE_FUNCTIONS.map((name) => {
    const svc = services.find((s) => s.service_name === name);
    return {
      name,
      status: svc?.status || "healthy",
      lastCheck: svc?.last_check,
      error: svc?.last_error,
    };
  });

  return (
    <div className="space-y-4">
      {/* Platform Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <OverallIcon className={`w-6 h-6 ${overallConfig.color}`} />
            <div>
              <p className="text-xs text-muted-foreground">Platform Status</p>
              <p className={`font-semibold ${overallConfig.color}`}>{overallConfig.label}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-6 h-6 text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Avg Response Time</p>
              <p className="font-semibold text-foreground">{avgResponseTime} ms</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            {STATUS_CONFIG[dbStatus] ? (
              <>
                {(() => { const I = STATUS_CONFIG[dbStatus].icon; return <I className={`w-6 h-6 ${STATUS_CONFIG[dbStatus].color}`} />; })()}
                <div>
                  <p className="text-xs text-muted-foreground">Database Connection</p>
                  <p className={`font-semibold ${STATUS_CONFIG[dbStatus].color}`}>{STATUS_CONFIG[dbStatus].label}</p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Database Connection</p>
                  <p className="font-semibold text-success">Healthy</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edge Functions Status */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" /> Edge Functions Status
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={load}>
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {edgeFnStatuses.map((fn) => {
                const config = STATUS_CONFIG[fn.status] || STATUS_CONFIG.healthy;
                const Icon = config.icon;
                return (
                  <div key={fn.name} className="flex items-center gap-2.5 p-2.5 bg-muted/20 rounded-lg border border-border">
                    <Icon className={`w-3.5 h-3.5 ${config.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{fn.name}</p>
                      {fn.error && <p className="text-[10px] text-muted-foreground truncate">{fn.error}</p>}
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${config.color}`}>{fn.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Time Chart */}
      {responseHistory.length > 1 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" /> Response Time Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={responseHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit=" ms" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Line type="monotone" dataKey="ms" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="Avg Response" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
