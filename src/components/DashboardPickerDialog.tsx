/**
 * DashboardPickerDialog — Shown to dual-role users (job_seeker + recruiter)
 * the first time they log in (or whenever they have no stored preference).
 *
 * The user picks their default landing dashboard.  The choice is persisted in
 * `profiles.default_dashboard` (and cached in localStorage) so the dialog
 * never re-appears once a preference is saved.
 */

import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type DashboardPref } from "@/hooks/useUserRole";
import { useDashboardPref } from "@/hooks/useDashboardPref";

interface Props {
  open: boolean;
  onDismiss: () => void;
}

interface OptionConfig {
  pref: DashboardPref;
  route: string;
  icon: typeof LayoutDashboard;
  label: string;
  description: string;
}

const OPTIONS: OptionConfig[] = [
  {
    pref: "job_seeker",
    route: "/dashboard",
    icon: LayoutDashboard,
    label: "Job Seeker Dashboard",
    description: "Track applications, analyze job fits, and manage your career.",
  },
  {
    pref: "hiring_manager",
    route: "/hiring-manager",
    icon: Users,
    label: "Hiring Manager Dashboard",
    description: "Screen candidates, post jobs, and schedule interviews.",
  },
];

export default function DashboardPickerDialog({ open, onDismiss }: Props) {
  const navigate = useNavigate();
  const { updatePref } = useDashboardPref();

  const handlePick = async (option: OptionConfig) => {
    await updatePref(option.pref);
    onDismiss();
    navigate(option.route, { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pick your default dashboard</DialogTitle>
          <DialogDescription>
            Your account has access to both experiences. Choose which one opens
            by default when you sign in. You can switch anytime from the sidebar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 mt-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.pref}
              onClick={() => void handlePick(opt)}
              className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <opt.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-col items-center gap-1">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onDismiss}>
            Decide later
          </Button>
          <p className="text-[11px] text-muted-foreground/70">
            You can change this later in Settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

