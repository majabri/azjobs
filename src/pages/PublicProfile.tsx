import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, User, Briefcase, GraduationCap, Award, ExternalLink, MapPin, Globe, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProfilePdfExport from "@/components/ProfilePdfExport";

interface PortfolioItem {
  id: string;
  item_type: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  display_order: number;
}

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (userId) loadPublicProfile();
  }, [userId]);

  const loadPublicProfile = async () => {
    try {
      const { data: p, error } = await supabase
        .from("job_seeker_profiles")
        .select("full_name, summary, skills, work_experience, education, certifications, location, career_level, email, phone")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error || !p) { setNotFound(true); return; }
      setProfile(p);

      const { data: items } = await supabase
        .from("user_portfolio_items" as any)
        .select("*")
        .eq("user_id", userId!)
        .order("display_order", { ascending: true }) as any;
      setPortfolio(items || []);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (notFound) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-primary mb-2">Profile Not Found</h1>
        <p className="text-muted-foreground">This profile doesn't exist or isn't public.</p>
      </div>
    </div>
  );

  const experience = (profile.work_experience as any[]) || [];
  const education = (profile.education as any[]) || [];
  const skills = (profile.skills as string[]) || [];
  const certs = (profile.certifications as string[]) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-accent" />
          </div>
          <h1 className="font-display text-3xl font-bold text-primary">{profile.full_name || "Professional"}</h1>
          {profile.career_level && <Badge className="mt-2 bg-accent/10 text-accent border-accent/20">{profile.career_level}</Badge>}
          {profile.location && <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1"><MapPin className="w-3 h-3" />{profile.location}</p>}
        </div>

        {/* Summary */}
        {profile.summary && (
          <Card className="p-6">
            <p className="text-foreground leading-relaxed">{profile.summary}</p>
          </Card>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-primary text-lg mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">{skills.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}</div>
          </div>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-primary text-lg mb-3 flex items-center gap-2"><Briefcase className="w-5 h-5" /> Experience</h2>
            <div className="space-y-4">
              {experience.map((exp: any, i) => (
                <Card key={i} className="p-4">
                  <h3 className="font-semibold text-foreground">{exp.title}</h3>
                  <p className="text-sm text-muted-foreground">{exp.company} · {exp.startDate} – {exp.endDate || "Present"}</p>
                  {exp.description && <p className="text-sm text-foreground mt-2">{exp.description}</p>}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {education.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-primary text-lg mb-3 flex items-center gap-2"><GraduationCap className="w-5 h-5" /> Education</h2>
            <div className="space-y-3">
              {education.map((edu: any, i) => (
                <Card key={i} className="p-4">
                  <h3 className="font-semibold text-foreground">{edu.degree}</h3>
                  <p className="text-sm text-muted-foreground">{edu.institution}{edu.year ? ` · ${edu.year}` : ""}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-primary text-lg mb-3 flex items-center gap-2"><Award className="w-5 h-5" /> Certifications</h2>
            <div className="flex flex-wrap gap-2">{certs.map((c, i) => <Badge key={i} variant="outline">{c}</Badge>)}</div>
          </div>
        )}

        {/* Portfolio */}
        {portfolio.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-primary text-lg mb-3 flex items-center gap-2"><Globe className="w-5 h-5" /> Portfolio</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {portfolio.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Badge variant="outline" className="text-[10px] mb-1">{item.item_type}</Badge>
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                    </div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80"><ExternalLink className="w-4 h-4" /></a>
                    )}
                  </div>
                  {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                  {item.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">{item.tags.map((t, j) => <Badge key={j} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground">Powered by FitCheck</p>
        </div>
      </div>
    </div>
  );
}
