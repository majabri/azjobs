/**
 * Shell Routes — Lazy-loaded service route mounting.
 * Each service owns its own routes. Shell only mounts them.
 * No cross-service route imports. No business logic.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

// ─── Lazy-loaded service pages ──────────────────────────────────────────────
// Analytics service (Dashboard)
const Dashboard = lazy(() => import("@/services/analytics/pages/Dashboard"));

// Job service (Search + Analysis)
const JobSearch = lazy(() => import("@/services/job/pages/JobSearch"));
const JobSeeker = lazy(() => import("@/services/job/pages/JobSeeker"));

// Application service
const Applications = lazy(() => import("@/services/application/pages/Applications"));
const Offers = lazy(() => import("@/services/application/pages/Offers"));

// User service (Profile, Auth)
const Profile = lazy(() => import("@/services/user/pages/Profile"));
const Auth = lazy(() => import("@/services/user/pages/Auth"));
const PublicProfile = lazy(() => import("@/services/user/pages/PublicProfile"));

// Career service
const Career = lazy(() => import("@/services/career/pages/Career"));
const InterviewPrep = lazy(() => import("@/services/career/pages/InterviewPrep"));
const AutoApply = lazy(() => import("@/services/career/pages/AutoApply"));

// Matching/Report service
const ScoreReport = lazy(() => import("@/services/matching/pages/ScoreReport"));

// Support service
const Support = lazy(() => import("@/services/support/pages/Support"));

// Hiring manager service
const HiringManager = lazy(() => import("@/services/hiring/pages/HiringManager"));
const CandidatesDatabase = lazy(() => import("@/services/hiring/pages/CandidatesDatabase"));
const JobPostings = lazy(() => import("@/services/hiring/pages/JobPostings"));
const InterviewScheduling = lazy(() => import("@/services/hiring/pages/InterviewScheduling"));

// Admin service
const AdminDashboard = lazy(() => import("@/services/admin/pages/AdminDashboard"));
const AdminUsers = lazy(() => import("@/services/admin/pages/AdminUsers"));
const AdminAgents = lazy(() => import("@/services/admin/pages/AdminAgents"));
const AdminSystem = lazy(() => import("@/services/admin/pages/AdminSystem"));
const AdminSettings = lazy(() => import("@/services/admin/pages/AdminSettings"));
const AdminUsernameLogin = lazy(() => import("@/services/admin/pages/AdminUsernameLogin"));
const AdminSetPassword = lazy(() => import("@/services/admin/pages/AdminSetPassword"));
const AdminProfile = lazy(() => import("@/services/admin/pages/AdminProfile"));
const AdminLogs = lazy(() => import("@/services/admin/pages/AdminLogs"));
const AdminAgentRuns = lazy(() => import("@/services/admin/pages/AdminAgentRuns"));
const AdminQueue = lazy(() => import("@/services/admin/pages/AdminQueue"));
const AdminConsole = lazy(() => import("@/services/admin/pages/AdminConsole"));
const AdminAudit = lazy(() => import("@/services/admin/pages/AdminAudit"));
const AdminAgentRunDetail = lazy(() => import("@/services/admin/pages/AdminAgentRunDetail"));

// Landing + 404
const Index = lazy(() => import("@/pages/Index"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// ─── Layout wrappers ────────────────────────────────────────────────────────
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
        <Route path="/auth" element={<Auth />} />

        {/* Job Service */}
        <Route path="/job-seeker" element={<OptionalLayout><JobSeeker /></OptionalLayout>} />
        <Route path="/job-search" element={<ProtectedWithLayout><JobSearch /></ProtectedWithLayout>} />

        {/* Analytics Service (Dashboard) */}
        <Route path="/dashboard" element={<ProtectedWithLayout><Dashboard /></ProtectedWithLayout>} />

        {/* Application Service */}
        <Route path="/applications" element={<ProtectedWithLayout><Applications /></ProtectedWithLayout>} />
        <Route path="/offers" element={<ProtectedWithLayout><Offers /></ProtectedWithLayout>} />

        {/* User Service */}
        <Route path="/profile" element={<ProtectedWithLayout><Profile /></ProtectedWithLayout>} />
        <Route path="/p/:userId" element={<PublicProfile />} />

        {/* Career Service */}
        <Route path="/career" element={<ProtectedWithLayout><Career /></ProtectedWithLayout>} />
        <Route path="/interview-prep" element={<ProtectedWithLayout><InterviewPrep /></ProtectedWithLayout>} />
        <Route path="/auto-apply" element={<ProtectedWithLayout><AutoApply /></ProtectedWithLayout>} />

        {/* Matching Service */}
        <Route path="/report/:analysisId" element={<ScoreReport />} />

        {/* Support Service */}
        <Route path="/support" element={<ProtectedWithLayout><Support /></ProtectedWithLayout>} />

        {/* Hiring Manager Service */}
        <Route path="/hiring-manager" element={<ProtectedWithLayout><HiringManager /></ProtectedWithLayout>} />
        <Route path="/candidates" element={<ProtectedWithLayout><CandidatesDatabase /></ProtectedWithLayout>} />
        <Route path="/job-postings" element={<ProtectedWithLayout><JobPostings /></ProtectedWithLayout>} />
        <Route path="/interview-scheduling" element={<ProtectedWithLayout><InterviewScheduling /></ProtectedWithLayout>} />

        {/* Admin Service */}
        <Route path="/admin/login" element={<AdminUsernameLogin />} />
        <Route path="/admin/set-password" element={<AdminProtectedRoute><AdminSetPassword /></AdminProtectedRoute>} />
        <Route path="/admin" element={<AdminProtectedRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/users" element={<AdminProtectedRoute><AdminLayout><AdminUsers /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/agents" element={<AdminProtectedRoute><AdminLayout><AdminAgents /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/system" element={<AdminProtectedRoute><AdminLayout><AdminSystem /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/settings" element={<AdminProtectedRoute><AdminLayout><AdminSettings /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/profile" element={<AdminProtectedRoute><AdminLayout><AdminProfile /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/logs" element={<AdminProtectedRoute><AdminLayout><AdminLogs /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/agent-runs" element={<AdminProtectedRoute><AdminLayout><AdminAgentRuns /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/queue" element={<AdminProtectedRoute><AdminLayout><AdminQueue /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/console" element={<AdminProtectedRoute><AdminLayout><AdminConsole /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/audit" element={<AdminProtectedRoute><AdminLayout><AdminAudit /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/agent-runs/:runId" element={<AdminProtectedRoute><AdminLayout><AdminAgentRunDetail /></AdminLayout></AdminProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
