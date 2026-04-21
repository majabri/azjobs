import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Send, Loader2, MessageSquare, Bot, User, BarChart3,
  Save, RefreshCw, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";
import { DollarSign } from "lucide-react";
import { logger } from '@/lib/logger';

function ExpectedOfferRange({ jobTitle }: { jobTitle: string }) {
  const title = jobTitle.toLowerCase();
  const seniorityMultiplier = title.includes("senior") ? 1.3 : title.includes("lead") || title.includes("staff") ? 1.5 : title.includes("director") || title.includes("vp") ? 1.8 : title.includes("junior") || title.includes("entry") ? 0.75 : 1;
  const base = Math.round(95000 * seniorityMultiplier);
  const low = Math.round(base * 0.85);
  const high = Math.round(base * 1.2);
  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`;
  return (
    <div className="flex items-center gap-4">
      <DollarSign className="w-5 h-5 text-accent flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-foreground">{fmt(low)} – {fmt(high)}</p>
        <p className="text-[10px] text-muted-foreground">Estimated based on role seniority. Use Compensation tab for detailed benchmarks.</p>
      </div>
    </div>
  );
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export default function InterviewPrepPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [jobTitle, setJobTitle] = useState(searchParams.get("title") || "");
  const [jobDesc, setJobDesc] = useState("");
  const [started, setStarted] = useState(false);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Past sessions
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);

  const loadSessions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("interview_sessions" as any).select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(10) as any;
      setSessions(data || []);
    } catch (e) { logger.error(e); }
    finally { setLoadingSessions(false); }
  };

  const startInterview = async () => {
    if (!jobTitle.trim()) { toast.error("Enter a job title"); return; }
    setStarted(true);
    setMessages([]);
    setReadinessScore(null);

    const systemMsg: ChatMessage = { role: "system", content: `Mock interview for: ${jobTitle}` };
    const assistantGreeting: ChatMessage = {
      role: "assistant",
      content: `Welcome! I'll be conducting a mock interview for the **${jobTitle}** position. I'll ask you questions one at a time, then provide feedback on your answers.\n\nLet's begin.\n\n**Tell me about yourself and why you're interested in this role.**`,
    };
    setMessages([systemMsg, assistantGreeting]);
  };

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mock-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: updatedMessages.filter(m => m.role !== "system"), jobTitle, jobDescription: jobDesc }),
      });

      if (!resp.ok) {
        if (resp.status === 429) { toast.error("Rate limit reached. Try again shortly."); setStreaming(false); return; }
        if (resp.status === 402) { toast.error("AI credits exhausted."); setStreaming(false); return; }
        throw new Error("Failed");
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > 2) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch { /* partial JSON */ }
        }
      }

      // Check for readiness score in response
      const scoreMatch = assistantContent.match(/readiness[:\s]*(\d+)/i);
      if (scoreMatch) setReadinessScore(parseInt(scoreMatch[1]));
    } catch { toast.error("AI service is temporarily unavailable. Please try again later."); }
    finally { setStreaming(false); }
  };

  const saveSession = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await (supabase.from("interview_sessions" as any) as any).insert({
        user_id: session.user.id,
        job_title: jobTitle,
        messages: messages.filter(m => m.role !== "system"),
        readiness_score: readinessScore,
      });
      toast.success("Session saved!");
      loadSessions();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const loadSession = (sess: any) => {
    setJobTitle(sess.job_title);
    setMessages(sess.messages || []);
    setReadinessScore(sess.readiness_score);
    setStarted(true);
  };

  return (
    <div className="bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {!started ? (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-bold text-primary mb-2">Interview Simulation</h1>
              <p className="text-muted-foreground">Practice with an AI interviewer that gives real-time feedback on your answers.</p>
            </div>

            {/* Expected Offer Range Card */}
            {jobTitle.trim() && (
              <Card className="p-4 border-accent/20 bg-accent/5">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  <span className="text-sm font-bold text-foreground">Expected Offer Range</span>
                </div>
                <ExpectedOfferRange jobTitle={jobTitle} />
              </Card>
            )}

            <Card className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1">Job Title</label>
                <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1">Job Description (optional)</label>
                <Textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste the job description for more targeted questions..." rows={4} />
              </div>
              <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90 w-full" onClick={startInterview}>
                <Sparkles className="w-4 h-4 mr-2" /> Start Mock Interview
              </Button>
            </Card>

            {/* Past Sessions */}
            {sessions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Previous Sessions</h3>
                <div className="space-y-2">
                  {sessions.map((s: any) => (
                    <button key={s.id} onClick={() => loadSession(s)} className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-accent/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground text-sm">{s.job_title}</span>
                        {s.readiness_score && <Badge variant="outline" className="text-xs">{s.readiness_score}% ready</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(s.created_at).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100vh-10rem)]">
            {/* Chat Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-primary">Interview: {jobTitle}</h2>
                {readinessScore && <Badge className="bg-accent/10 text-accent border-accent/20">Readiness: {readinessScore}%</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={saveSession} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Save</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setStarted(false); setMessages([]); }}>
                  <RefreshCw className="w-4 h-4 mr-1" /> New
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
              {messages.filter(m => m.role !== "system").map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-accent" /></div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-primary" /></div>
                  )}
                </div>
              ))}
              {streaming && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-accent" /></div>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3"><span className="text-sm text-muted-foreground">Thinking...</span></div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Type your answer..." rows={2} className="flex-1" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}} />
              <Button className="gradient-indigo text-white" onClick={sendMessage} disabled={streaming || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
