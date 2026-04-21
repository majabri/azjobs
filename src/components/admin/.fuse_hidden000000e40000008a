/**
 * Admin Feature Flags Panel — toggle features on/off.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ToggleLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invalidateFeatureFlags } from "@/hooks/useFeatureFlag";

interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string;
  updated_at: string;
}

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feature_flags" as any)
      .select("*")
      .order("key");
    setFlags((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (flag: FeatureFlag) => {
    setToggling(flag.id);
    const { error } = await supabase
      .from("feature_flags" as any)
      .update({ enabled: !flag.enabled, updated_at: new Date().toISOString() } as any)
      .eq("id", flag.id);

    if (error) {
      toast.error("Failed to update flag");
    } else {
      toast.success(`${flag.key} ${!flag.enabled ? "enabled" : "disabled"}`);
      invalidateFeatureFlags();
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f));
    }
    setToggling(null);
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ToggleLeft className="w-4 h-4 text-accent" /> Feature Flags
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={load}>
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <div className="space-y-3">
            {flags.map(flag => (
              <div key={flag.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{flag.key}</p>
                    <Badge
                      variant="outline"
                      className={flag.enabled
                        ? "text-success border-success/30 text-[10px]"
                        : "text-destructive border-destructive/30 text-[10px]"
                      }
                    >
                      {flag.enabled ? "ON" : "OFF"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                </div>
                <Switch
                  checked={flag.enabled}
                  disabled={toggling === flag.id}
                  onCheckedChange={() => toggle(flag)}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
