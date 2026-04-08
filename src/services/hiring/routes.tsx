/**
 * Hiring Service Routes
 * Self-contained route definitions for the hiring manager service.
 * Mounted by shell under /hiring-manager/*.
 * Sub-pages exported separately for backward-compat flat URLs.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

const HiringManager = lazy(() => import("./pages/HiringManager"));

// Exported for shell to mount at flat backward-compat URLs
export const CandidatesDatabase = lazy(() => import("./pages/CandidatesDatabase"));
export const JobPostings = lazy(() => import("./pages/JobPostings"));
export const InterviewScheduling = lazy(() => import("./pages/InterviewScheduling"));
export const TalentSearch = lazy(() => import("./pages/TalentSearch"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function HiringRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<HiringManager />} />
        <Route path="candidates" element={<CandidatesDatabase />} />
        <Route path="job-postings" element={<JobPostings />} />
        <Route path="interview-scheduling" element={<InterviewScheduling />} />
        <Route path="talent-search" element={<TalentSearch />} />
      </Routes>
    </Suspense>
  );
}
