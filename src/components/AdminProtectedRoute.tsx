import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useAdminRole } from "@/hooks/useAdminRole";
import React from 'react';
import { useAuth } from 'your_auth_hook';
import { Card, Button } from 'your_component_library';
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

  if (!isReady || !user || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Verifying access">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-destructive/60 animate-pulse" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) return null;
  return <>{children}</>;
}
    return children;
  return <>{children}</>;
};

export default AdminProtectedRoute;
