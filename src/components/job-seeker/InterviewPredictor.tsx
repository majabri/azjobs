import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquare, Target, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PredictedQuestion {
  question: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  weakAnswerWarning: string;
  suggestedAnswer: string;
  confidenceScore: number;
}

interface InterviewPredictorProps {
  jobDescription?: string;
  resumeText?: string;
}

export default function InterviewPredictor({ jobDescription, resumeText }: InterviewPredictorProps) {
  const [predictions, setPredictions] = useState<PredictedQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [answerFeedback, setAnswerFeedback] = useState<Record<number, { score: number; feedback: string } | null>>({});
  const [evaluatingIdx, setEvaluatingIdx] = useState<number | null>(null);

  const generatePredictions = async () => {
    if (!jobDescription || !resumeText) {
      toast.error("Need both job description and resume to predict interview questions");
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-predictor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ jobDescription: jobDescription.slice(0, 4000), resumeText: resumeText.slice(0, 4000) }),
      });

      if (!resp.ok) {
        if (resp.status === 429) { toast.error("Rate limit reached"); return; }
        if (resp.status === 402) { toast.error("AI credits exhausted"); return; }
        throw new Error("Failed");
      }

      const data = await resp.json();
      setPredictions(data.questions || []);
      toast.success(`Generated ${data.questions?.length || 0} predicted questions`);
    } catch {
      toast.error("Failed to generate predictions");
    } finally {
      setLoading(false);
    }
  };

  const evaluateAnswer = async (idx: number) => {
    const answer = userAnswers[idx]?.trim();
    if (!answer) { toast.error("Write an answer first"); return; }
    setEvaluatingIdx(idx);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-predictor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          mode: "evaluate",
          question: predictions[idx].question,
          answer,
          jobDescription: jobDescription?.slice(0, 2000),
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setAnswerFeedback(prev => ({ ...prev, [idx]: data }));
    } catch {
      toast.error("Failed to evaluate");
    } finally {
      setEvaluatingIdx(null);
    }
  };

  const difficultyColor = (d: string) => {
    if (d === "hard") return "border-destructive/30 text-destructive";
    if (d === "medium") return "border-warning/30 text-warning";
    return "border-success/30 text-success";
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground">Interview Predictor AI</h3>
            <p className="text-xs text-muted-foreground">Questions you'll likely face + where you'll struggle</p>
          </div>
        </div>
        <Button className="gradient-indigo text-white shadow-indigo-500/20 hover:opacity-90" onClick={generatePredictions} disabled={loading || !jobDescription || !resumeText}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Predicting...</> : <><Sparkles className="w-4 h-4 mr-2" /> Predict Questions</>}
        </Button>
      </div>

      {predictions.length > 0 && (
        <div className="space-y-3">
          {predictions.map((q, i) => {
            const isExpanded = expandedIdx === i;
            const feedback = answerFeedback[i];
            return (
              <div key={i} className="border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    q.confidenceScore < 40 ? "bg-destructive/15 text-destructive" :
                    q.confidenceScore < 70 ? "bg-warning/15 text-warning" :
                    "bg-success/15 text-success"
                  }`}>
                    {q.confidenceScore}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{q.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] ${difficultyColor(q.difficulty)}`}>{q.difficulty}</Badge>
                      <Badge variant="outline" className="text-[10px]">{q.category}</Badge>
                    </div>
                  </div>
                  {q.confidenceScore < 50 && (
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-1" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-3 bg-muted/10 animate-fade-in">
                    {/* Weak answer warning */}
                    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ThumbsDown className="w-3.5 h-3.5 text-destructive" />
                        <span className="text-xs font-semibold text-destructive">You will likely fail at this question if:</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{q.weakAnswerWarning}</p>
                    </div>

                    {/* Suggested answer */}
                    <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ThumbsUp className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs font-semibold text-success">Say this instead:</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{q.suggestedAnswer}</p>
                    </div>

                    {/* Practice answering */}
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">Practice Your Answer</label>
                      <Textarea
                        value={userAnswers[i] || ""}
                        onChange={e => setUserAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                        placeholder="Type your answer here to get feedback..."
                        rows={3}
                      />
                      <Button
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => evaluateAnswer(i)}
                        disabled={evaluatingIdx === i || !userAnswers[i]?.trim()}
                      >
                        {evaluatingIdx === i ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Target className="w-3 h-3 mr-1" />}
                        Evaluate My Answer
                      </Button>
                    </div>

                    {/* Feedback */}
                    {feedback && (
                      <div className={`rounded-lg p-3 border ${
                        feedback.score >= 70 ? "bg-success/5 border-success/20" :
                        feedback.score >= 50 ? "bg-warning/5 border-warning/20" :
                        "bg-destructive/5 border-destructive/20"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {feedback.score >= 70 ? <CheckCircle2 className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-warning" />}
                          <span className="text-sm font-bold">Confidence: {feedback.score}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{feedback.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
