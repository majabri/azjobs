/**
 * Analytics Service Routes
 * Self-contained route definitions for the analytics (dashboard) service.
 * Mounted by shell under /dashboard/*.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Dashboard = lazy(() => import("./pages/Dashboard"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AnalyticsRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<Dashboard />} />
      </Routes>
    </Suspense>
  );
}
