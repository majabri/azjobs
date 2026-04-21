import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckCircle2, Bell, ArrowRight, TrendingUp, ArrowUpRight } from "lucide-react";

interface JobApplication {
  id: string;
  job_title: string;
  company: string;
  status: string;
  applied_at: string;
  updated_at: string;
  follow_up_date: string | null;
  followed_up: boolean;
}

interface AnalysisRecord {
  job_title: string;
  company: string;
  overall_score: number;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: "applied" | "status_change" | "follow_up";
  title: string;
  subtitle: string;
  status: string;
  appId: string;
  scoreBefore?: number;
  scoreAfter?: number;
  interviewDelta?: number;
}

const statusEmoji: Record<string, string> = {
  applied: "📤",
  interview: "🎤",
  offer: "🎉",
  rejected: "❌",
};

const statusColors: Record<string, string> = {
  applied: "bg-accent/15 text-accent border-accent/30",
  interview: "bg-warning/15 text-warning border-warning/30",
  offer: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function ApplicationTimeline({ applications, analyses }: { applications: JobApplication[]; analyses?: AnalysisRecord[] }) {
  const events = useMemo(() => {
    const items: TimelineEvent[] = [];

    for (const app of applications) {
      // Find matching analyses for before/after scoring
      const matchingAnalyses = (analyses || [])
        .filter(a => a.job_title?.toLowerCase() === app.job_title?.toLowerCase() || a.company?.toLowerCase() === app.company?.toLowerCase())
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const firstScore = matchingAnalyses[0]?.overall_score;
      const lastScore = matchingAnalyses.length > 1 ? matchingAnalyses[matchingAnalyses.length - 1]?.overall_score : undefined;
      const interviewDelta = lastScore && firstScore ? Math.round((lastScore - firstScore) * 0.8) : undefined;

      // Applied event
      items.push({
        id: `${app.id}-applied`,
        date: app.applied_at,
        type: "applied",
        title: app.job_title,
        subtitle: `Applied to ${app.company}`,
        status: "applied",
        appId: app.id,
        scoreBefore: firstScore,
        scoreAfter: lastScore,
        interviewDelta,
      });

      // Status change
      if (app.status !== "applied" && app.updated_at !== app.applied_at) {
        items.push({
          id: `${app.id}-status`,
          date: app.updated_at,
          type: "status_change",
          title: app.job_title,
          subtitle: `${app.company} — moved to ${app.status}`,
          status: app.status,
          appId: app.id,
          scoreBefore: firstScore,
          scoreAfter: lastScore,
        });
      }

      // Follow-up event
      if (app.follow_up_date) {
        items.push({
          id: `${app.id}-followup`,
          date: app.follow_up_date,
          type: "follow_up",
          title: app.job_title,
          subtitle: `${app.company} — ${app.followed_up ? "followed up ✓" : "follow-up scheduled"}`,
          status: app.status,
          appId: app.id,
        });
      }
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [applications, analyses]);

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">No timeline events yet</p>
        <p className="text-sm mt-1">Start tracking applications to see your journey here.</p>
      </div>
    );
  }

  // Group by date
  const grouped = events.reduce<Record<string, TimelineEvent[]>>((acc, ev) => {
    const day = new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    (acc[day] ??= []).push(ev);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([day, dayEvents]) => (
        <div key={day}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{day}</span>
          </div>
          <div className="ml-3 border-l-2 border-border pl-5 space-y-3">
            {dayEvents.map((ev) => (
              <div key={ev.id} className="relative animate-fade-up">
                <div className="absolute -left-[27px] top-3 w-3 h-3 rounded-full border-2 border-background bg-accent" />
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-card transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {ev.type === "applied" && <ArrowRight className="w-3.5 h-3.5 text-accent" />}
                        {ev.type === "status_change" && <CheckCircle2 className="w-3.5 h-3.5 text-warning" />}
                        {ev.type === "follow_up" && <Bell className="w-3.5 h-3.5 text-warning" />}
                        <p className="text-sm font-semibold text-foreground truncate">{ev.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{ev.subtitle}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(ev.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Before/After score badges */}
                      {ev.scoreBefore != null && ev.type === "applied" && (
                        <div className="flex items-center gap-1">
                          {ev.scoreAfter != null && ev.scoreAfter !== ev.scoreBefore ? (
                            <>
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">{ev.scoreBefore}%</Badge>
                              <ArrowUpRight className="w-3 h-3 text-success" />
                              <Badge variant="outline" className="text-[10px] text-success border-success/30">{ev.scoreAfter}%</Badge>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">{ev.scoreBefore}% fit</Badge>
                          )}
                        </div>
                      )}
                      {ev.interviewDelta != null && ev.interviewDelta > 0 && ev.type === "applied" && (
                        <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                          <TrendingUp className="w-3 h-3 mr-0.5" />+{ev.interviewDelta}% interview prob
                        </Badge>
                      )}
                      <Badge variant="outline" className={`capitalize text-[10px] ${statusColors[ev.status] || ""}`}>
                        {statusEmoji[ev.status] || ""} {ev.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
