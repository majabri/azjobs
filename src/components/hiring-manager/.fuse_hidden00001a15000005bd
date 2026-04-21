import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, DollarSign, Briefcase, Clock, Award } from "lucide-react";

interface PreviewData {
  title: string;
  company: string;
  description: string;
  salaryMin: string;
  salaryMax: string;
  remoteType: string;
  skills: string[];
  experienceLevel: string;
  benefits: string[];
  location: string;
  jobType: string;
}

export default function JobPostingPreview({ data }: { data: PreviewData }) {
  const hasSalary = data.salaryMin || data.salaryMax;

  return (
    <Card className="sticky top-6 border-primary/20">
      <CardHeader className="pb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Candidate Preview
        </p>
        <CardTitle className="text-xl text-primary">
          {data.title || "Job Title"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {data.company || "Company Name"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Meta badges */}
        <div className="flex flex-wrap gap-2">
          {data.remoteType && (
            <Badge variant="outline" className="gap-1 capitalize">
              <MapPin className="w-3 h-3" /> {data.remoteType}
            </Badge>
          )}
          {data.jobType && (
            <Badge variant="outline" className="gap-1 capitalize">
              <Clock className="w-3 h-3" /> {data.jobType}
            </Badge>
          )}
          {data.experienceLevel && (
            <Badge variant="outline" className="gap-1 capitalize">
              <Award className="w-3 h-3" /> {data.experienceLevel}
            </Badge>
          )}
          {hasSalary && (
            <Badge variant="outline" className="gap-1">
              <DollarSign className="w-3 h-3" />
              {data.salaryMin ? `$${Number(data.salaryMin).toLocaleString()}` : ""}
              {data.salaryMin && data.salaryMax ? " – " : ""}
              {data.salaryMax ? `$${Number(data.salaryMax).toLocaleString()}` : ""}
            </Badge>
          )}
        </div>

        {/* Description */}
        {data.description && (
          <div>
            <h4 className="font-medium mb-1 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" /> About the Role
            </h4>
            <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {data.description}
            </p>
          </div>
        )}

        {/* Skills */}
        {data.skills.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Required Skills</h4>
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Benefits */}
        {data.benefits.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Benefits</h4>
            <ul className="space-y-1 text-muted-foreground">
              {data.benefits.map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!data.title && !data.description && (
          <p className="text-muted-foreground text-center py-6 italic">
            Fill in the form to see a live preview
          </p>
        )}
      </CardContent>
    </Card>
  );
}
