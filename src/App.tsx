import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AuthenticatedLayout from "./layouts/AuthenticatedLayout";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAgents from "./pages/admin/AdminAgents";
import AdminSystem from "./pages/admin/AdminSystem";
import AdminSettings from "./pages/admin/AdminSettings";
import { useAuthReady } from "@/hooks/useAuthReady";

const queryClient = new QueryClient();

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

  if (!isReady) return null;
  if (user) return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
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
          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminRoute><AdminLayout><AdminUsers /></AdminLayout></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/agents" element={<ProtectedRoute><AdminRoute><AdminLayout><AdminAgents /></AdminLayout></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/system" element={<ProtectedRoute><AdminRoute><AdminLayout><AdminSystem /></AdminLayout></AdminRoute></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute><AdminRoute><AdminLayout><AdminSettings /></AdminLayout></AdminRoute></ProtectedRoute>} />
          {/* Public routes */}
          <Route path="/p/:userId" element={<PublicProfile />} />
          <Route path="/report/:analysisId" element={<ScoreReport />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
