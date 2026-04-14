import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight, Target, Users, CheckCircle, TrendingUp, Zap, LogOut, Play,
  BarChart3, Search, FileText, Briefcase, ClipboardList, UserCircle, Shield,
  Upload, Sparkles, Bot, Star, ChevronRight, Check, X, Share2, Gift,
  MessageSquare, Globe, Mail, Clock, Award, Rocket, Loader2
} from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { analyzeJobFit } from "@/lib/analysisEngine";
import { AUTH_LOGIN, AUTH_SIGNUP } from "@/lib/routes";
import { Logo } from '@/assets/Logo';
/* ────────────────────── DATA ────────────────────── */

const stats = [
  { value: "AI-Powered", label: "resume optimization for every application" },
  { value: "Instant", label: "fit score and gap analysis in seconds" },
  { value: "24/7", label: "your AI agent works while you sleep" },
];

const howItWorks = [
  {
    step: "1",
    icon: Upload,
    title: "Upload Your Resume",
    desc: "Drop a PDF or Word doc. We extract your skills, experience, and career level in seconds.",
  },
  {
    step: "2",
    icon: Bot,
    title: "AI Works While You Sleep",
    desc: "AI matches you to open roles, tailors your resume for each one, writes cover letters, and queues applications.",
  },
  {
    step: "3",
    icon: Rocket,
    title: "Wake Up to Interviews",
    desc: "Review what your agent applied to, track progress, and prep for interviews with AI coaching.",
  },
];

const features = [
  {
    icon: Search,
    title: "AI Job Discovery",
    desc: "Matched to roles automatically based on your skills, level, and preferences — no more scrolling.",
    link: "/job-search",
  },
  {
    icon: UserCircle,
    title: "Smart Profile & Resume Vault",
    desc: "One profile, multiple resume versions — all synced and ready for any application.",
    link: "/profile",
  },
  {
    icon: TrendingUp,
    title: "Fit Score & Interview Probability",
    desc: "Instant match score, interview odds, and a prioritized action plan to improve your chances.",
    link: "/job-seeker",
  },
  {
    icon: FileText,
    title: "AI Resume Optimization",
    desc: "One-click rewrite with ATS-friendly keywords tailored to each specific role.",
    link: "/job-seeker",
  },
  {
    icon: Briefcase,
    title: "Application Package Generator",
    desc: "Tailored resume, cover letter, and pre-filled answers — ready to copy and submit.",
    link: "/job-seeker",
  },
  {
    icon: ClipboardList,
    title: "Application Tracker",
    desc: "Track every application with status updates, follow-up reminders, and outcome logging.",
    link: "/applications",
  },
  {
    icon: Bot,
    title: "Auto-Apply Agent",
    desc: "Set it and forget it. AI finds jobs, generates materials, and queues applications for your review.",
    link: "/auto-apply",
  },
];

const comparisonRows = [
  { feature: "AI-Powered Job Matching", icareeros: true, indeed: false, zip: false },
  { feature: "Resume Optimization for Each Job", icareeros: true, indeed: false, zip: false },
  { feature: "Interview Probability Score", icareeros: true, indeed: false, zip: false },
  { feature: "Auto-Generated Cover Letters", icareeros: true, indeed: false, zip: false },
  { feature: "Application Package Generator", icareeros: true, indeed: false, zip: false },
  { feature: "Skill Gap Action Plan", icareeros: true, indeed: false, zip: false },
  { feature: "Fake Job Detection", icareeros: true, indeed: false, zip: false },
  { feature: "Built-in Application Tracker", icareeros: true, indeed: true, zip: true },
];

