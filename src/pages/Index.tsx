import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Target, Users, CheckCircle, TrendingUp, Zap, LogOut, Play,
  BarChart3, Search, FileText, Briefcase, ClipboardList, UserCircle, Shield,
  Upload, Sparkles, Bot, Star, ChevronRight, Check, X, Share2, Gift,
  MessageSquare, Globe, Mail, Clock, Award, Rocket
} from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const stats = [
  { value: "3x", label: "more interview callbacks with ATS-optimized resumes" },
  { value: "< 30s", label: "to get matched with relevant jobs" },
  { value: "89%", label: "of users improve their match score on the first try" },
];

const features = [
  { icon: Search, title: "AI Job Discovery", desc: "Jobs found for you automatically based on your skills, career level, and preferences.", link: "/job-search" },
  { icon: UserCircle, title: "Smart Profile & Resume Vault", desc: "Store your profile, skills, certifications, and multiple resume versions.", link: "/profile" },
  { icon: TrendingUp, title: "Fit Score & Interview Probability", desc: "See your match score, interview probability, and the top actions to improve your chances.", link: "/job-seeker" },
  { icon: FileText, title: "AI Resume Optimization", desc: "One click rewrites your resume with ATS-friendly keywords tailored to each role.", link: "/job-seeker" },
  { icon: Briefcase, title: "Application Package Generator", desc: "Get a tailored resume, cover letter, and pre-filled answers — ready to copy and submit.", link: "/job-seeker" },
  { icon: ClipboardList, title: "Application Tracker", desc: "Track every application with status updates, follow-up reminders, and outcome logging.", link: "/applications" },
  { icon: Bot, title: "Auto-Apply Agent", desc: "Set preferences and let AI find jobs, generate materials, and queue applications for your review.", link: "/auto-apply" },
];

const howItWorks = [
  { step: "1", icon: Upload, title: "Upload Your Resume", desc: "Upload a PDF or Word doc. We extract your skills, experience, and career level automatically." },
  { step: "2", icon: Target, title: "Get Matched Jobs", desc: "AI finds jobs that match your profile and ranks them by fit score and interview probability." },
  { step: "3", icon: Rocket, title: "Auto-Optimize & Apply", desc: "Generate tailored resumes, cover letters, and application packages — then apply with one click." },
];

const sampleJobs = [
  { title: "Senior Security Engineer", company: "CrowdStrike", location: "Remote", score: 92, tag: "High Chance" },
  { title: "Cloud Infrastructure Lead", company: "AWS", location: "Arlington, VA", score: 85, tag: "Quick Apply" },
  { title: "DevOps Engineer", company: "Capital One", location: "McLean, VA", score: 78, tag: "High Chance" },
  { title: "Cybersecurity Analyst", company: "Booz Allen Hamilton", location: "Washington, DC", score: 71, tag: "Apply Now" },
];

