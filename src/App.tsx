import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import JobSeeker from "./pages/JobSeeker";
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

const queryClient = new QueryClient();

function ProtectedWithLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </ProtectedRoute>
  );
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
          {/* JobSeeker supports demo mode (no auth) */}
          <Route path="/job-seeker" element={<JobSeeker />} />
          <Route path="/dashboard" element={<ProtectedWithLayout><Dashboard /></ProtectedWithLayout>} />
          <Route path="/applications" element={<ProtectedWithLayout><Applications /></ProtectedWithLayout>} />
          <Route path="/profile" element={<ProtectedWithLayout><Profile /></ProtectedWithLayout>} />
          <Route path="/job-search" element={<ProtectedWithLayout><JobSearch /></ProtectedWithLayout>} />
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
