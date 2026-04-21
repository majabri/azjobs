/**
 * Career Service Routes
 * Self-contained route definitions for the career service.
 * Mounted by shell under /career/*.
 * InterviewPrep and AutoApply exported separately for backward-compat flat URLs.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Career = lazy(() => import("./pages/Career"));

// Exported for shell to mount at flat backward-compat URLs
export const InterviewPrep = lazy(() => import("./pages/InterviewPrep"));
export const AutoApply = lazy(() => import("./pages/AutoApply"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function CareerRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<Career />} />
        <Route path="interview-prep" element={<InterviewPrep />} />
        <Route path="auto-apply" element={<AutoApply />} />
      </Routes>
    </Suspense>
  );
}
