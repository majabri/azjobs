import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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

  if (!isReady || !user || roleLoading) return null;
  if (!isAdmin) return null;
  return <>{children}</>;
}
