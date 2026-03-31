import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useAdminRole } from "@/hooks/useAdminRole";

/**
 * Protects admin routes by redirecting:
 * - Unauthenticated users → /admin/login
 * - Authenticated non-admins → /dashboard
 */
export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const { isAdmin, isLoading: roleLoading } = useAdminRole();

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (!roleLoading && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [isReady, user, isAdmin, roleLoading, navigate]);

  if (!isReady || !user || roleLoading) return null;
  if (!isAdmin) return null;
  return <>{children}</>;
}
