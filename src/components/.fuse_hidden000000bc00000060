import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Trash2, Loader2, X } from "lucide-react";
import { parseDocument } from "@/lib/api/parseDocument";
import { toast } from "sonner";

export interface ParsedResume {
  id: string;
  name: string;
  resumeText: string;
  fileName: string;
}

interface BulkResumeUploadProps {
  onResumesReady: (resumes: ParsedResume[]) => void;
}

export default function BulkResumeUpload({ onResumesReady }: BulkResumeUploadProps) {
  const [files, setFiles] = useState<ParsedResume[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newFiles = Array.from(fileList);
    const totalAfter = files.length + newFiles.length;
    if (totalAfter > 20) {
      toast.error("Maximum 20 resumes allowed");
      return;
    }

    setIsProcessing(true);
    const parsed: ParsedResume[] = [];

    for (const file of newFiles) {
      try {
        const result = await parseDocument(file);
        if (result.success && result.text) {
          // Try to extract name from first line of resume
          const firstLine = result.text.split("\n").find((l) => l.trim())?.trim() || "";
          const candidateName = firstLine.length > 3 && firstLine.length < 60 ? firstLine : file.name.replace(/\.[^.]+$/, "");

          parsed.push({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: candidateName,
            resumeText: result.text,
            fileName: file.name,
          });
        } else {
          toast.error(`Failed to parse ${file.name}: ${result.error}`);
        }
      } catch {
        toast.error(`Error processing ${file.name}`);
      }
    }

    if (parsed.length > 0) {
      const updated = [...files, ...parsed];
      setFiles(updated);
      onResumesReady(updated);
      toast.success(`${parsed.length} resume(s) parsed successfully`);
    }
    setIsProcessing(false);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    const updated = files.filter((f) => f.id !== id);
    setFiles(updated);
    onResumesReady(updated);
  };

  const updateName = (id: string, name: string) => {
    const updated = files.map((f) => (f.id === id ? { ...f, name } : f));
    setFiles(updated);
    onResumesReady(updated);
  };

  const clearAll = () => {
    setFiles([]);
    onResumesReady([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-primary">
          Upload Resumes ({files.length}/20)
        </label>
        {files.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground">
            <X className="w-3 h-3 mr-1" /> Clear All
          </Button>
        )}
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-accent/50 transition-colors cursor-pointer bg-muted/20"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-accent"); }}
        onDragLeave={(e) => { e.currentTarget.classList.remove("border-accent"); }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-accent");
          handleFilesSelected(e.dataTransfer.files);
        }}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-sm font-medium">Processing resumes…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="w-8 h-8" />
            <p className="text-sm font-medium">
              Drop PDF or Word files here, or <span className="text-accent">browse</span>
            </p>
            <p className="text-xs">Select multiple files at once • Max 20 resumes</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {files.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2 bg-card rounded-lg border border-border p-3">
              <div className="w-6 h-6 gradient-indigo rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {i + 1}
              </div>
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <Input
                  value={f.name}
                  onChange={(e) => updateName(f.id, e.target.value)}
                  className="h-7 text-sm font-medium"
                  placeholder="Candidate name"
                />
                <p className="text-xs text-muted-foreground truncate">{f.fileName}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(f.id)}
                className="text-muted-foreground hover:text-destructive h-7 w-7 p-0 flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
