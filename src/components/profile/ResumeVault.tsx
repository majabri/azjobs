import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Save, Edit2, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

interface ResumeVersion {
  id?: string;
  version_name: string;
  job_type: string;
  resume_text: string;
}

export default function ResumeVault() {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [newVersion, setNewVersion] = useState<ResumeVersion>({ version_name: "", job_type: "", resume_text: "" });
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadVersions(); }, []);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.from("resume_versions").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
      if (error) {
        logger.error("ResumeVault: failed to load resume versions:", error);
        toast.error("Could not load resume versions. Please refresh and try again.");
        return;
      }
      setVersions((data as any[])?.map((v: any) => ({ id: v.id, version_name: v.version_name, job_type: v.job_type || "", resume_text: v.resume_text })) || []);
    } finally {
      setIsLoading(false);
    }
  };

  const saveVersion = async (version: ResumeVersion) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      if (version.id) {
        await supabase.from("resume_versions").update({ version_name: version.version_name, job_type: version.job_type || null, resume_text: version.resume_text, updated_at: new Date().toISOString() } as any).eq("id", version.id);
      } else {
        await supabase.from("resume_versions").insert({ user_id: session.user.id, version_name: version.version_name, job_type: version.job_type || null, resume_text: version.resume_text } as any);
      }
      toast.success("Resume version saved!");
      loadVersions();
      setShowNewVersion(false);
      setEditingVersion(null);
    } catch { toast.error("Failed to save"); }
  };

  const deleteVersion = async (id: string) => {
    await supabase.from("resume_versions").delete().eq("id", id);
    toast.success("Version deleted");
    loadVersions();
  };

  return (
    <section>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><FileText className="w-4 h-4 text-primary" /> Resume Versions</h2>
      <p className="text-sm text-muted-foreground mb-4">Create different versions tailored for different job types. Your latest version auto-loads in the Analyze tool.</p>
      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading resume versions…</p>}
        {!isLoading && versions.length === 0 && !showNewVersion && (
          <p className="text-sm text-muted-foreground py-2">No resume versions yet. Click "Add Resume Version" below to get started.</p>
        )}
        {versions.map((v, i) => (
          <Card key={v.id || i} className="p-4">
            {editingVersion === i ? (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>Version Name</Label><Input value={v.version_name} onChange={e => { const u = [...versions]; u[i] = { ...u[i], version_name: e.target.value }; setVersions(u); }} /></div>
                  <div><Label>Job Type</Label><Input value={v.job_type} onChange={e => { const u = [...versions]; u[i] = { ...u[i], job_type: e.target.value }; setVersions(u); }} placeholder="e.g. remote, technical" /></div>
                </div>
                <div><Label>Resume Text</Label><Textarea value={v.resume_text} onChange={e => { const u = [...versions]; u[i] = { ...u[i], resume_text: e.target.value }; setVersions(u); }} rows={6} /></div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveVersion(v)}><Save className="w-3.5 h-3.5 mr-1" /> Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditingVersion(null); loadVersions(); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2"><span className="font-medium text-foreground">{v.version_name}</span>{v.job_type && <Badge variant="outline" className="text-xs capitalize">{v.job_type}</Badge>}</div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.resume_text.slice(0, 150)}...</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditingVersion(i)}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => v.id && deleteVersion(v.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
      {showNewVersion ? (
        <Card className="p-4 mt-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Version Name</Label><Input value={newVersion.version_name} onChange={e => setNewVersion({ ...newVersion, version_name: e.target.value })} placeholder="e.g. Technical, Management" /></div>
            <div><Label>Job Type</Label><Input value={newVersion.job_type} onChange={e => setNewVersion({ ...newVersion, job_type: e.target.value })} placeholder="e.g. remote, full-time" /></div>
          </div>
          <div><Label>Resume Text</Label><Textarea value={newVersion.resume_text} onChange={e => setNewVersion({ ...newVersion, resume_text: e.target.value })} rows={6} placeholder="Paste or write resume here..." /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveVersion(newVersion)} disabled={!newVersion.version_name.trim()}><Save className="w-3.5 h-3.5 mr-1" /> Save</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowNewVersion(false); setNewVersion({ version_name: "", job_type: "", resume_text: "" }); }}>Cancel</Button>
          </div>
        </Card>
      ) : (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowNewVersion(true)}><Plus className="w-4 h-4 mr-1" /> Add Resume Version</Button>
      )}
    </section>
  );
}
