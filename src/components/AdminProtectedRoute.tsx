import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { useAdminRole } from "@/hooks/useAdminRole";

const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useAdminRole();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate("/admin/login", { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Clock className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
};

export default AdminProtectedRoute;