import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { initAnalytics } from "./lib/analytics";
import Index from "./pages/Index";
import JobSeeker from "./pages/JobSeeker";
import CandidatesDatabase from "./pages/CandidatesDatabase";
import JobPostings from "./pages/JobPostings";
import InterviewScheduling from "./pages/InterviewScheduling";
import Auth from "./pages/Auth";
import Applications from "./pages/Applications";
import Profile from "./pages/Profile";
import JobSearch from "./pages/JobSearch";
import Dashboard from "./pages/Dashboard";
import PublicProfile from "./pages/PublicProfile";
import HiringManager from "./pages/HiringManager";
import ScoreReport from "./pages/ScoreReport";
import NotFound from "./pages/NotFound";
import Offers from "./pages/Offers";
import Career from "./pages/Career";
import InterviewPrep from "./pages/InterviewPrep";
import AutoApply from "./pages/AutoApply";
import AccountSettings from "./pages/AccountSettings";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AuthenticatedLayout from "./layouts/AuthenticatedLayout";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAgents from "./pages/admin/AdminAgents";
import AdminSystem from "./pages/admin/AdminSystem";
import AdminSetPassword from "./pages/admin/AdminSetPassword";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminSurveys from "./pages/admin/AdminSurveys";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminAgentRuns from "./pages/admin/AdminAgentRuns";
import AdminQueue from "./pages/admin/AdminQueue";
import AdminConsole from "./pages/admin/AdminConsole";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminAgentRunDetail from "./pages/admin/AdminAgentRunDetail";
import PlatformSettings from "./pages/admin/PlatformSettings";
import SignUpWithInvite from "./pages/auth/SignUpWithInvite";
import { useAuthReady } from "@/hooks/useAuthReady";
import React, { lazy, Suspense } from "react";

/* Lazy-load service pages that were previously unrouted */
const GigMarketplace = lazy(() => import("./services/gig/pages/GigMarketplace"));
const Marketplace = lazy(() => import("./services/marketplace/pages/Marketplace"));
const Support = lazy(() => import("./services/support/pages/Support"));

const queryClient = new QueryClient();

// Initialize analytics
initAnalytics({ enabled: true });

function ProtectedWithLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </ProtectedRoute>
  );
}

/** Wraps content in AuthenticatedLayout when user is logged in, otherwise renders standalone */
function OptionalLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuthReady();

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (user) return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
  return <>{children}</>;
}

function LazyFallback() {
  return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/signup" element={<SignUpWithInvite />} />
              <Route path="/job-seeker" element={<OptionalLayout><JobSeeker /></OptionalLayout>} />
              <Route path="/dashboard" element={<ProtectedWithLayout><Dashboard /></ProtectedWithLayout>} />
              <Route path="/applications" element={<ProtectedWithLayout><Applications /></ProtectedWithLayout>} />
              <Route path="/profile" element={<ProtectedWithLayout><Profile /></ProtectedWithLayout>} />
              <Route path="/job-search" element={<ProtectedWithLayout><JobSearch /></ProtectedWithLayout>} />
              <Route path="/hiring-manager" element={<ProtectedWithLayout><HiringManager /></ProtectedWithLayout>} />
              <Route path="/candidates" element={<ProtectedWithLayout><CandidatesDatabase /></ProtectedWithLayout>} />
              <Route path="/job-postings" element={<ProtectedWithLayout><JobPostings /></ProtectedWithLayout>} />
              <Route path="/interview-scheduling" element={<ProtectedWithLayout><InterviewScheduling /></ProtectedWithLayout>} />
              <Route path="/offers" element={<ProtectedWithLayout><Offers /></ProtectedWithLayout>} />
              <Route path="/career" element={<ProtectedWithLayout><Career /></ProtectedWithLayout>} />
              <Route path="/interview-prep" element={<ProtectedWithLayout><InterviewPrep /></ProtectedWithLayout>} />
              <Route path="/auto-apply" element={<ProtectedWithLayout><AutoApply /></ProtectedWithLayout>} />
              <Route path="/settings" element={<ProtectedWithLayout><AccountSettings /></ProtectedWithLayout>} />

              {/* Open Market (gig marketplace) */}
              <Route path="/gigs" element={<ProtectedWithLayout><GigMarketplace /></ProtectedWithLayout>} />
              {/* Skill Store (service catalog) */}
              <Route path="/services" element={<ProtectedWithLayout><Marketplace /></ProtectedWithLayout>} />
              {/* Support Inbox */}
              <Route path="/support" element={<ProtectedWithLayout><Support /></ProtectedWithLayout>} />

              {/* Admin routes */}
              <Route path="/admin/login" element={<Navigate to="/auth/login" replace />} />
              <Route path="/admin/set-password" element={<AdminProtectedRoute><AdminSetPassword /></AdminProtectedRoute>} />
              <Route path="/admin" element={<AdminProtectedRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/users" element={<AdminProtectedRoute><AdminLayout><AdminUsers /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/agents" element={<AdminProtectedRoute><AdminLayout><AdminAgents /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/system" element={<AdminProtectedRoute><AdminLayout><AdminSystem /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/settings" element={<AdminProtectedRoute><AdminLayout><AccountSettings /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/profile" element={<AdminProtectedRoute><AdminLayout><AdminProfile /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/logs" element={<AdminProtectedRoute><AdminLayout><AdminLogs /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/agent-runs" element={<AdminProtectedRoute><AdminLayout><AdminAgentRuns /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/queue" element={<AdminProtectedRoute><AdminLayout><AdminQueue /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/console" element={<AdminProtectedRoute><AdminLayout><AdminConsole /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/audit" element={<AdminProtectedRoute><AdminLayout><AdminAudit /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/tickets" element={<AdminProtectedRoute><AdminLayout><AdminTickets /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/surveys" element={<AdminProtectedRoute><AdminLayout><AdminSurveys /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/agent-runs/:runId" element={<AdminProtectedRoute><AdminLayout><AdminAgentRunDetail /></AdminLayout></AdminProtectedRoute>} />
              <Route path="/admin/platform-settings" element={<AdminProtectedRoute><AdminLayout><PlatformSettings /></AdminLayout></AdminProtectedRoute>} />

              {/* Public routes */}
              <Route path="/p/:userId" element={<PublicProfile />} />
              <Route path="/report/:analysisId" element={<ScoreReport />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
