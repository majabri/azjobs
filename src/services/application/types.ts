/**
 * Application Service — Types
 */

export interface JobApplication {
  id: string;
  job_title: string;
  company: string;
  job_url: string | null;
  status: string;
  notes: string | null;
  applied_at: string;
  updated_at: string;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  followed_up: boolean;
}

export interface Offer {
  id: string;
  job_title: string;
  company: string;
  base_salary: number | null;
  bonus: number | null;
  equity: number | null;
  total_comp: number | null;
  market_rate: number | null;
  status: string;
  notes: string | null;
  negotiation_strategy: any;
  created_at: string;
  updated_at: string;
  deadline: string | null;
}
