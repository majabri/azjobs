import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import UserMenu from "@/components/UserMenu";
import NotificationCenter from "@/components/NotificationCenter";
import DashboardPickerDialog from "@/components/DashboardPickerDialog";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useUserRole, dashboardPrefKey } from "@/hooks/useUserRole";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthReady();
  const { isDualRole, isLoading } = useUserRole();

  // Show the picker once per device for dual-role users who haven't chosen yet
  const needsPicker =
    !isLoading &&
    isDualRole &&
    !!user &&
    !localStorage.getItem(dashboardPrefKey(user.id));

  const [pickerDismissed, setPickerDismissed] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40 px-4">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>

      <DashboardPickerDialog
        open={needsPicker && !pickerDismissed}
        userId={user?.id ?? ""}
        onDismiss={() => setPickerDismissed(true)}
      />
    </SidebarProvider>
  );
}
