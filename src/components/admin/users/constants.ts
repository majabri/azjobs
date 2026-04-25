/** Role-to-badge colour map. Kept separate from shared.tsx so Vite Fast Refresh
 *  can hot-reload component files without mixing component + non-component exports. */
export const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  recruiter: "bg-accent/10 text-accent border-accent/20",
  job_seeker: "bg-muted text-muted-foreground border-border",
};
