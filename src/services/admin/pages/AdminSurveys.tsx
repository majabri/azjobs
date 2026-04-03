/**
 * Admin — Customer Interview Surveys viewer.
 * Shows all submitted surveys organized per-response with role, contact, answers.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, User, Briefcase, Users, Phone, Mail, PhoneCall, Trash2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Survey {
  id: string;
  role: string;
  email: string | null;
  phone: string | null;
  wants_callback: boolean;
  answers: Record<string, string>;
  created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof User; color: string }> = {
  job_seeker: { label: "Job Seeker", icon: User, color: "bg-blue-500/10 text-blue-500" },
  hiring_manager: { label: "Hiring Manager", icon: Briefcase, color: "bg-purple-500/10 text-purple-500" },
  both: { label: "Both", icon: Users, color: "bg-accent/10 text-accent" },
};

export default function AdminSurveys() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("customer_surveys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSurveys(data || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load surveys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSurveys(); }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("customer_surveys").delete().eq("id", id);
      if (error) throw error;
      setSurveys((prev) => prev.filter((s) => s.id !== id));
      toast.success("Survey deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6" /> Customer Interview Surveys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {surveys.length} response{surveys.length !== 1 ? "s" : ""} collected
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSurveys}>
          Refresh
        </Button>
      </div>

      {surveys.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No survey responses yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {surveys.map((survey) => {
            const roleInfo = ROLE_LABELS[survey.role] || ROLE_LABELS.job_seeker;
            const RoleIcon = roleInfo.icon;
            const answerEntries = Object.entries(survey.answers || {});

            return (
              <Card key={survey.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${roleInfo.color} border-0 gap-1`}>
                          <RoleIcon className="w-3 h-3" />
                          {roleInfo.label}
                        </Badge>
                        {survey.wants_callback && (
                          <Badge variant="outline" className="text-xs gap-1 border-warning text-warning">
                            <PhoneCall className="w-3 h-3" /> Wants Callback
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(survey.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {survey.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {survey.email}
                          </span>
                        )}
                        {survey.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {survey.phone}
                          </span>
                        )}
                        {!survey.email && !survey.phone && (
                          <span className="italic">No contact info provided</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(survey.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {answerEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No answers provided</p>
                  ) : (
                    answerEntries.map(([question, answer], i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-xs font-semibold text-primary">{question}</p>
                        <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
                          {answer}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
