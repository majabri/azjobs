/**
 * Support Service — Type definitions.
 * No cross-service imports.
 */

export type RequestType =
  | "bug_report"
  | "enhancement_request"
  | "general_feedback"
  | "feature_request"
  | "account_billing"
  | "data_issue"
  | "account_issue";

export type Priority = "low" | "medium" | "high";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface SupportTicket {
  id: string;
  user_id: string;
  ticket_number: string;
  request_type: RequestType;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  email: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CreateTicketPayload {
  request_type: RequestType;
  title: string;
  description: string;
  priority: Priority;
  email?: string;
}

export type FaqAudience = "all" | "job_seeker" | "recruiter" | "admin";

export interface FaqEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  display_order: number;
  is_published: boolean;
  audience: FaqAudience;
}

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  bug_report: "Bug Report",
  enhancement_request: "Enhancement Request",
  general_feedback: "General Feedback",
  feature_request: "Feature Request",
  account_billing: "Account / Billing Issue",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};
