import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FeedbackCollectorProps {
  applicationId: string;
  currentStatus: string;
  appliedAt?: string;
  onStatusUpdate: (id: string, status: string) => void;
}

const OUTCOMES = [
  {
    value: "no_response",
    label: "No Response",
    icon: Clock,
    color: "text-muted-foreground",
  },
  {
    value: "interview",
    label: "Got Interview",
    icon: ThumbsUp,
    color: "text-success",
  },
  {
    value: "rejected",
    label: "Rejected",
    icon: ThumbsDown,
    color: "text-destructive",
  },
  {
    value: "offer",
    label: "Got Offer!",
    icon: CheckCircle2,
    color: "text-accent",
  },
];

export default function FeedbackCollector({
  applicationId,
  currentStatus,
  appliedAt,
  onStatusUpdate,
}: FeedbackCollectorProps) {
  const [saving, setSaving] = useState(false);

  const handleOutcome = async (outcome: string) => {
    setSaving(true);
    try {
      const statusMap: Record<string, string> = {
        no_response: "applied",
        interview: "interview",
        rejected: "rejected",
        offer: "offer",
      };
      const newStatus = statusMap[outcome] || currentStatus;

      // Calculate response days if we have appliedAt
      let responseDays: number | null = null;
      if (appliedAt && outcome !== "no_response") {
        responseDays = Math.round(
          (Date.now() - new Date(appliedAt).getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      await supabase
        .from("job_applications")
        .update({
          status: newStatus,
          follow_up_notes: `Outcome: ${outcome} (logged ${new Date().toLocaleDateString()})`,
          updated_at: new Date().toISOString(),
          ...(responseDays !== null ? { response_days: responseDays } : {}),
        })
        .eq("id", applicationId);

      onStatusUpdate(applicationId, newStatus);
      toast.success(
        "Outcome logged — this helps improve future recommendations!",
      );
    } catch {
      toast.error("Failed to save outcome");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
      {OUTCOMES.map((o) => (
        <Button
          key={o.value}
          variant="ghost"
          size="sm"
          className={`h-7 px-2 text-xs gap-1 ${currentStatus === (o.value === "no_response" ? "applied" : o.value) ? "bg-accent/10" : ""}`}
          disabled={saving}
          onClick={() => handleOutcome(o.value)}
        >
          <o.icon className={`w-3 h-3 ${o.color}`} />
          <span className="hidden sm:inline">{o.label}</span>
        </Button>
      ))}
    </div>
  );
}
