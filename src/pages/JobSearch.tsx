import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Search,
  Loader2,
  MapPin,
  Building2,
  ExternalLink,
  Target,
  Briefcase,
  Globe,
  Plus,
  X,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";

interface JobResult {
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  url: string;
  matchReason: string;
}

const JOB_TYPE_OPTIONS = [
  "remote", "hybrid", "in-office", "full-time", "part-time", "contract", "short-term",
];

export default function JobSearchPage() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<string[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [careerLevel, setCareerLevel] = useState("");
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [citations, setCitations] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("job_seeker_profiles")
        .select("skills, preferred_job_types, location, career_level, target_job_titles, salary_min, salary_max")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) {
        if (data.skills) setSkills(data.skills as string[]);
        if ((data as any).preferred_job_types) setJobTypes((data as any).preferred_job_types as string[]);
        if (data.location) setLocation(data.location);
        if ((data as any).career_level) setCareerLevel((data as any).career_level);
        if ((data as any).target_job_titles) setTargetTitles((data as any).target_job_titles as string[]);
        if ((data as any).salary_min) setSalaryMin((data as any).salary_min);
        if ((data as any).salary_max) setSalaryMax((data as any).salary_max);
        setProfileLoaded(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleJobType = (type: string) => {
    setJobTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSearch = async () => {
    if (!skills.length && !customQuery.trim()) {
      toast.error("Add skills to your profile or enter a search query");
      return;
    }
    setSearching(true);
    setJobs([]);
    setCitations([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error("Please sign in"); return; }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-jobs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ skills, jobTypes, location, query: customQuery, careerLevel, targetTitles }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Search failed" }));
        toast.error(err.error || "Search failed");
        return;
      }

      const data = await resp.json();
      setJobs(data.jobs || []);
      setCitations(data.citations || []);
      if (!data.jobs?.length) toast.info("No jobs found. Try adjusting your search criteria.");
    } catch {
      toast.error("Failed to search for jobs");
    } finally {
      setSearching(false);
    }
  };

  const handleAnalyzeFit = (job: JobResult) => {
    const jobDesc = `${job.title} at ${job.company}\nLocation: ${job.location}\nType: ${job.type}\n\n${job.description}`;
    navigate("/job-seeker", { state: { prefillJob: jobDesc } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 gradient-teal rounded-lg flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-bold text-primary">Job Search</span>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-primary mb-3">
            Jobs that <span className="text-gradient-teal">get you interviews</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            AI finds the best opportunities and shows your interview probability for each one.
          </p>
        </div>

        {/* Search Controls */}
        <Card className="p-6 mb-8">
          <div className="space-y-4">
            {/* Target Titles (editable) */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Target Job Titles</label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = titleInput.trim();
                      if (t && !targetTitles.includes(t)) {
                        setTargetTitles([...targetTitles, t]);
                        setTitleInput("");
                      }
                    }
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => {
                  const t = titleInput.trim();
                  if (t && !targetTitles.includes(t)) {
                    setTargetTitles([...targetTitles, t]);
                    setTitleInput("");
                  }
                }}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {targetTitles.map((t, i) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setTargetTitles(targetTitles.filter((_, idx) => idx !== i))}>
                    {t} <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Career Level */}
            {careerLevel && (
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Career Level</label>
                <Badge variant="default" className="bg-accent text-accent-foreground">{careerLevel}</Badge>
              </div>
            )}

            {/* Skills */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Your Skills</label>
              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => (
                    <Badge key={i} variant="secondary">{s}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No skills loaded.{" "}
                  <button className="text-accent hover:underline" onClick={() => navigate("/profile")}>
                    Add skills to your profile
                  </button>
                </p>
              )}
            </div>

            {/* Job Type Preferences */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Job Type</label>
              <div className="flex flex-wrap gap-2">
                {JOB_TYPE_OPTIONS.map((type) => (
                  <Badge
                    key={type}
                    variant={jobTypes.includes(type) ? "default" : "outline"}
                    className={`cursor-pointer capitalize ${
                      jobTypes.includes(type)
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent/10"
                    }`}
                    onClick={() => toggleJobType(type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Location & Query */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Location</label>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, State or Remote"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Additional Criteria</label>
                <Input
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="e.g. startup, Fortune 500, healthcare..."
                />
              </div>
            </div>

            {/* Salary Range */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Min Salary</label>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="80,000" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Max Salary</label>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Input value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="150,000" />
                </div>
              </div>
            </div>

              className="gradient-teal text-white shadow-teal hover:opacity-90 w-full sm:w-auto"
              disabled={searching}
              onClick={handleSearch}
            >
              {searching ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" /> Search Jobs</>
              )}
            </Button>
          </div>
        </Card>

        {/* Results */}
        {jobs.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-display font-bold text-primary text-xl">
              {jobs.length} Jobs Found
            </h2>
            {jobs.map((job, i) => (
              <Card key={i} className="p-5 hover:border-accent/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" /> {job.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {job.location}
                      </span>
                      {job.type && (
                        <Badge variant="outline" className="capitalize text-xs">
                          <Briefcase className="w-3 h-3 mr-1" /> {job.type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{job.description}</p>
                    {job.matchReason && (
                      <p className="text-xs text-accent mt-2 italic">💡 {job.matchReason}</p>
                    )}
                  </div>
                  <div className="flex sm:flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="gradient-teal text-white text-xs"
                      onClick={() => handleAnalyzeFit(job)}
                    >
                      <Target className="w-3.5 h-3.5 mr-1" /> Check My Chances
                    </Button>
                    {job.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => window.open(job.url, "_blank")}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Apply
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {citations.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Sources:</p>
                <div className="flex flex-wrap gap-2">
                  {citations.map((c, i) => (
                    <a
                      key={i}
                      href={c}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline truncate max-w-xs"
                    >
                      [{i + 1}] {c}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!searching && jobs.length === 0 && profileLoaded && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Click "Search Jobs" to find matching opportunities</p>
          </div>
        )}
      </main>
    </div>
  );
}
