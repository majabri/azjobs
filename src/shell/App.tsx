/**
 * Shell App — The root container for the entire application.
 * Provides global context (query client, tooltips, toasts, theme) and mounts service routes.
 * Contains NO business logic. NO feature imports. Only infrastructure.
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ShellRoutes from "./routes";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";

const queryClient = new QueryClient();

function AppInner() {
  useLanguagePreference();
  return <ShellRoutes />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ThemeProvider>
              <AppInner />
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
