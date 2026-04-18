import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Upload, UserCircle, Search, Target, Bot, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/lib/logger';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: typeof Upload;
  route: string;
  completed: boolean;
}

export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { checkProgress(); }, []);

  const checkProgress = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [profileRes, resumeRes, analysisRes, appRes] = await Promise.all([
        supabase.from("job_seeker_profiles").select("full_name, skills").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("resume_versions").select("id").eq("user_id", session.user.id).limit(1),
        supabase.from("analysis_history").select("id").eq("user_id", session.user.id).limit(1),
        supabase.from("job_applications").select("id").eq("user_id", session.user.id).limit(1),
      ]);

      const profile = profileRes.data;
      const hasProfile = !!(profile?.full_name && (profile?.skills as string[])?.length > 0);
      const hasResume = !!(resumeRes.data && resumeRes.data.length > 0);
      const hasAnalysis = !!(analysisRes.data && analysisRes.data.length > 0);
      const hasApp = !!(appRes.data && appRes.data.length > 0);

      setItems([
        { id: "profile", label: "Complete your profile", description: "Add your name, skills, and experience", icon: UserCircle, route: "/profile", completed: hasProfile },
        { id: "resume", label: "Upload a resume", description: "Upload a PDF/DOCX to your resume vault", icon: Upload, route: "/profile", completed: hasResume },
        { id: "analyze", label: "Run your first analysis", description: "Paste a job description and see your fit score", icon: Target, route: "/job-seeker", completed: hasAnalysis },
        { id: "search", label: "Search for jobs", description: "Let AI find matching opportunities", icon: Search, route: "/job-search", completed: hasApp || hasAnalysis },
      ]);
    } catch (e) { logger.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return null;

  const completedCount = items.filter(i => i.completed).length;
  const allDone = completedCount === items.length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (allDone) return null;

  return (
    <Card className="p-5 border-accent/20 bg-accent/5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display font-bold text-foreground text-sm">Getting Started</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{completedCount} of {items.length} steps done</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-accent">{progress}%</span>
          <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground h-7 w-7 p-0">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <Progress value={progress} className="h-1.5 mb-4" />

      {!collapsed && (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                item.completed
                  ? "border-success/20 bg-success/5 opacity-70"
                  : "border-border bg-card hover:border-accent/30 hover:bg-accent/5"
              }`}
              onClick={() => !item.completed && navigate(item.route)}
            >
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              {!item.completed && (
                <item.icon className="w-4 h-4 text-accent flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
