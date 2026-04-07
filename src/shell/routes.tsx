/**
 * Shell Routes — Lazy-loaded service route mounting.
 * Each service owns its own routes.tsx. Shell only mounts them.
 * No cross-service route imports. No business logic.
 *
 * Top-level service route prefixes:
 *   /dashboard/*       → analytics service
 *   /job-search/*      → job service
 *   /applications/*    → application service
 *   /profile/*         → user service
 *   /admin/*           → admin service
 *   /career/*          → career service
 *   /report/*          → matching service
 *   /support/*         → support service
 *   /hiring-manager/*  → hiring service
 */

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

// ─── Lazy-loaded service route components ────────────────────────────────────
const AnalyticsRoutes = lazy(() => import("@/services/analytics/routes"));
const JobRoutes = lazy(() => import("@/services/job/routes"));
const JobSeeker = lazy(() => import("@/services/job/pages/JobSeeker"));
const ApplicationRoutes = lazy(() => import("@/services/application/routes"));
const Offers = lazy(() => import("@/services/application/pages/Offers"));
const UserRoutes = lazy(() => import("@/services/user/routes"));
const UserAuth = lazy(() => import("@/services/user/pages/Auth"));
const UserPublicProfile = lazy(() => import("@/services/user/pages/PublicProfile"));
const AdminRoutes = lazy(() => import("@/services/admin/routes"));
const AdminUsernameLogin = lazy(() => import("@/services/admin/pages/AdminUsernameLogin"));
const AdminSetPassword = lazy(() => import("@/services/admin/pages/AdminSetPassword"));
const CareerRoutes = lazy(() => import("@/services/career/routes"));
const InterviewPrep = lazy(() => import("@/services/career/pages/InterviewPrep"));
const AutoApply = lazy(() => import("@/services/career/pages/AutoApply"));
const ScoreReport = lazy(() => import("@/services/matching/pages/ScoreReport"));
const SupportRoutes = lazy(() => import("@/services/support/routes"));
const HiringRoutes = lazy(() => import("@/services/hiring/routes"));
const CandidatesDatabase = lazy(() => import("@/services/hiring/pages/CandidatesDatabase"));
const JobPostings = lazy(() => import("@/services/hiring/pages/JobPostings"));
const InterviewScheduling = lazy(() => import("@/services/hiring/pages/InterviewScheduling"));
const GigMarketplace = lazy(() => import("@/services/gig/pages/GigMarketplace"));

// ─── Non-service pages (landing, 404) ────────────────────────────────────────
const Index = lazy(() => import("@/pages/Index"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const LoginPage = lazy(() => import("@/pages/auth/Login"));
const SignupPage = lazy(() => import("@/pages/auth/Signup"));
const AccountSettings = lazy(() => import("@/pages/AccountSettings"));

// ─── Layout wrappers ─────────────────────────────────────────────────────────
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import AuthenticatedLayout from "@/layouts/AuthenticatedLayout";
import AdminLayout from "@/layouts/AdminLayout";
import { useAuthReady } from "@/hooks/useAuthReady";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" aria-hidden="true" />
    </div>
  );
}

function ProtectedWithLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </ProtectedRoute>
  );
}

function OptionalLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuthReady();
  if (!isReady) return <LoadingFallback />;
  if (user) return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
  return <>{children}</>;
}

export default function ShellRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<Index />} />

        {/* Auth pages */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignupPage />} />
        <Route path="/auth" element={<UserAuth />} />

        {/* Account Settings (protected) */}
        <Route path="/settings" element={<ProtectedWithLayout><AccountSettings /></ProtectedWithLayout>} />

        {/* Analytics Service → /dashboard/* */}
        <Route path="/dashboard/*" element={<ProtectedWithLayout><AnalyticsRoutes /></ProtectedWithLayout>} />

        {/* Job Service → /job-search/* */}
        <Route path="/job-search/*" element={<ProtectedWithLayout><JobRoutes /></ProtectedWithLayout>} />

        {/* Job Seeker (public job analysis tool — kept for backward compatibility) */}
        <Route path="/job-seeker" element={<OptionalLayout><JobSeeker /></OptionalLayout>} />

        {/* Application Service → /applications/* */}
        <Route path="/applications/*" element={<ProtectedWithLayout><ApplicationRoutes /></ProtectedWithLayout>} />

        {/* /offers backward-compat alias → application service */}
        <Route path="/offers" element={<ProtectedWithLayout><Offers /></ProtectedWithLayout>} />

        {/* User Service → /profile/* */}
        <Route path="/profile/*" element={<ProtectedWithLayout><UserRoutes /></ProtectedWithLayout>} />

        {/* Public profile (no auth required) */}
        <Route path="/p/:userId" element={<UserPublicProfile />} />

        {/* Career Service → /career/* */}
        <Route path="/career/*" element={<ProtectedWithLayout><CareerRoutes /></ProtectedWithLayout>} />

        {/* Career flat-URL backward-compat aliases */}
        <Route path="/interview-prep" element={<ProtectedWithLayout><InterviewPrep /></ProtectedWithLayout>} />
        <Route path="/auto-apply" element={<ProtectedWithLayout><AutoApply /></ProtectedWithLayout>} />

        {/* Matching Service → /report/* */}
        <Route path="/report/:analysisId" element={<ScoreReport />} />

        {/* Support Service → /support/* */}
        <Route path="/support/*" element={<ProtectedWithLayout><SupportRoutes /></ProtectedWithLayout>} />

        {/* Hiring Manager Service → /hiring-manager/* */}
        <Route path="/hiring-manager/*" element={<ProtectedWithLayout><HiringRoutes /></ProtectedWithLayout>} />

        {/* Hiring flat-URL backward-compat aliases */}
        <Route path="/candidates" element={<ProtectedWithLayout><CandidatesDatabase /></ProtectedWithLayout>} />
        <Route path="/job-postings" element={<ProtectedWithLayout><JobPostings /></ProtectedWithLayout>} />
        <Route path="/interview-scheduling" element={<ProtectedWithLayout><InterviewScheduling /></ProtectedWithLayout>} />

        {/* Gig Marketplace */}
        <Route path="/gigs" element={<ProtectedWithLayout><GigMarketplace /></ProtectedWithLayout>} />

        {/* Admin Service — public routes (no auth guard) */}
        <Route path="/admin/login" element={<Navigate to="/auth/login" replace />} />
        <Route
          path="/admin/set-password"
          element={<AdminProtectedRoute><AdminSetPassword /></AdminProtectedRoute>}
        />

        {/* Admin Service — protected routes → /admin/* */}
        <Route
          path="/admin/*"
          element={
            <AdminProtectedRoute>
              <AdminLayout>
                <AdminRoutes />
              </AdminLayout>
            </AdminProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
