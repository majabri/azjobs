import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Users, CheckCircle, TrendingUp, Zap, LogOut, Play, BarChart3 } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const stats = [
  { value: "3x", label: "more interview callbacks with ATS-optimized resumes" },
  { value: "< 30s", label: "to get your fit score and personalized action plan" },
  { value: "89%", label: "of users improve their match score on the first try" },
];

const features = [
  { icon: Zap, title: "Upload & Analyze Instantly", desc: "Drop your resume (PDF or Word) and any job link — get a fit score, skill gaps, and action plan in seconds." },
  { icon: TrendingUp, title: "AI Resume Optimization", desc: "One click generates an ATS-friendly resume tailored to the exact role. Download as PDF, Word, or plain text." },
  { icon: CheckCircle, title: "Track Every Application", desc: "Save your analyses, compare scores, and never lose track of where you applied or what to improve." },
];

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-primary/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gradient-teal rounded-lg flex items-center justify-center shadow-teal">
            <Target className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold text-primary-foreground">FitCheck</span>
        </div>
        <nav className="flex items-center gap-4">
          <Button
            variant="ghost"
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            onClick={() => navigate("/job-seeker")}
          >
            Job Seekers
          </Button>
          <Button
            variant="ghost"
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            onClick={() => navigate("/hiring-manager")}
          >
            Hiring Managers
          </Button>
          {user && (
            <Button
              variant="ghost"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              onClick={() => navigate("/dashboard")}
            >
              <BarChart3 className="w-4 h-4 mr-1" /> Dashboard
            </Button>
          )}
          {user ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              onClick={async () => { await supabase.auth.signOut(); setUser(null); }}
            >
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
          ) : (
            <Button
              size="sm"
              className="gradient-teal text-white font-semibold shadow-teal hover:opacity-90"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-900/90 via-navy-800/80 to-navy-900/95" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-teal-500/30 text-teal-400 text-sm font-medium mb-8 animate-fade-up">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Resume Intelligence
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 animate-fade-up leading-tight" style={{ animationDelay: "0.1s" }}>
            Get More Interviews.
            <br />
            <span className="text-gradient-teal">Automatically.</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto mb-12 animate-fade-up leading-relaxed" style={{ animationDelay: "0.2s" }}>
            Upload your resume, paste any job description, and instantly get your fit score,
            an AI-optimized resume, and a step-by-step plan to land the role.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button
              size="lg"
              className="gradient-teal text-white font-semibold text-lg px-8 py-6 rounded-xl shadow-teal hover:opacity-90 transition-opacity animate-pulse-glow"
              onClick={() => navigate("/job-seeker")}
            >
              Optimize My Resume
              <ArrowRight className="ml-2 w-5 h-5" />
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

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 animate-fade-up" style={{ animationDelay: "0.4s" }}>
            {stats.map((stat) => (
              <div key={stat.value} className="glass rounded-2xl p-6 border border-white/10">
                <div className="text-3xl font-display font-bold text-teal-400 mb-2">{stat.value}</div>
                <div className="text-white/60 text-sm leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40 text-xs animate-bounce">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/30" />
          scroll
        </div>
      </section>

      {/* Features */}
      <section className="bg-background py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-primary mb-4">
              From resume upload to <span className="text-gradient-teal">interview-ready</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Stop wasting time on applications that go nowhere. FitCheck shows you exactly where you stand and gives you the tools to improve.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="bg-card rounded-2xl p-8 shadow-card border border-border hover:shadow-elevated transition-shadow"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-12 h-12 gradient-teal rounded-xl flex items-center justify-center mb-6 shadow-teal">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-primary mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
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
              <h3 className="font-display text-2xl font-bold text-white mb-3">Job Seekers</h3>
              <p className="text-white/70 mb-8 leading-relaxed">
                Upload your resume, get your fit score, and let AI optimize your resume for ATS — all in under a minute.
              </p>
              <div className="flex items-center gap-2 text-teal-400 font-semibold">
                Start optimizing <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
                Define your role requirements, add candidate profiles, and instantly see who's qualified — and exactly where others fall short.
              </p>
              <div className="flex items-center gap-2 text-accent font-semibold">
                Screen my candidates <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 gradient-teal rounded-md flex items-center justify-center">
            <Target className="w-3 h-3 text-white" />
          </div>
          <span className="font-display font-bold text-primary-foreground">FitCheck</span>
        </div>
        <p className="text-primary-foreground/50 text-sm">Built by Amir Jabri · POC v0.1</p>
      </footer>
    </div>
  );
}
