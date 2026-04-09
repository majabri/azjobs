/**
 * Gig Marketplace — Shared types
 */

export interface Project {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  budget_min: number | null;
  budget_max: number | null;
  timeline_days: number | null;
  skills_required: string[];
  deliverables: string[];
  status: string;
  proposals_count: number;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  project_id: string;
  talent_id: string;
  price: number;
  timeline_days: number | null;
  cover_message: string;
  portfolio_links: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  project_id: string;
  proposal_id: string;
  employer_id: string;
  talent_id: string;
  agreed_price: number;
  agreed_timeline_days: number | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  contract_id: string;
  title: string;
  description: string;
  amount: number;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PROJECT_STATUS_CONFIG: Record<string, { class: string; label: string }> = {
  open: { class: "bg-success/10 text-success", label: "Open" },
  in_progress: { class: "bg-primary/10 text-primary", label: "In Progress" },
  completed: { class: "bg-muted text-muted-foreground", label: "Completed" },
  closed: { class: "bg-destructive/10 text-destructive", label: "Closed" },
};

export const PROPOSAL_STATUS_CONFIG: Record<string, { class: string; label: string }> = {
  pending: { class: "bg-warning/10 text-warning", label: "Pending" },
  accepted: { class: "bg-success/10 text-success", label: "Accepted" },
  rejected: { class: "bg-destructive/10 text-destructive", label: "Rejected" },
  withdrawn: { class: "bg-muted text-muted-foreground", label: "Withdrawn" },
};

export const MILESTONE_STATUS_CONFIG: Record<string, { class: string; label: string }> = {
  pending: { class: "bg-muted text-muted-foreground", label: "Pending" },
  in_progress: { class: "bg-primary/10 text-primary", label: "In Progress" },
  completed: { class: "bg-success/10 text-success", label: "Completed" },
  reviewed: { class: "bg-accent text-accent-foreground", label: "Reviewed" },
};
