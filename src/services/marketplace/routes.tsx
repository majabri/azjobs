import { lazy } from "react";
import { Routes, Route } from "react-router-dom";

const Marketplace = lazy(() => import("./pages/Marketplace"));

export default function MarketplaceRoutes() {
  return (
    <Routes>
      <Route index element={<Marketplace />} />
    </Routes>
  );
}
