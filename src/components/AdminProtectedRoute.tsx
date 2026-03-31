import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useAdminRole } from "@/hooks/useAdminRole";
import React from 'react';
import { useAuth } from 'your_auth_hook';
import { Card, Button } from 'your_component_library';

const AdminProtectedRoute = ({ children }) => {
    const { isLoading, user, error } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Card className="p-4">
                    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
                    <p>Loading...</p>
                </Card>
            </div>
        );
    }

    if (error || !user || !user.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <Card className="p-4">
                    <h2 className="text-xl">Unauthorized Access</h2>
                    <p>You do not have permission to access this page.</p>
                    <div className="flex space-x-4 mt-4">
                        <Button link="/admin/login" className="bg-blue-500 hover:bg-blue-700">Go to Login</Button>
                        <Button link="/dashboard" className="bg-gray-500 hover:bg-gray-700">Go to Dashboard</Button>
                    </div>
                </Card>
            </div>
        );
    }

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
};

export default AdminProtectedRoute;
