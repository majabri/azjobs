import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useAdminRole } from "@/hooks/useAdminRole";

/**
 * Protects admin routes by redirecting:
 * - Unauthenticated users → /admin/login
 * - Authenticated non-admins → /dashboard
 * - Admins with must_set_password flag → /admin/set-password
 */
export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isReady } = useAuthReady();
  const { isAdmin, isLoading: roleLoading } = useAdminRole();

  const mustSetPassword = user?.user_metadata?.must_set_password === true;
  const onSetPasswordPage = location.pathname === "/admin/set-password";

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (!roleLoading && !isAdmin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!roleLoading && isAdmin && mustSetPassword && !onSetPasswordPage) {
      navigate("/admin/set-password", { replace: true });
    }
  }, [isReady, user, isAdmin, roleLoading, mustSetPassword, onSetPasswordPage, navigate]);

  if (!isReady || !user || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-destructive/60 animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) return null;
  return <>{children}</>;
}
