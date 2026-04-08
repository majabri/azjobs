import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users } from "lucide-react";
import EmployerDashboardHome from "@/components/hiring-manager/EmployerDashboardHome";

// Lazy-load the existing screener to keep bundle efficient
import { lazy, Suspense } from "react";
const CandidateScreener = lazy(() => import("@/components/hiring-manager/CandidateScreenerLegacy"));

function ScreenerFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function HiringManagerPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="screener" className="gap-1.5">
            <Users className="w-4 h-4" /> Candidate Screener
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <EmployerDashboardHome />
        </TabsContent>

        <TabsContent value="screener">
          <Suspense fallback={<ScreenerFallback />}>
            <CandidateScreener />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
