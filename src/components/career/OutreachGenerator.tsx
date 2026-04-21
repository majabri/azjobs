import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MESSAGE_TYPES = [
  { value: "cold_outreach", label: "Cold Outreach" },
  { value: "warm_intro", label: "Warm Introduction" },
  { value: "informational", label: "Informational Interview" },
];

export default function OutreachGenerator() {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [contactName, setContactName] = useState("");
  const [messageType, setMessageType] = useState("cold_outreach");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!company.trim() || !role.trim()) { toast.error("Enter company and role"); return; }
    setGenerating(true);
    setResult("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const { data, error: outreachError } = await supabase.functions.invoke('generate-outreach', {
        body: { company, role, contactName, messageType },
      });

      if (outreachError) throw outreachError;
      setResult(data.message || "");
    } catch { toast.error("Failed to generate message"); }
    finally { setGenerating(false); }
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6">
      <h3 className="font-display font-bold text-primary mb-4 flex items-center gap-2"><Send className="w-4 h-4 text-accent" /> Outreach Message Generator</h3>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs font-medium text-foreground">Company</label>
          <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Google" className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground">Target Role</label>
          <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Senior Engineer" className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground">Contact Name (optional)</label>
          <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith" className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground">Message Type</label>
          <div className="flex gap-1.5 mt-1">
            {MESSAGE_TYPES.map(t => (
              <Badge key={t.value} variant={messageType === t.value ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setMessageType(t.value)}>
                {t.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <Button onClick={generate} disabled={generating} className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90">
        {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...</> : <><Send className="w-4 h-4 mr-1" /> Generate Message</>}
      </Button>

      {result && (
        <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Generated Message</span>
            <Button variant="ghost" size="sm" onClick={copyMessage} className="h-7 text-xs">
              {copied ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
            </Button>
          </div>
          <pre className="text-sm whitespace-pre-wrap text-foreground">{result}</pre>
        </div>
      )}
    </Card>
  );
}
