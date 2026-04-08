export interface ServiceCatalog {
  id: string;
  seller_id: string;
  title: string;
  category: string;
  headline: string;
  description: string;
  image_url: string | null;
  turnaround_days: number;
  status: string;
  rating_avg: number;
  rating_count: number;
  orders_count: number;
  created_at: string;
  updated_at: string;
}

export interface ServicePackage {
  id: string;
  service_id: string;
  tier: "basic" | "standard" | "premium";
  name: string;
  description: string;
  price: number;
  delivery_days: number;
  features: string[];
  created_at: string;
}

export interface CatalogOrder {
  id: string;
  buyer_id: string;
  seller_id: string;
  service_id: string;
  package_id: string;
  price: number;
  status: string;
  delivery_deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  service?: ServiceCatalog;
  package?: ServicePackage;
}

export interface ServiceReview {
  id: string;
  order_id: string;
  service_id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export const SERVICE_CATEGORIES = [
  "Resume Writing",
  "Career Coaching",
  "Interview Prep",
  "LinkedIn Optimization",
  "Cover Letter Writing",
  "Portfolio Review",
  "Salary Negotiation",
  "Job Search Strategy",
  "Skills Assessment",
  "Other",
] as const;

export const TURNAROUND_OPTIONS = [
  { label: "1 day", value: 1 },
  { label: "3 days", value: 3 },
  { label: "5 days", value: 5 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
] as const;
