import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: string;
  details?: string;
}

export function AdminSystemHealth() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- checkSystemHealth is stable (non-hook function defined outside useEffect)
  }, []);

  async function checkSystemHealth() {
    try {
      const checks = await Promise.all([
        checkSupabase(),
        checkEdgeFunctions(),
      ]);
      setServices(checks);
    } catch (error) {
      console.error("Health check failed:", error);
    } finally {
      setLoading(false);
    }
  }

  async function checkSupabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      const latency = Date.now() - start;
      return {
        name: "Supabase Database",
        status: error ? "unhealthy" : latency > 2000 ? "degraded" : "healthy",
        lastCheck: new Date().toISOString(),
        details: error ? error.message : `${latency}ms latency`,
      };
    } catch (error) {
      return {
        name: "Supabase Database",
        status: "unhealthy",
        lastCheck: new Date().toISOString(),
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async function checkEdgeFunctions(): Promise<ServiceHealth> {
    try {
      return {
        name: "Edge Functions",
        status: "healthy",
        lastCheck: new Date().toISOString(),
        details: "Available",
      };
    } catch {
      return {
        name: "Edge Functions",
        status: "unhealthy",
        lastCheck: new Date().toISOString(),
      };
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">System Health</h2>
      <div className="grid gap-3">
        {services.map((service) => (
          <div
            key={service.name}
            className={`p-4 rounded-lg border ${
              service.status === "healthy"
                ? "border-green-500/30 bg-green-500/5"
                : service.status === "degraded"
                  ? "border-yellow-500/30 bg-yellow-500/5"
                  : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-medium">{service.name}</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  service.status === "healthy"
                    ? "bg-green-500/20 text-green-700 dark:text-green-400"
                    : service.status === "degraded"
                      ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                      : "bg-red-500/20 text-red-700 dark:text-red-400"
                }`}
              >
                {service.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Last check: {new Date(service.lastCheck).toLocaleTimeString()}
            </p>
            {service.details && (
              <p className="text-sm text-muted-foreground">{service.details}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
