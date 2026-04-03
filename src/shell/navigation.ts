/**
 * Shell Navigation — Centralized navigation configuration.
 * Sidebar links point ONLY to top-level service routes.
 * No internal component or page references.
 */

import {
  LayoutDashboard, Search, ClipboardList, UserCircle, Target,
  DollarSign, Compass, Mic, Zap, HelpCircle, Settings,
  Users, Database, FileText, Calendar,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
}

export const jobSeekerNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analyze Job", url: "/job-seeker", icon: Target },
  { title: "Find Jobs", url: "/job-search", icon: Search },
  { title: "Applications", url: "/applications", icon: ClipboardList },
  { title: "Offers", url: "/offers", icon: DollarSign },
  { title: "Career", url: "/career", icon: Compass },
  { title: "Interview Prep", url: "/interview-prep", icon: Mic },
  { title: "Auto Apply", url: "/auto-apply", icon: Zap },
  { title: "Profile", url: "/profile", icon: UserCircle },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Support", url: "/support", icon: HelpCircle },
];

export const hiringManagerNav: NavItem[] = [
  { title: "Candidate Screener", url: "/hiring-manager", icon: Users },
  { title: "Candidates Database", url: "/candidates", icon: Database },
  { title: "Job Postings", url: "/job-postings", icon: FileText },
  { title: "Interview Scheduling", url: "/interview-scheduling", icon: Calendar },
];

export const modes = [
  { label: "Job Seeker", icon: Target, value: "seeker" as const },
  { label: "Hiring Manager", icon: Users, value: "hiring" as const },
] as const;

export type AppMode = typeof modes[number]["value"];

export const hiringPaths = ["/hiring-manager", "/candidates", "/job-postings", "/interview-scheduling"];

export function detectMode(pathname: string): AppMode {
  return hiringPaths.some(p => pathname.startsWith(p)) ? "hiring" : "seeker";
}

export function getNavItems(mode: AppMode): NavItem[] {
  return mode === "hiring" ? hiringManagerNav : jobSeekerNav;
}