/* ────────────────────── COMPONENT ────────────────────── */

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuthReady();

  const [totalJobCount, setTotalJobCount] = useState(0);
  const [matchedJobCount, setMatchedJobCount] = useState(0);

  // Interactive demo state
  const [demoJobDesc, setDemoJobDesc] = useState("");
  const [demoResult, setDemoResult] = useState<{
    score: number;
    improvements: string[];
    probability: number;
  } | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  // Load live job counts
  useEffect(() => {
    const loadCounts = async () => {
      const { count } = await supabase
        .from("scraped_jobs")
        .select("*", { count: "exact", head: true });
      setTotalJobCount(count || 0);

      if (user) {
        const { data: profile } = await supabase
          .from("job_seeker_profiles")
          .select("skills, target_job_titles")
          .eq("user_id", user.id)
          .maybeSingle();

        if (
          profile?.target_job_titles &&
          (profile.target_job_titles as string[]).length > 0
        ) {
          const titles = profile.target_job_titles as string[];
          const titleFilter = titles
            .map((t) => `title.ilike.%${t}%`)
            .join(",");
          const { count: matched } = await supabase
            .from("scraped_jobs")
            .select("*", { count: "exact", head: true })
            .or(titleFilter);
          setMatchedJobCount(matched || 0);
        }
      }
    };
    loadCounts();
  }, [user]);

  const handleDemoAnalyze = async () => {
    if (!demoJobDesc.trim()) return;
    setDemoLoading(true);
    setDemoResult(null);
    try {
      const sampleResume =
        "Experienced professional with skills in project management, communication, data analysis, and problem solving. 5+ years of experience in technology roles.";
      const result = analyzeJobFit(sampleResume, demoJobDesc);
      setDemoResult({
        score: result.overallScore,
        improvements: result.topActions.slice(0, 3),
        probability: result.interviewProbability,
      });
    } catch {
      setDemoResult({
        score: 0,
        improvements: ["Could not analyze. Try a more detailed description."],
        probability: 0,
      });
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ═══════════════ NAV ═══════════════ */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-primary/95 backdrop-blur-sm border-b border-white/10">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <Logo size={28} />
                    <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                                iCareer<span style={{ color: 'var(--brand)' }}>OS</span>
                                          </span>
                                                  </div>

        <nav className="flex items-center gap-1">
          {user ? (
            <>
              <NavBtn icon={<BarChart3 className="w-4 h-4" />} label="Dashboard" onClick={() => navigate("/dashboard")} />
              <NavBtn icon={<Search className="w-4 h-4" />} label="Find Jobs" onClick={() => navigate("/job-search")} />
              <NavBtn icon={<ClipboardList className="w-4 h-4" />} label="Applications" onClick={() => navigate("/applications")} />
              <NavBtn icon={<UserCircle className="w-4 h-4" />} label="Profile" onClick={() => navigate("/profile")} />
              <div className="w-px h-6 bg-white/20 mx-1" />
              <Button
                size="sm"
                variant="ghost"
                className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/10 text-xs"
                onClick={async () => { await supabase.auth.signOut(); }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 text-sm"
                onClick={() => navigate("/job-seeker?demo=true")}
              >
                Try Demo
              </Button>
              <Button
                size="sm"
                className="gradient-brand text-white font-semibold shadow-brand hover:opacity-90 ml-2"
                onClick={() => navigate(AUTH_LOGIN)}
              >
                Sign In
              </Button>
            </>
          )}
        </nav>
      </header>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-900/90 via-navy-800/80 to-navy-900/95" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Personalized welcome */}
          {user && matchedJobCount > 0 && (
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/20 border border-accent/40 text-accent text-sm font-semibold mb-6 animate-fade-up">
              <Sparkles className="w-4 h-4" />
              Welcome back — {matchedJobCount} new jobs matched to you today
            </div>
          )}

          {!user && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-indigo-500/30 text-indigo-400 text-sm font-medium mb-8 animate-fade-up">
              <Rocket className="w-3.5 h-3.5" />
              Your Intelligent Career Operating System
            </div>
          )}

          <h1
            className="text-5xl md:text-7xl font-display font-bold text-white mb-6 animate-fade-up leading-tight"
            style={{ animationDelay: "0.1s" }}
          >
            Stop Applying to Jobs.
            <br />
            <span className="text-gradient-brand">Your AI Does It For You.</span>
          </h1>

          <p
            className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto mb-10 animate-fade-up leading-relaxed"
            style={{ animationDelay: "0.2s" }}
          >
            iCareerOS finds matching jobs, optimizes your resume for each one,
            writes cover letters, and applies — all while you sleep.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            <Button
              size="lg"
              className="gradient-brand text-white font-semibold text-lg px-8 py-6 rounded-xl shadow-brand hover:opacity-90 transition-opacity animate-pulse-glow"
              onClick={() => navigate(user ? "/dashboard" : AUTH_SIGNUP)}
            >
              <Bot className="mr-2 w-5 h-5" />
              {user ? "Go to Dashboard" : "Activate My Job Agent"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white bg-white/10 hover:bg-white/20 text-lg px-8 py-6 rounded-xl backdrop-blur-sm"
              onClick={() => navigate("/job-seeker?demo=true")}
            >
              <Play className="mr-2 w-5 h-5" />
              Try Demo — No Sign Up
            </Button>
          </div>

          {/* Stats row */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            {stats.map((stat) => (
              <div
                key={stat.value}
                className="glass rounded-2xl p-6 border border-white/10"
              >
                <div className="text-3xl font-display font-bold text-indigo-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-white/60 text-sm leading-snug">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Live job count */}
          {totalJobCount > 0 && (
            <div
              className="mt-6 text-white/40 text-sm animate-fade-up"
              style={{ animationDelay: "0.5s" }}
            >
              <Globe className="w-3.5 h-3.5 inline mr-1" />
              {totalJobCount.toLocaleString()} jobs in database · Updated daily
            </div>
          )}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40 text-xs animate-bounce">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/30" />
          scroll
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="bg-background py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Three Steps to{" "}
              <span className="text-gradient-brand">Your Next Interview</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Zero manual effort. Your AI agent handles everything.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((step, i) => (
              <div key={i} className="relative text-center group">
                <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-brand group-hover:scale-110 transition-transform">
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 md:right-4 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {step.step}
                </div>
                <h3 className="font-display text-xl font-bold text-primary mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.desc}
                </p>
                {i < 2 && (
                  <ChevronRight className="hidden md:block absolute top-8 -right-5 w-6 h-6 text-accent/40" />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button
              size="lg"
              className="gradient-brand text-white font-semibold shadow-brand hover:opacity-90 px-8 py-6 text-lg"
              onClick={() => navigate(user ? "/job-seeker" : AUTH_LOGIN)}
            >
              <Upload className="mr-2 w-5 h-5" />
              Upload Resume Now
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ INTERACTIVE DEMO ═══════════════ */}
      <section className="bg-card py-24 px-6 border-y border-border">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Try It <span className="text-gradient-brand">Right Now</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Paste any job description and instantly see your fit score and
              resume improvements.
            </p>
          </div>

          <div className="bg-background rounded-2xl p-6 border border-border shadow-card space-y-4">
            <Textarea
              value={demoJobDesc}
              onChange={(e) => setDemoJobDesc(e.target.value)}
              placeholder="Paste a job description here to see your fit score instantly..."
              className="min-h-[120px] resize-none"
            />
            <Button
              className="gradient-brand text-white shadow-brand hover:opacity-90 w-full"
              disabled={demoLoading || !demoJobDesc.trim()}
              onClick={handleDemoAnalyze}
            >
              {demoLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Instant Fit Score
                </>
              )}
            </Button>

            {demoResult && (
              <div className="bg-card rounded-xl p-5 border border-border space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Your Fit Score
                    </div>
                    <div
                      className={`text-4xl font-display font-bold ${
                        demoResult.score >= 70
                          ? "text-success"
                          : demoResult.score >= 45
                          ? "text-warning"
                          : "text-destructive"
                      }`}
                    >
                      {demoResult.score}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      Interview Probability
                    </div>
                    <div
                      className={`text-2xl font-display font-bold ${
                        demoResult.probability >= 50
                          ? "text-success"
                          : "text-warning"
                      }`}
                    >
                      {demoResult.probability}%
                    </div>
                  </div>
                </div>

                {demoResult.improvements.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-primary mb-2">
                      Top Improvements
                    </div>
                    <ul className="space-y-1.5">
                      {demoResult.improvements.map((imp, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted-foreground flex items-start gap-2"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  className="gradient-brand text-white shadow-brand hover:opacity-90 w-full"
                  onClick={() => navigate(user ? "/job-seeker" : AUTH_LOGIN)}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Full Analysis & Optimized Resume
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════ BEFORE VS AFTER ═══════════════ */}
      <section className="bg-background py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              See the <span className="text-gradient-brand">AI Difference</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              One click transforms your resume from generic to interview-ready.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Before */}
            <div className="bg-card rounded-2xl p-6 border border-destructive/20 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-destructive">
                    Before
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Generic resume — 42% match
                  </p>
                </div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border text-sm space-y-2 font-mono text-muted-foreground">
                <p>• Managed IT systems and networks</p>
                <p>• Responsible for security compliance</p>
                <p>• Worked with cloud platforms</p>
                <p>• Handled incident response</p>
                <p className="text-destructive/60 text-xs mt-3">
                  Missing keywords: SIEM, Zero Trust, NIST, SOC 2
                </p>
              </div>
            </div>

            {/* After */}
            <div className="bg-card rounded-2xl p-6 border border-success/20 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-success" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-success">
                    After
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ATS-optimized — 87% match
                  </p>
                </div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border text-sm space-y-2 font-mono text-foreground">
                <p>
                  • Architected{" "}
                  <span className="text-accent font-semibold">Zero Trust</span>{" "}
                  security framework across hybrid cloud infrastructure
                </p>
                <p>
                  • Led{" "}
                  <span className="text-accent font-semibold">NIST 800-53</span>{" "}
                  compliance achieving{" "}
                  <span className="text-accent font-semibold">SOC 2</span> Type
                  II certification
                </p>
                <p>
                  • Deployed{" "}
                  <span className="text-accent font-semibold">SIEM</span>{" "}
                  solution reducing incident response time by 65%
                </p>
                <p className="text-success/80 text-xs mt-3">
                  ATS keywords aligned · Interview probability: 72%
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button
              size="lg"
              className="gradient-brand text-white font-semibold shadow-brand hover:opacity-90 px-8 py-6 text-lg"
              onClick={() => navigate(user ? "/job-seeker" : AUTH_LOGIN)}
            >
              <Sparkles className="mr-2 w-5 h-5" />
              Optimize My Resume
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ ALL FEATURES ═══════════════ */}
      <section className="bg-card py-24 px-6 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Everything to{" "}
              <span className="text-gradient-brand">Get You Hired Faster</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From discovering opportunities to landing offers — iCareerOS
              automates your entire job search.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="bg-background rounded-2xl p-7 shadow-card border border-border hover:shadow-elevated hover:border-accent/30 transition-all cursor-pointer group"
                style={{ animationDelay: `${i * 0.1}s` }}
                onClick={() => navigate(user ? f.link : AUTH_LOGIN)}
              >
                <div className="w-11 h-11 gradient-brand rounded-xl flex items-center justify-center mb-5 shadow-brand group-hover:scale-110 transition-transform">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-primary mb-2">
                  {f.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {f.desc}
                </p>
                <div className="flex items-center gap-1 text-accent text-sm font-medium mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  Try it <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ COMPARISON TABLE ═══════════════ */}
      <section className="bg-background py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Why We're{" "}
              <span className="text-gradient-brand">
                Better Than Job Boards
              </span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Job boards show listings. We help you{" "}
              <strong>get hired</strong>.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="grid grid-cols-4 gap-0">
              {/* Header row */}
              <div className="p-4 border-b border-border font-semibold text-sm text-muted-foreground">
                Feature
              </div>
              <div className="p-4 border-b border-border text-center">
                <div className="inline-flex items-center gap-1.5">
                  <div className="w-5 h-5 gradient-brand rounded flex items-center justify-center">
                    <Target className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-display font-bold text-primary text-sm">
                    iCareerOS
                  </span>
                </div>
              </div>
              <div className="p-4 border-b border-border text-center font-semibold text-sm text-muted-foreground">
                Indeed
              </div>
              <div className="p-4 border-b border-border text-center font-semibold text-sm text-muted-foreground">
                ZipRecruiter
              </div>

              {/* Data rows */}
              {comparisonRows.map((row, i) => (
                <div key={row.feature} className="contents">
                  <div
                    className={`p-4 text-sm text-foreground ${
                      i < comparisonRows.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    {row.feature}
                  </div>
                  <div
                    className={`p-4 text-center ${
                      i < comparisonRows.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    {row.icareeros ? (
                      <Check className="w-5 h-5 text-success mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-destructive/40 mx-auto" />
                    )}
                  </div>
                  <div
                    className={`p-4 text-center ${
                      i < comparisonRows.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    {row.indeed ? (
                      <Check className="w-5 h-5 text-success mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-destructive/40 mx-auto" />
                    )}
                  </div>
                  <div
                    className={`p-4 text-center ${
                      i < comparisonRows.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    {row.zip ? (
                      <Check className="w-5 h-5 text-success mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-destructive/40 mx-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section className="py-24 px-6" style={{ background: "var(--gradient-hero)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
            Ready to Let AI{" "}
            <span className="text-gradient-brand">Land Your Next Job?</span>
          </h2>
          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
            Upload your resume once. Wake up to interview invitations. It's that simple.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button
              size="lg"
              className="gradient-brand text-white font-semibold text-lg px-10 py-6 rounded-xl shadow-brand hover:opacity-90 animate-pulse-glow"
              onClick={() => navigate(user ? "/dashboard" : AUTH_LOGIN)}
            >
              <Bot className="mr-2 w-5 h-5" />
              {user ? "Go to Dashboard" : "Get Started Free"}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white bg-white/10 hover:bg-white/20 text-lg px-8 py-6 rounded-xl backdrop-blur-sm"
              onClick={() => navigate("/job-seeker?demo=true")}
            >
              <Play className="mr-2 w-5 h-5" />
              Try Demo First
            </Button>
          </div>

          <p className="text-white/40 text-sm">
            No credit card required. Free forever for basic features.
          </p>
        </div>
      </section>

      {/* ═══════════════ MOBILE STICKY CTA ═══════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-sm border-t border-white/10 px-4 py-3 flex items-center justify-center gap-3 sm:hidden">
        <Button
          size="sm"
          className="gradient-brand text-white font-semibold shadow-brand text-xs flex-1"
          onClick={() => navigate(user ? "/job-seeker" : AUTH_LOGIN)}
        >
          <Upload className="w-3.5 h-3.5 mr-1" />
          Upload Resume
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/30 text-white bg-white/10 text-xs flex-1"
          onClick={() => navigate(user ? "/job-search" : AUTH_LOGIN)}
        >
          <Search className="w-3.5 h-3.5 mr-1" />
          Find Jobs
        </Button>
      </div>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="bg-primary py-10 px-6 sm:pb-10 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 gradient-brand rounded-md flex items-center justify-center">
                <Target className="w-3 h-3 text-white" />
              </div>
              <span className="font-display font-bold text-primary-foreground">
                iCareerOS
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-primary-foreground/50 text-sm">
              <button
                className="hover:text-primary-foreground transition-colors"
                onClick={() => navigate("/job-seeker")}
              >
                Get Interviews
              </button>
              <button
                className="hover:text-primary-foreground transition-colors"
                onClick={() => navigate("/job-search")}
              >
                Find Jobs
              </button>
              <button
                className="hover:text-primary-foreground transition-colors"
                onClick={() => navigate("/applications")}
              >
                Track
              </button>
              <button
                className="hover:text-primary-foreground transition-colors"
                onClick={() => navigate("/dashboard")}
              >
                Dashboard
              </button>
            </div>
          </div>
          <div className="border-t border-white/10 pt-4 text-center">
            <p className="text-primary-foreground/40 text-sm">
              iCareerOS — Intelligent Career Operating System. Built by Amir
              Jabri.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ────────────────────── SUB-COMPONENTS ────────────────────── */

function NavBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10 text-xs gap-1 px-2.5"
      onClick={onClick}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </Button>
  );
}
