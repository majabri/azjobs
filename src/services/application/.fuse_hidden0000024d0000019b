/**
 * Application Service Routes
 * Self-contained route definitions for the application service.
 * Mounted by shell under /applications/*.
 * Offers exported separately for backward-compat /offers URL.
 */

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Applications = lazy(() => import("./pages/Applications"));

// Exported for shell to mount at backward-compat /offers URL
export const Offers = lazy(() => import("./pages/Offers"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ApplicationRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<Applications />} />
        <Route path="offers" element={<Offers />} />
      </Routes>
    </Suspense>
  );
}
