/**
 * Gig Service — Types
 */

export interface Gig {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  skills_required: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_type: string;
  location: string;
  is_remote: boolean;
  status: string;
  applications_count: number;
  created_at: string;
}

export interface GigBid {
  id: string;
  gig_id: string;
  bidder_id: string;
  amount: number;
  message: string;
  status: string;
  created_at: string;
}

export interface GigContract {
  id: string;
  gig_id: string;
  client_id: string;
  freelancer_id: string;
  amount: number;
  status: string;
  milestones: any[];
  started_at: string;
  completed_at: string | null;
}

export interface GigReview {
  id: string;
  contract_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string;
  created_at: string;
}
