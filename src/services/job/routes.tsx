/**
 * Job Service Routes
 * Self-contained route definitions for the job service.
 * Mounted by shell under /job-search/*.
 * JobSeeker (public job analysis tool) exported separately for shell mounting.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

const JobSearch = lazy(() => import("./pages/JobSearch"));

// Public job analysis tool (exported for shell to mount at /job-seeker)
export const JobSeeker = lazy(() => import("./pages/JobSeeker"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function JobRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<JobSearch />} />
      </Routes>
    </Suspense>
  );
}
