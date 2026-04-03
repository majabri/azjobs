/**
 * Admin Service Routes
 * Self-contained route definitions for the admin service (protected routes only).
 * Mounted by shell under /admin/* with AdminProtectedRoute + AdminLayout wrapper.
 * Public admin routes (/admin/login, /admin/set-password) are handled separately in the shell.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminAgents = lazy(() => import("./pages/AdminAgents"));
const AdminSystem = lazy(() => import("./pages/AdminSystem"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const AdminLogs = lazy(() => import("./pages/AdminLogs"));
const AdminAgentRuns = lazy(() => import("./pages/AdminAgentRuns"));
const AdminQueue = lazy(() => import("./pages/AdminQueue"));
const AdminConsole = lazy(() => import("./pages/AdminConsole"));
const AdminAudit = lazy(() => import("./pages/AdminAudit"));
const AdminAgentRunDetail = lazy(() => import("./pages/AdminAgentRunDetail"));
const AdminTickets = lazy(() => import("./pages/AdminTickets"));
const AdminSurveys = lazy(() => import("./pages/AdminSurveys"));

// Public admin pages (exported for shell to mount without auth guard)
export const AdminUsernameLogin = lazy(() => import("./pages/AdminUsernameLogin"));
export const AdminSetPassword = lazy(() => import("./pages/AdminSetPassword"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AdminRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="agents" element={<AdminAgents />} />
        <Route path="system" element={<AdminSystem />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="profile" element={<AdminProfile />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="agent-runs" element={<AdminAgentRuns />} />
        <Route path="agent-runs/:runId" element={<AdminAgentRunDetail />} />
        <Route path="queue" element={<AdminQueue />} />
        <Route path="console" element={<AdminConsole />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="surveys" element={<AdminSurveys />} />
      </Routes>
    </Suspense>
  );
}
