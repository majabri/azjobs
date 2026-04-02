/**
 * Resume Service — Types
 */

export interface ResumeVersion {
  id: string;
  version_name: string;
  resume_text: string;
  job_type: string | null;
  created_at: string;
  updated_at: string;
}
