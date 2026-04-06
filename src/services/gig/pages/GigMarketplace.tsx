/**
 * Gig Marketplace — Browse & Create gigs
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, DollarSign, Briefcase, Clock } from "lucide-react";
import { toast } from "sonner";
import { fetchOpenGigs, createGig, type Gig } from "@/services/gig/api";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

export default function GigMarketplace() {
  const { enabled, loading: flagLoading } = useFeatureFlag("gig_marketplace");
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "general", budget_min: "", budget_max: "", skills: "" });

  useEffect(() => {
    if (enabled) loadGigs();
  }, [enabled]);

  const loadGigs = async () => {
    setLoading(true);
    const data = await fetchOpenGigs();
    setGigs(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setCreating(true);
    const result = await createGig({
      title: form.title,
      description: form.description,
      category: form.category,
      skills_required: form.skills.split(",").map(s => s.trim()).filter(Boolean),
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
    });
    if (result) {
      toast.success("Gig posted!");
      setForm({ title: "", description: "", category: "general", budget_min: "", budget_max: "", skills: "" });
      loadGigs();
    } else {
      toast.error("Failed to create gig");
    }
    setCreating(false);
  };

  if (flagLoading) return null;
  if (!enabled) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h1 className="text-2xl font-bold text-foreground">Gig Marketplace</h1>
        <p className="text-muted-foreground mt-2">This feature is currently disabled by the administrator.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Gig Marketplace</h1>
          <p className="text-muted-foreground text-sm mt-1">Browse freelance opportunities or post your own</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1.5" /> Post a Gig</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post a New Gig</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Gig title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <Textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
              <Input placeholder="Skills (comma-separated)" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Min budget ($)" type="number" value={form.budget_min} onChange={e => setForm({ ...form, budget_min: e.target.value })} />
                <Input placeholder="Max budget ($)" type="number" value={form.budget_max} onChange={e => setForm({ ...form, budget_max: e.target.value })} />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={creating}>
                {creating ? "Posting…" : "Post Gig"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-32">
          <Clock className="w-5 h-5 animate-spin text-accent" />
        </div>
      ) : gigs.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No gigs posted yet. Be the first!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gigs.map(gig => (
            <Card key={gig.id} className="border-border hover:bg-muted/20 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{gig.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{gig.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {gig.skills_required.slice(0, 5).map(skill => (
                    <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {(gig.budget_min || gig.budget_max) && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {gig.budget_min && gig.budget_max
                        ? `$${gig.budget_min} – $${gig.budget_max}`
                        : gig.budget_max ? `Up to $${gig.budget_max}` : `From $${gig.budget_min}`}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {gig.location || "Remote"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{gig.category}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
