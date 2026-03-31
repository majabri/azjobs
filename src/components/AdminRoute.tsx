import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminRole } from "@/hooks/useAdminRole";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useAdminRole();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) return null;
  if (!isAdmin) return null;
  return <>{children}</>;
}
