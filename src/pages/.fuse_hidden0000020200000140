import { useState } from "react";
import JobPostingForm, { type JobPostingFormData } from "@/components/hiring-manager/JobPostingForm";
import JobPostingList from "@/components/hiring-manager/JobPostingList";

export default function JobPostings() {
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<JobPostingFormData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const openNew = () => { setEditing(null); setMode("form"); };
  const openEdit = (data: JobPostingFormData) => { setEditing(data); setMode("form"); };
  const handleSaved = () => { setMode("list"); setEditing(null); setRefreshKey((k) => k + 1); };
  const handleCancel = () => { setMode("list"); setEditing(null); };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-primary">Job Postings</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "form"
            ? editing ? "Edit your job posting" : "Create a new job posting"
            : "Create and manage your job postings"}
        </p>
      </div>

      {mode === "list" ? (
        <JobPostingList onEdit={openEdit} onNew={openNew} refreshKey={refreshKey} />
      ) : (
        <JobPostingForm editing={editing} onSaved={handleSaved} onCancel={handleCancel} />
      )}
    </div>
  );
}
