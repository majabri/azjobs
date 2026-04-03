import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Save, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function EmailPreferences() {
  const [dailyAlerts, setDailyAlerts] = useState(true);
  const [weeklyInsights, setWeeklyInsights] = useState(true);
  const [minScore, setMinScore] = useState(70);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPrefs(); }, []);

  const loadPrefs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await (supabase.from("email_preferences" as any) as any)
        .select("*").eq("user_id", session.user.id).maybeSingle();
      if (data) {
        setDailyAlerts(data.daily_job_alerts);
        setWeeklyInsights(data.weekly_insights);
        setMinScore(data.min_match_score);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await (supabase.from("email_preferences" as any) as any).upsert({
        user_id: session.user.id, daily_job_alerts: dailyAlerts, weekly_insights: weeklyInsights,
        min_match_score: minScore, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Email preferences saved!");
    } catch { toast.error("Failed to save preferences"); }
    finally { setSaving(false); }
  };

  if (loading) return <Card className="p-6 flex items-center justify-center h-24"><Loader2 className="w-6 h-6 animate-spin text-accent" /></Card>;

  return (
    <Card className="p-6">
      <h2 className="font-display font-bold text-primary text-lg flex items-center gap-2 mb-4">
        <Mail className="w-5 h-5 text-accent" /> Email Preferences
      </h2>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">Daily Job Alerts</Label>
            <p className="text-xs text-muted-foreground">Get matched jobs delivered to your inbox every morning</p>
          </div>
          <Switch checked={dailyAlerts} onCheckedChange={setDailyAlerts} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">Weekly Insights</Label>
            <p className="text-xs text-muted-foreground">Resume tips and career improvement suggestions</p>
          </div>
          <Switch checked={weeklyInsights} onCheckedChange={setWeeklyInsights} />
        </div>

        <div>
          <Label className="text-sm font-medium text-foreground">Minimum Match Score for Alerts</Label>
          <p className="text-xs text-muted-foreground mb-2">Only send jobs with fit score above this threshold</p>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} value={minScore} onChange={e => setMinScore(Number(e.target.value))} className="w-24" />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>

        <div className="rounded-md bg-accent/10 p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Alerts use your <strong>Search & Match Criteria</strong> from your Profile to find relevant jobs. Update your target titles, location, and preferences there to improve alert quality.
          </p>
        </div>

        <Button onClick={savePrefs} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save Preferences
        </Button>
      </div>
    </Card>
  );
}