const comparisonRows = [
  { feature: "AI-Powered Job Matching", fitcheck: true, indeed: false, zip: false },
  { feature: "Resume Optimization for Each Job", fitcheck: true, indeed: false, zip: false },
  { feature: "Interview Probability Score", fitcheck: true, indeed: false, zip: false },
  { feature: "Auto-Generated Cover Letters", fitcheck: true, indeed: false, zip: false },
  { feature: "Application Package Generator", fitcheck: true, indeed: false, zip: false },
  { feature: "Skill Gap Action Plan", fitcheck: true, indeed: false, zip: false },
  { feature: "Fake Job Detection", fitcheck: true, indeed: false, zip: false },
  { feature: "Built-in Application Tracker", fitcheck: true, indeed: true, zip: true },
];

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const handleCopyReferral = () => {
    const url = `${window.location.origin}?ref=${user?.id?.slice(0, 8) || "friend"}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-primary/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-8 h-8 gradient-teal rounded-lg flex items-center justify-center shadow-teal">
            <Target className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold text-primary-foreground">FitCheck</span>
        </div>
        <nav className="flex items-center gap-1">
          {user ? (
            <>
              <NavBtn icon={<Zap className="w-4 h-4" />} label="Analyze" onClick={() => navigate("/job-seeker")} />
              <NavBtn icon={<Search className="w-4 h-4" />} label="Find Jobs" onClick={() => navigate("/job-search")} />
              <NavBtn icon={<ClipboardList className="w-4 h-4" />} label="Applications" onClick={() => navigate("/applications")} />
              <NavBtn icon={<UserCircle className="w-4 h-4" />} label="Profile" onClick={() => navigate("/profile")} />
              <NavBtn icon={<BarChart3 className="w-4 h-4" />} label="Dashboard" onClick={() => navigate("/dashboard")} />
              <NavBtn icon={<Bot className="w-4 h-4" />} label="Auto-Apply" onClick={() => navigate("/auto-apply")} />
              <div className="w-px h-6 bg-white/20 mx-1" />
              <Button
                size="sm"
                variant="ghost"
                className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/10 text-xs"
                onClick={async () => { await supabase.auth.signOut(); setUser(null); }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 text-sm" onClick={() => navigate("/job-seeker")}>
                Job Seekers
              </Button>
              <Button variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 text-sm" onClick={() => navigate("/hiring-manager")}>
                Hiring Managers
              </Button>
              <Button size="sm" className="gradient-teal text-white font-semibold shadow-teal hover:opacity-90 ml-2" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            </>
          )}
        </nav>
      </header>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-900/90 via-navy-800/80 to-navy-900/95" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-teal-500/30 text-teal-400 text-sm font-medium mb-8 animate-fade-up">
            <Rocket className="w-3.5 h-3.5" />
            Smarter Than Any Job Board
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 animate-fade-up leading-tight" style={{ animationDelay: "0.1s" }}>
            We Apply to Jobs For You
            <br />
            <span className="text-gradient-teal">& Get You More Interviews</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto mb-12 animate-fade-up leading-relaxed" style={{ animationDelay: "0.2s" }}>
            AI finds the best jobs, rewrites your resume, and helps you apply faster — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button
              size="lg"
              className="gradient-teal text-white font-semibold text-lg px-8 py-6 rounded-xl shadow-teal hover:opacity-90 transition-opacity animate-pulse-glow"
              onClick={() => navigate(user ? "/job-seeker" : "/auth")}
            >
              <Upload className="mr-2 w-5 h-5" />
              Upload Resume & Get Matched
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white bg-white/10 hover:bg-white/20 text-lg px-8 py-6 rounded-xl backdrop-blur-sm"
              onClick={() => navigate(user ? "/auto-apply" : "/auth")}
            >
              <Bot className="mr-2 w-5 h-5" />
              Start Auto-Applying
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4 animate-fade-up" style={{ animationDelay: "0.35s" }}>
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/10 text-sm"
              onClick={() => navigate("/job-seeker?demo=true")}
            >
              <Play className="mr-2 w-4 h-4" /> Try Demo — No Sign Up
            </Button>
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/10 text-sm"
              onClick={() => navigate(user ? "/job-search" : "/auth")}
            >
              <Search className="mr-2 w-4 h-4" /> Find Jobs For Me
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 animate-fade-up" style={{ animationDelay: "0.4s" }}>
            {stats.map((stat) => (
              <div key={stat.value} className="glass rounded-2xl p-6 border border-white/10">
                <div className="text-3xl font-display font-bold text-teal-400 mb-2">{stat.value}</div>
                <div className="text-white/60 text-sm leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>
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
              How It <span className="text-gradient-teal">Works</span>
            </h2>
            <p className="text-muted-foreground text-lg">Three steps to your next interview.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((step, i) => (
              <div key={i} className="relative text-center group">
                <div className="w-16 h-16 gradient-teal rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-teal group-hover:scale-110 transition-transform">
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 md:right-4 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {step.step}
                </div>
                <h3 className="font-display text-xl font-bold text-primary mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                {i < 2 && <ChevronRight className="hidden md:block absolute top-8 -right-5 w-6 h-6 text-accent/40" />}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button size="lg" className="gradient-teal text-white font-semibold shadow-teal hover:opacity-90 px-8 py-6 text-lg" onClick={() => navigate(user ? "/job-seeker" : "/auth")}>
              <Upload className="mr-2 w-5 h-5" /> Upload Resume Now
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ TODAY'S MATCHES PREVIEW ═══════════════ */}
      <section className="bg-card py-24 px-6 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Today's <span className="text-gradient-teal">Matches Preview</span>
            </h2>
            <p className="text-muted-foreground text-lg">See what personalized job matching looks like — these update daily for each user.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {sampleJobs.map((job) => (
              <div key={job.title} className="bg-background rounded-2xl p-5 border border-border shadow-card hover:shadow-elevated transition-shadow group cursor-pointer" onClick={() => navigate(user ? "/job-search" : "/auth")}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground">{job.title}</h4>
                    <p className="text-sm text-muted-foreground">{job.company} · {job.location}</p>
                  </div>
                  <div className={`text-2xl font-display font-bold ${job.score >= 80 ? "text-success" : job.score >= 60 ? "text-warning" : "text-destructive"}`}>
                    {job.score}%
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs border-accent/30 text-accent">{job.tag}</Badge>
                  <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Analyze fit <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="outline" size="lg" className="border-accent/30 text-accent hover:bg-accent/10" onClick={() => navigate(user ? "/job-search" : "/auth")}>
              <Search className="mr-2 w-4 h-4" /> Find Jobs For Me
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ BEFORE VS AFTER ═══════════════ */}
      <section className="bg-background py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Before vs After <span className="text-gradient-teal">Resume Optimization</span>
            </h2>
            <p className="text-muted-foreground text-lg">See how AI transforms your resume for each specific job.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Before */}
            <div className="bg-card rounded-2xl p-6 border border-destructive/20 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-destructive">Before</h3>
                  <p className="text-xs text-muted-foreground">Generic resume — 42% match</p>
                </div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border text-sm space-y-2 font-mono text-muted-foreground">
                <p>• Managed IT systems and networks</p>
                <p>• Responsible for security compliance</p>
                <p>• Worked with cloud platforms</p>
                <p>• Handled incident response</p>
                <p className="text-destructive/60 text-xs mt-3">❌ Missing keywords: SIEM, Zero Trust, NIST, SOC 2</p>
              </div>
            </div>

            {/* After */}
            <div className="bg-card rounded-2xl p-6 border border-success/20 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-success" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-success">After</h3>
                  <p className="text-xs text-muted-foreground">ATS-optimized — 87% match</p>
                </div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border text-sm space-y-2 font-mono text-foreground">
                <p>• Architected <span className="text-accent font-semibold">Zero Trust</span> security framework across hybrid cloud infrastructure</p>
                <p>• Led <span className="text-accent font-semibold">NIST 800-53</span> compliance achieving <span className="text-accent font-semibold">SOC 2</span> Type II certification</p>
                <p>• Deployed <span className="text-accent font-semibold">SIEM</span> solution reducing incident response time by 65%</p>
                <p className="text-success/80 text-xs mt-3">✅ ATS keywords aligned · Interview probability: 72%</p>
              </div>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button size="lg" className="gradient-teal text-white font-semibold shadow-teal hover:opacity-90 px-8 py-6 text-lg" onClick={() => navigate(user ? "/job-seeker" : "/auth")}>
              <Sparkles className="mr-2 w-5 h-5" /> Optimize My Resume
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ COMPARISON TABLE ═══════════════ */}
      <section className="bg-card py-24 px-6 border-y border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Why We're <span className="text-gradient-teal">Better Than Job Boards</span>
            </h2>
            <p className="text-muted-foreground text-lg">Job boards show listings. We help you <strong>get hired</strong>.</p>
          </div>

          <div className="bg-background rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="grid grid-cols-4 gap-0">
              {/* Header */}
              <div className="p-4 border-b border-border font-semibold text-sm text-muted-foreground">Feature</div>
              <div className="p-4 border-b border-border text-center">
                <div className="inline-flex items-center gap-1.5">
                  <div className="w-5 h-5 gradient-teal rounded flex items-center justify-center"><Target className="w-3 h-3 text-white" /></div>
                  <span className="font-display font-bold text-primary text-sm">FitCheck</span>
                </div>
              </div>
              <div className="p-4 border-b border-border text-center font-semibold text-sm text-muted-foreground">Indeed</div>
              <div className="p-4 border-b border-border text-center font-semibold text-sm text-muted-foreground">ZipRecruiter</div>

              {/* Rows */}
              {comparisonRows.map((row, i) => (
                <div key={row.feature} className="contents">
                  <div className={`p-4 text-sm text-foreground ${i < comparisonRows.length - 1 ? "border-b border-border" : ""}`}>{row.feature}</div>
                  <div className={`p-4 text-center ${i < comparisonRows.length - 1 ? "border-b border-border" : ""}`}>
                    {row.fitcheck ? <Check className="w-5 h-5 text-success mx-auto" /> : <X className="w-5 h-5 text-destructive/40 mx-auto" />}
                  </div>
                  <div className={`p-4 text-center ${i < comparisonRows.length - 1 ? "border-b border-border" : ""}`}>
                    {row.indeed ? <Check className="w-5 h-5 text-success mx-auto" /> : <X className="w-5 h-5 text-destructive/40 mx-auto" />}
                  </div>
                  <div className={`p-4 text-center ${i < comparisonRows.length - 1 ? "border-b border-border" : ""}`}>
                    {row.zip ? <Check className="w-5 h-5 text-success mx-auto" /> : <X className="w-5 h-5 text-destructive/40 mx-auto" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-10">
            <Button size="lg" className="gradient-teal text-white font-semibold shadow-teal hover:opacity-90 px-8 py-6 text-lg" onClick={() => navigate(user ? "/job-seeker" : "/auth")}>
              {user ? "Go to Dashboard" : "Get Started Free"} <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════ ALL FEATURES ═══════════════ */}
      <section className="bg-background py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              Everything to <span className="text-gradient-teal">get you hired faster</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From discovering opportunities to landing offers — FitCheck automates your entire job search.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="bg-card rounded-2xl p-7 shadow-card border border-border hover:shadow-elevated hover:border-accent/30 transition-all cursor-pointer group"
                style={{ animationDelay: `${i * 0.1}s` }}
                onClick={() => navigate(user ? f.link : "/auth")}
              >
                <div className="w-11 h-11 gradient-teal rounded-xl flex items-center justify-center mb-5 shadow-teal group-hover:scale-110 transition-transform">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-primary mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                <div className="flex items-center gap-1 text-accent text-sm font-medium mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  Try it <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>

          {/* Dual CTA */}
          <div className="grid md:grid-cols-2 gap-8">
            <div
              className="relative overflow-hidden rounded-3xl p-10 cursor-pointer group"
              style={{ background: "var(--gradient-hero)" }}
              onClick={() => navigate("/job-seeker")}
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500" />
              <Target className="w-10 h-10 text-teal-400 mb-6" />
              <h3 className="font-display text-2xl font-bold text-white mb-3">Get Interviews Automatically</h3>
              <p className="text-white/70 mb-8 leading-relaxed">
                Upload your resume, get matched jobs, optimize materials, and apply — all automated with AI.
              </p>
              <div className="flex items-center gap-2 text-teal-400 font-semibold">
                Start now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <div
              className="relative overflow-hidden bg-card rounded-3xl p-10 cursor-pointer group border border-border hover:shadow-elevated transition-shadow"
              onClick={() => navigate("/hiring-manager")}
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500" />
              <Users className="w-10 h-10 text-accent mb-6" />
              <h3 className="font-display text-2xl font-bold text-primary mb-3">Hiring Managers</h3>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Define your requirements and instantly see which candidates qualify — and where others fall short.
              </p>
              <div className="flex items-center gap-2 text-accent font-semibold">
                Screen candidates <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ REFERRAL / SHARE ═══════════════ */}
      {user && (
        <section className="bg-card py-16 px-6 border-t border-border">
          <div className="max-w-3xl mx-auto text-center">
            <Gift className="w-10 h-10 text-accent mx-auto mb-4" />
            <h2 className="text-3xl font-display font-bold text-primary mb-3">Invite Friends & Unlock More</h2>
            <p className="text-muted-foreground mb-6">Share FitCheck with friends. Each referral helps us grow and improve the platform for everyone.</p>
            <div className="flex justify-center gap-3">
              <Button className="gradient-teal text-white shadow-teal hover:opacity-90" onClick={handleCopyReferral}>
                <Share2 className="w-4 h-4 mr-2" /> Copy Referral Link
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ ONBOARDING FUNNEL (LOGGED OUT) ═══════════════ */}
      {!user && (
        <section className="py-24 px-6" style={{ background: "var(--gradient-hero)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-display font-bold text-white mb-6">
              See Your Match Score in <span className="text-gradient-teal">30 Seconds</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-6 mb-10">
              {[
                { step: "1", title: "Upload Resume", icon: Upload },
                { step: "2", title: "See Match Score", icon: Target },
                { step: "3", title: "Get Matched Jobs", icon: Search },
              ].map((s) => (
                <div key={s.step} className="glass rounded-2xl p-6 border border-white/10 text-center">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-3">
                    <s.icon className="w-5 h-5 text-teal-400" />
                  </div>
                  <div className="text-white font-semibold">{s.title}</div>
                </div>
              ))}
            </div>
            <Button size="lg" className="gradient-teal text-white font-semibold text-lg px-10 py-6 rounded-xl shadow-teal hover:opacity-90 animate-pulse-glow" onClick={() => navigate("/auth")}>
              Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="text-white/40 text-sm mt-4">No credit card required. Free forever for basic features.</p>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-primary py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 gradient-teal rounded-md flex items-center justify-center">
                <Target className="w-3 h-3 text-white" />
              </div>
              <span className="font-display font-bold text-primary-foreground">FitCheck</span>
            </div>
            <div className="flex flex-wrap gap-4 text-primary-foreground/50 text-sm">
              <button className="hover:text-primary-foreground transition-colors" onClick={() => navigate("/job-seeker")}>Analyze</button>
              <button className="hover:text-primary-foreground transition-colors" onClick={() => navigate("/job-search")}>Find Jobs</button>
              <button className="hover:text-primary-foreground transition-colors" onClick={() => navigate("/applications")}>Track</button>
              <button className="hover:text-primary-foreground transition-colors" onClick={() => navigate("/auto-apply")}>Auto-Apply</button>
            </div>
          </div>
          <div className="border-t border-white/10 pt-4 text-center">
            <p className="text-primary-foreground/40 text-sm">We help you get interviews automatically. Built by Amir Jabri.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
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
