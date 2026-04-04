/**
 * DashboardModeDialog — shown to dual-role users (both seeker + hiring manager)
 * after login so they can pick their default dashboard.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, Users } from "lucide-react";
import { setDashboardPref } from "@/hooks/usePostLoginRedirect";

interface Props {
  open: boolean;
  onSelect: (route: string) => void;
}

export default function DashboardModeDialog({ open, onSelect }: Props) {
  const pick = (mode: "seeker" | "hiring") => {
    setDashboardPref(mode);
    onSelect(mode === "hiring" ? "/hiring-manager" : "/dashboard");
  };

  return (
    <Dialog open={open} onOpenChange={() => pick("seeker")}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pick your default dashboard</DialogTitle>
          <DialogDescription>
            You have both job seeker and hiring manager activity. Choose which dashboard to land on after login. You can always switch from the sidebar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 pt-4">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-6 hover:border-primary hover:bg-primary/5"
            onClick={() => pick("seeker")}
          >
            <Target className="h-8 w-8 text-primary" />
            <span className="font-semibold">Job Seeker</span>
            <span className="text-xs text-muted-foreground">Find & apply to jobs</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-6 hover:border-primary hover:bg-primary/5"
            onClick={() => pick("hiring")}
          >
            <Users className="h-8 w-8 text-primary" />
            <span className="font-semibold">Hiring Manager</span>
            <span className="text-xs text-muted-foreground">Screen & manage candidates</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
