/**
 * Shell Navigation — Centralized navigation configuration.
 * Sidebar links point ONLY to top-level service routes.
 * No internal component or page references.
 */

import {
  LayoutDashboard, Search, ClipboardList, UserCircle, Target,
  DollarSign, Compass, Mic, Zap, HelpCircle, Settings,
  Users, Database, FileText, Calendar, Briefcase,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
}

export const jobSeekerNav: NavItem[] = [
  { title: "Mission Control", url: "/dashboard", icon: LayoutDashboard },
  { title: "Match Score Lab", url: "/job-seeker", icon: Target },
  { title: "Opportunity Radar", url: "/job-search", icon: Search },
  { title: "Pipeline", url: "/applications", icon: ClipboardList },
  { title: "Offer Desk", url: "/offers", icon: DollarSign },
  { title: "Flight Plan", url: "/career", icon: Compass },
  { title: "Interview Simulator", url: "/interview-prep", icon: Mic },
  { title: "Autopilot Mode", url: "/auto-apply", icon: Zap },
  { title: "Open Market", url: "/gigs", icon: Briefcase },
  { title: "Skill Store", url: "/services", icon: Briefcase },
  { title: "Career Profile", url: "/profile", icon: UserCircle },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Support Inbox", url: "/support", icon: HelpCircle },
];

export const hiringManagerNav: NavItem[] = [
  { title: "Mission Control", url: "/hiring-manager", icon: LayoutDashboard },
  { title: "Candidates", url: "/candidates", icon: Database },
  { title: "Talent Search", url: "/talent-search", icon: Search },
  { title: "Job Postings", url: "/job-postings", icon: FileText },
  { title: "Interviews", url: "/interview-scheduling", icon: Calendar },
  { title: "Settings", url: "/settings", icon: Settings },
];

export const modes = [
  { label: "Job Seeker", icon: Target, value: "seeker" as const },
  { label: "Hiring Manager", icon: Users, value: "hiring" as const },
] as const;

export type AppMode = typeof modes[number]["value"];

export const hiringPaths = ["/hiring-manager", "/candidates", "/job-postings", "/interview-scheduling", "/talent-search"];

export function detectMode(pathname: string): AppMode {
  return hiringPaths.some(p => pathname.startsWith(p)) ? "hiring" : "seeker";
}

export function getNavItems(mode: AppMode): NavItem[] {
  return mode === "hiring" ? hiringManagerNav : jobSeekerNav;
}
