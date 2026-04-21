/**
 * Admin Service Health Panel — monitor service status + circuit breakers.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useServiceHealth } from "@/hooks/useServiceHealth";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  healthy: { icon: CheckCircle2, color: "text-success" },
  degraded: { icon: AlertTriangle, color: "text-warning" },
  down: { icon: XCircle, color: "text-destructive" },
};

export default function ServiceHealthPanel() {
  const { services, loading, refresh } = useServiceHealth();

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" /> Service Health
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={refresh}>
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {services.map(svc => {
              const config = STATUS_CONFIG[svc.status] || STATUS_CONFIG.healthy;
              const Icon = config.icon;
              return (
                <div key={svc.id} className="flex items-center gap-2.5 p-2.5 bg-muted/20 rounded-lg border border-border">
                  <Icon className={`w-3.5 h-3.5 ${config.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{svc.service_name}</p>
                    {svc.last_error && (
                      <p className="text-[10px] text-muted-foreground truncate" title={svc.last_error}>{svc.last_error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {svc.circuit_breaker_open && (
                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">CB Open</Badge>
                    )}
                    {svc.error_count > 0 && (
                      <Badge variant="outline" className="text-[10px] text-warning border-warning/30">{svc.error_count} errs</Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${config.color} border-current/30`}
                    >
                      {svc.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
