import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Loader2, Mail, Copy, MessageSquare, Calendar, Send, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ReplyType = "thank_you" | "schedule_interview" | "follow_up" | "negotiate" | "decline";

const REPLY_TYPES: { value: ReplyType; label: string; desc: string }[] = [
  { value: "thank_you", label: "Thank You", desc: "Acknowledge receipt of their message" },
  { value: "schedule_interview", label: "Schedule Interview", desc: "Propose or confirm interview times" },
  { value: "follow_up", label: "Follow Up", desc: "Check in on application status" },
  { value: "negotiate", label: "Negotiate Offer", desc: "Counter or discuss offer terms" },
  { value: "decline", label: "Decline Politely", desc: "Gracefully decline an opportunity" },
];

export default function RecruiterAssistant() {
  const [recruiterMessage, setRecruiterMessage] = useState("");
  const [replyType, setReplyType] = useState<ReplyType>("thank_you");
  const [draftReply, setDraftReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState("");

  const generateReply = async () => {
    if (!recruiterMessage.trim()) {
      toast.error("Paste the recruiter's message first");
      return;
    }
    setLoading(true);
    setDraftReply("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const { data: profile } = await supabase
        .from("job_seeker_profiles")
        .select("full_name, skills, career_level, target_job_titles")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recruiter-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            recruiterMessage,
            replyType,
            availability,
            userName: profile?.full_name || "",
            skills: (profile?.skills as string[]) || [],
            careerLevel: (profile as any)?.career_level || "",
          }),
        }
      );

      if (!resp.ok) throw new Error("Failed to generate reply");

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(line.slice(6));
                text += parsed.choices?.[0]?.delta?.content || "";
                setDraftReply(text);
              } catch {}
            }
          }
        }
      }
    } catch {
      toast.error("Failed to generate reply");
    } finally {
      setLoading(false);
    }
  };

  const copyReply = () => {
    navigator.clipboard.writeText(draftReply);
    toast.success("Reply copied to clipboard!");
  };

  const openInEmail = () => {
    const subject = replyType === "schedule_interview" ? "Re: Interview Scheduling" :
                    replyType === "negotiate" ? "Re: Offer Discussion" :
                    replyType === "follow_up" ? "Following Up on My Application" :
                    "Thank You";
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draftReply)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-accent" />
        <h3 className="font-display font-bold text-primary text-lg">AI Recruiter Assistant</h3>
      </div>

      {/* Paste recruiter message */}
      <Card className="p-4 space-y-4">
        <div>
          <Label className="text-sm font-semibold">Recruiter's Message</Label>
          <Textarea
            value={recruiterMessage}
            onChange={e => setRecruiterMessage(e.target.value)}
            placeholder="Paste the recruiter's email or message here..."
            className="mt-1 min-h-[100px]"
          />
        </div>

        {/* Reply Type */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Reply Type</Label>
          <div className="flex flex-wrap gap-2">
            {REPLY_TYPES.map(rt => (
              <Badge
                key={rt.value}
                variant={replyType === rt.value ? "default" : "outline"}
                className={`cursor-pointer text-xs ${replyType === rt.value ? "bg-primary text-primary-foreground" : "hover:bg-accent/10"}`}
                onClick={() => setReplyType(rt.value)}
              >
                {rt.label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {REPLY_TYPES.find(r => r.value === replyType)?.desc}
          </p>
        </div>

        {/* Availability for scheduling */}
        {replyType === "schedule_interview" && (
          <div>
            <Label className="text-sm font-semibold">Your Availability</Label>
            <Textarea
              value={availability}
              onChange={e => setAvailability(e.target.value)}
              placeholder="e.g. Monday-Wednesday 10am-2pm EST, Thursday after 3pm..."
              className="mt-1 min-h-[60px]"
            />
          </div>
        )}

        <Button className="gradient-brand text-white shadow-brand hover:opacity-90" onClick={generateReply} disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Drafting...</> : <><Sparkles className="w-4 h-4 mr-2" /> Draft Reply</>}
        </Button>
      </Card>

      {/* Generated Reply */}
      {draftReply && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-primary flex items-center gap-1">
              <Mail className="w-4 h-4" /> Draft Reply
            </h4>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs" onClick={copyReply}>
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={openInEmail}>
                <Send className="w-3 h-3 mr-1" /> Open in Email
              </Button>
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground">{draftReply}</pre>
          </div>
        </Card>
      )}
    </div>
  );
}
