/**
 * User Service Routes
 * Self-contained route definitions for the user service (profile routes).
 * Mounted by shell under /profile/*.
 * Auth and public profile pages are exported separately for shell mounting.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Profile = lazy(() => import("./pages/Profile"));

// Public user pages (exported for shell to mount without auth guard)
export const Auth = lazy(() => import("./pages/Auth"));
export const PublicProfile = lazy(() => import("./pages/PublicProfile"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function UserRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<Profile />} />
      </Routes>
    </Suspense>
  );
}
