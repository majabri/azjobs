import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthReady } from "@/hooks/useAuthReady";

interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

const BOOL_KEYS = new Set([
  "auto_apply_enabled",
  "job_discovery_enabled",
  "maintenance_mode",
  "new_user_registration",
]);

const STRING_KEYS = new Set(["ai_model"]);

export default function AdminSettings() {
  const { user } = useAuthReady();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      setSettings((data || []) as SettingRow[]);
      setEdits({});
    } catch (e) {
      console.error(e);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const getValue = (row: SettingRow): unknown => {
    return row.key in edits ? edits[row.key] : row.value;
  };

  const isDirty = Object.keys(edits).length > 0;

  const saveAll = async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(edits)) {
        const { error } = await supabase
          .from("admin_settings")
          .update({ value: value as import("@/integrations/supabase/types").Json, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
          .eq("key", key);
        if (error) throw error;
      }
      toast.success("Settings saved");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Platform Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Feature flags, rate limits, and system configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload
          </Button>
          <Button
            size="sm"
            className="gradient-teal text-white"
            onClick={saveAll}
            disabled={!isDirty || saving}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
          <Badge variant="outline" className="text-warning border-warning/30">Unsaved</Badge>
          You have unsaved changes. Click "Save Changes" to apply.
        </div>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-accent" /> Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {settings.map((row) => {
              const currentValue = getValue(row);
              const isEdited = row.key in edits;

              return (
                <div key={row.key} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-foreground font-mono">{row.key}</p>
                      {isEdited && (
                        <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">
                          modified
                        </Badge>
                      )}
                    </div>
                    {row.description && (
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Updated {new Date(row.updated_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex-shrink-0 flex items-center">
                    {BOOL_KEYS.has(row.key) ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={Boolean(currentValue)}
                          onCheckedChange={(checked) =>
                            setEdits((prev) => ({ ...prev, [row.key]: checked }))
                          }
                        />
                        <Label className="text-xs text-muted-foreground">
                          {Boolean(currentValue) ? "Enabled" : "Disabled"}
                        </Label>
                      </div>
                    ) : STRING_KEYS.has(row.key) ? (
                      <Input
                        value={String(currentValue ?? "")}
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [row.key]: e.target.value }))
                        }
                        className="w-48 h-8 text-xs"
                      />
                    ) : (
                      <Input
                        type="number"
                        value={Number(currentValue ?? 0)}
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))
                        }
                        className="w-24 h-8 text-xs"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
