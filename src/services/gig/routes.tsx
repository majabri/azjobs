/**
 * Gig Service — Routes
 */

import { lazy } from "react";

const GigMarketplace = lazy(() => import("./pages/GigMarketplace"));

export const gigRoutes = [
  { path: "/gigs", element: <GigMarketplace /> },
];
