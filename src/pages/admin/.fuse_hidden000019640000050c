// Discovery Agent health panel — mounts inside /admin/system (AdminSystem.tsx).
// Shows the latest scraper run per board, status colour, and counts.
// Mount this component beside the existing service health grid.
//
// Usage in AdminSystem.tsx:
//   import { DiscoveryHealthPanel } from './DiscoveryHealthPanel';
//   ...
//   <DiscoveryHealthPanel />

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface RunRow {
  id: string;
  source_board: string;
  status: string;
  jobs_found: number;
  jobs_inserted: number;
  jobs_skipped_duplicate: number;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  http_status: number | null;
}

const STATUS_COLOURS: Record<string, string> = {
  success: "text-emerald-500",
  running: "text-amber-500",
  partial: "text-yellow-500",
  failed:  "text-red-500",
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  running: "secondary",
  partial: "secondary",
  failed:  "destructive",
};

export function DiscoveryHealthPanel() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("scraper_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!error && data) setRuns(data as RunRow[]);
        setLoading(false);
      });
  }, []);

  // One row per board — first occurrence is the latest run.
  const latestByBoard = runs.reduce<Record<string, RunRow>>((acc, r) => {
    if (!acc[r.source_board]) acc[r.source_board] = r;
    return acc;
  }, {});

  const boards = Object.values(latestByBoard);
  const totalInserted = boards.reduce((s, r) => s + (r.jobs_inserted ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Discovery Agent — Board Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No scraper runs yet. Enable a board flag in{" "}
            <span className="font-mono">/admin/settings</span> and trigger a run.
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 font-medium">Board</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Found</th>
                  <th className="text-right py-2 font-medium">Inserted</th>
                  <th className="text-right py-2 font-medium">Skipped</th>
                  <th className="text-left py-2 font-medium pl-4">Last run</th>
                </tr>
              </thead>
              <tbody>
                {boards.map((r) => (
                  <tr key={r.source_board} className="border-t border-border">
                    <td className="py-2 font-mono text-xs">{r.source_board}</td>
                    <td className="py-2">
                      <Badge variant={STATUS_BADGE[r.status] ?? "outline"}>
                        <span className={STATUS_COLOURS[r.status] ?? ""}>
                          {r.status}
                        </span>
                      </Badge>
                      {r.error_message && (
                        <p className="mt-0.5 text-xs text-red-400 truncate max-w-[200px]" title={r.error_message}>
                          {r.error_message}
                        </p>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.jobs_found ?? "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-emerald-600">
                      {r.jobs_inserted ?? "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {r.jobs_skipped_duplicate ?? "—"}
                    </td>
                    <td className="py-2 pl-4 text-muted-foreground text-xs">
                      {new Date(r.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-3 text-xs text-muted-foreground">
              {totalInserted.toLocaleString()} total jobs inserted into discovery_jobs across all boards
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
