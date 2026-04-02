/**
 * Support Service Routes
 * Self-contained route definitions for the support service.
 * Mounted by shell under /support/*.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Support = lazy(() => import("./pages/Support"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function SupportRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<Support />} />
      </Routes>
    </Suspense>
  );
}
