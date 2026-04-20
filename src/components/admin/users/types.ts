export type AdminView = "job_seekers" | "hiring_managers" | "admins";

export interface JobSeekerRecord {
  user_id: string;
  full_name: string | null;
  email: string | null;
  last_active_at: string | null;
  automation_mode: string;
  skills: string[] | null;
  role: string;
  application_count: number;
  analysis_count: number;
}

export interface HiringManagerRecord {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  job_posting_count: number;
  interview_count: number;
  candidates_matched: number;
  latest_posting_at: string | null;
}

export interface AdminRecord {
  user_id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  created_at: string | null;
}

export type UserRef = { user_id: string; email: string | null; full_name: string | null };
