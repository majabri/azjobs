/**
 * Shell Navigation — Centralized navigation configuration.
 * Sidebar links point ONLY to the 5 top-level service routes:
 *   /dashboard, /job-search, /applications, /profile, /admin
 * No internal component or page references.
 */

import {
  LayoutDashboard, Search, ClipboardList, UserCircle,
  Shield,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  /** When true, only show this item for admin users */
  adminOnly?: boolean;
}

export const jobSeekerNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Job Search", url: "/job-search", icon: Search },
  { title: "Applications", url: "/applications", icon: ClipboardList },
  { title: "Profile", url: "/profile", icon: UserCircle },
  { title: "Admin", url: "/admin", icon: Shield, adminOnly: true },
];

/** @deprecated Hiring manager mode is removed. Kept as empty array for backward-compat. */
export const hiringManagerNav: NavItem[] = [];

export const modes = [
  { label: "Job Seeker", icon: LayoutDashboard, value: "seeker" as const },
] as const;

export type AppMode = typeof modes[number]["value"];

export const hiringPaths: string[] = [];

export function detectMode(_pathname: string): AppMode {
  return "seeker";
}

export function getNavItems(_mode: AppMode): NavItem[] {
  return jobSeekerNav;
}
