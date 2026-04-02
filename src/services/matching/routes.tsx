/**
 * Matching Service Routes
 * Self-contained route definitions for the matching service.
 * Mounted by shell under /report/*.
 * ScoreReport exported separately since :analysisId is captured by shell route.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

// Exported for shell to mount at /report/:analysisId
export const ScoreReport = lazy(() => import("./pages/ScoreReport"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function MatchingRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path=":analysisId" element={<ScoreReport />} />
      </Routes>
    </Suspense>
  );
}
