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
import ProtectedRoute from "./components/ProtectedRoute";
import AuthenticatedLayout from "./layouts/AuthenticatedLayout";
import { useEffect, useState } from "react";
import { supabase } from "./integrations/supabase/client";

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
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAuth(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setIsAuth(!!session));
    return () => subscription.unsubscribe();
  }, []);

  if (isAuth === null) return null; // loading
  if (isAuth) return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
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
