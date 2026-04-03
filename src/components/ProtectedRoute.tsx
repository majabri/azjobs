import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isReady } = useAuthReady();

  useEffect(() => {
    if (isReady && !user) {
      console.debug("[ProtectedRoute] unauthenticated — redirecting to /auth/login from", location.pathname);
      navigate("/auth/login", { replace: true });
    } else if (isReady && user) {
      console.debug("[ProtectedRoute] access granted for", location.pathname, "user:", user.id);
    }
  }, [isReady, navigate, user, location.pathname]);

  if (!isReady || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" aria-hidden="true" />
      </div>
    );
  }
  return <>{children}</>;
}
