import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Users,
  Filter,
  Loader2,
  MapPin,
  Briefcase,
  Star,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { analyzeJobFit } from "@/lib/analysisEngine";
import { logger } from "@/lib/logger";

interface CandidateProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  skills: string[] | null;
  career_level: string | null;
  preferred_job_types: string[] | null;
  certifications: string[] | null;
  work_experience: any;
  education: any;
  fitScore?: number;
  fitSummary?: string;
}

export default function CandidatesDatabase() {
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI matching
  const [jobDescForMatch, setJobDescForMatch] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<CandidateProfile[]>([]);
  const [showMatcher, setShowMatcher] = useState(false);

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_seeker_profiles")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error("Failed to load candidates");
      logger.error(error.message);
    } else {
      setCandidates((data as unknown as CandidateProfile[]) || []);
    }
    setLoading(false);
  };

  const handleAIMatch = async () => {
    if (!jobDescForMatch.trim()) {
      toast.error("Please enter a job description to match against");
      return;
    }
    setMatching(true);
    try {
      const scored = candidates
        .filter((c) => c.skills?.length || c.summary)
        .map((c) => {
          const resumeText = [
            c.full_name,
            c.summary,
            c.skills?.join(", "),
            c.career_level,
            c.certifications?.join(", "),
          ]
            .filter(Boolean)
            .join("\n");

          const result = analyzeJobFit(jobDescForMatch, resumeText);
          return {
            ...c,
            fitScore: result.overallScore,
            fitSummary: result.summary,
          };
        })
        .sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));

      setMatchResults(scored);
      toast.success(`Matched ${scored.length} candidates by fit score`);
    } catch {
      toast.error("Matching failed");
    } finally {
      setMatching(false);
    }
  };

  const filtered = (matchResults.length > 0 ? matchResults : candidates).filter(
    (c) => {
      const q = searchQuery.toLowerCase();
      const nameMatch =
        !q ||
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q);
      const skillMatch =
        !skillFilter ||
        c.skills?.some((s) =>
          s.toLowerCase().includes(skillFilter.toLowerCase()),
        );
      const locMatch =
        !locationFilter ||
        c.location?.toLowerCase().includes(locationFilter.toLowerCase());
      const lvlMatch = levelFilter === "all" || c.career_level === levelFilter;
      return nameMatch && skillMatch && locMatch && lvlMatch;
    },
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">
            Candidates Database
          </h1>
          <p className="text-sm text-muted-foreground">
            {candidates.length} candidates in system
          </p>
        </div>
        <Button
          variant={showMatcher ? "default" : "outline"}
          onClick={() => setShowMatcher(!showMatcher)}
          className="gap-2"
        >
          <Sparkles className="w-4 h-4" />
          AI Match Finder
        </Button>
      </div>

      {/* AI Matcher Panel */}
      {showMatcher && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Find Best-Fit Candidates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Paste your job description here... AI will rank all candidates by fit score."
              value={jobDescForMatch}
              onChange={(e) => setJobDescForMatch(e.target.value)}
              className="h-32 resize-none"
            />
            <div className="flex items-center gap-3">
              <Button
                onClick={handleAIMatch}
                disabled={matching || !jobDescForMatch.trim()}
                className="gap-2"
              >
                {matching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {matching ? "Matching..." : "Find Best Candidates"}
              </Button>
              {matchResults.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMatchResults([])}
                >
                  Clear Results
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="Filter by skill..."
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          className="w-40"
        />
        <Input
          placeholder="Location..."
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="w-40"
        />
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Career Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="entry">Entry</SelectItem>
            <SelectItem value="mid">Mid</SelectItem>
            <SelectItem value="senior">Senior</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="executive">Executive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No candidates found matching your criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const expanded = expandedId === c.id;
            return (
              <Card
                key={c.id}
                className="hover:border-primary/30 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-primary truncate">
                          {c.full_name || "Unnamed Candidate"}
                        </h3>
                        {c.fitScore !== undefined && (
                          <Badge
                            variant={
                              c.fitScore >= 75
                                ? "default"
                                : c.fitScore >= 50
                                  ? "secondary"
                                  : "outline"
                            }
                            className="shrink-0"
                          >
                            <Star className="w-3 h-3 mr-1" />
                            {c.fitScore}% Fit
                          </Badge>
                        )}
                        {c.career_level && (
                          <Badge
                            variant="outline"
                            className="capitalize shrink-0"
                          >
                            {c.career_level}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                        {c.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {c.location}
                          </span>
                        )}
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </span>
                        )}
                      </div>
                      {c.skills && c.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {c.skills
                            .slice(0, expanded ? undefined : 6)
                            .map((s) => (
                              <Badge
                                key={s}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {s}
                              </Badge>
                            ))}
                          {!expanded && c.skills.length > 6 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              +{c.skills.length - 6}
                            </Badge>
                          )}
                        </div>
                      )}
                      {c.fitSummary && (
                        <p className="text-xs text-muted-foreground italic">
                          {c.fitSummary}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                    >
                      {expanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {expanded && (
                    <div className="mt-4 pt-4 border-t border-border space-y-3 text-sm">
                      {c.summary && (
                        <div>
                          <p className="font-medium text-xs text-muted-foreground mb-1">
                            Summary
                          </p>
                          <p className="text-foreground">{c.summary}</p>
                        </div>
                      )}
                      {c.certifications && c.certifications.length > 0 && (
                        <div>
                          <p className="font-medium text-xs text-muted-foreground mb-1">
                            Certifications
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {c.certifications.map((cert) => (
                              <Badge key={cert} variant="outline">
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(c.work_experience) &&
                        c.work_experience.length > 0 && (
                          <div>
                            <p className="font-medium text-xs text-muted-foreground mb-1">
                              Experience
                            </p>
                            {(
                              c.work_experience as Array<{
                                title?: string;
                                company?: string;
                                startDate?: string;
                                endDate?: string;
                              }>
                            ).map((w, i) => (
                              <div key={i} className="mb-2">
                                <p className="font-medium">
                                  {w.title} at {w.company}
                                </p>
                                {w.startDate && (
                                  <p className="text-xs text-muted-foreground">
                                    {w.startDate} – {w.endDate || "Present"}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
