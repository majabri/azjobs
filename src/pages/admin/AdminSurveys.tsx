import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Clock,
  RefreshCw,
  AlertCircle,
  Phone,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerSurvey {
  id: string;
  role: "job_seeker" | "hiring_manager" | "both";
  email: string | null;
  phone: string | null;
  wants_callback: boolean;
  answers: Record<string, unknown>;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  job_seeker: "Job Seeker",
  hiring_manager: "Hiring Manager",
  both: "Both",
};

const ROLE_COLORS: Record<string, string> = {
  job_seeker: "text-accent border-accent/40",
  hiring_manager: "text-success border-success/40",
  both: "text-warning border-warning/40",
};

export default function AdminSurveys() {
  const [surveys, setSurveys] = useState<CustomerSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_surveys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSurveys((data || []) as CustomerSurvey[]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load surveys");
    } finally {
      setLoading(false);
    }
  };

  const deleteSurvey = async (surveyId: string) => {
    if (!confirm("Delete this survey response? This cannot be undone.")) return;
    setDeletingId(surveyId);
    try {
      const { error } = await supabase
        .from("customer_surveys")
        .delete()
        .eq("id", surveyId);
      if (error) throw error;
      toast.success("Survey deleted");
      setSurveys((prev) => prev.filter((s) => s.id !== surveyId));
      if (expandedId === surveyId) setExpandedId(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete survey");
    } finally {
      setDeletingId(null);
    }
  };

  // Role distribution for summary
  const roleCounts = surveys.reduce<Record<string, number>>((acc, s) => {
    acc[s.role] = (acc[s.role] ?? 0) + 1;
    return acc;
  }, {});

  const callbackCount = surveys.filter((s) => s.wants_callback).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Clock className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Customer Surveys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {surveys.length} responses · {callbackCount} callback request
            {callbackCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Role distribution */}
      <div className="grid grid-cols-3 gap-4">
        {(["job_seeker", "hiring_manager", "both"] as const).map((role) => (
          <div
            key={role}
            className="bg-card border border-border rounded-xl p-4 shadow-sm"
          >
            <p className="text-xs text-muted-foreground mb-1">
              {ROLE_LABELS[role]}
            </p>
            <p className="text-2xl font-display font-bold text-foreground">
              {roleCounts[role] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Survey list */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            Responses ({surveys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {surveys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No survey responses yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {surveys.map((survey) => (
                <div
                  key={survey.id}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  {/* Row header */}
                  <div
                    className="flex items-center justify-between gap-3 p-3 bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() =>
                      setExpandedId((prev) =>
                        prev === survey.id ? null : survey.id,
                      )
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${ROLE_COLORS[survey.role] ?? ""}`}
                      >
                        {ROLE_LABELS[survey.role]}
                      </Badge>
                      <p className="text-sm text-foreground truncate">
                        {survey.email ?? "Anonymous"}
                      </p>
                      {survey.wants_callback && (
                        <Phone className="w-3.5 h-3.5 text-warning shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(survey.created_at).toLocaleDateString()}
                      </span>
                      {expandedId === survey.id ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === survey.id && (
                    <div className="p-4 border-t border-border space-y-3 bg-background">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-0.5">Email</p>
                          <p className="font-medium">{survey.email ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Phone</p>
                          <p className="font-medium">{survey.phone ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">
                            Callback requested
                          </p>
                          <p className="font-medium">
                            {survey.wants_callback ? "Yes" : "No"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">
                            Submitted
                          </p>
                          <p className="font-medium">
                            {new Date(survey.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Survey answers */}
                      {Object.keys(survey.answers).length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Survey Answers
                          </p>
                          <div className="space-y-2">
                            {Object.entries(survey.answers).map(([k, v]) => (
                              <div
                                key={k}
                                className="bg-muted/20 rounded-lg px-3 py-2"
                              >
                                <p className="text-[10px] text-muted-foreground capitalize mb-0.5">
                                  {k.replace(/_/g, " ")}
                                </p>
                                <p className="text-xs text-foreground">
                                  {typeof v === "object"
                                    ? JSON.stringify(v, null, 2)
                                    : String(v)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Delete */}
                      <div className="flex justify-end pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={deletingId === survey.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSurvey(survey.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3 mr-1.5" />
                          Delete response
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
