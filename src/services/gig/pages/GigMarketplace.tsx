/**
 * Gig Marketplace — Two-sided marketplace with employer and talent flows
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Search, FileText, Handshake } from "lucide-react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

import EmployerProjectsDashboard from "@/components/gig/EmployerProjectsDashboard";
import ProjectForm from "@/components/gig/ProjectForm";
import ProposalManagement from "@/components/gig/ProposalManagement";
import TalentProjectBrowser from "@/components/gig/TalentProjectBrowser";
import TalentProposalTracker from "@/components/gig/TalentProposalTracker";
import ContractManagement from "@/components/gig/ContractManagement";
import type { Project } from "@/components/gig/types";

type EmployerView = "dashboard" | "form" | "proposals";

export default function GigMarketplace() {
  const { enabled, loading: flagLoading } = useFeatureFlag("gig_marketplace");
  const [activeTab, setActiveTab] = useState("browse");

  // Employer sub-views
  const [employerView, setEmployerView] = useState<EmployerView>("dashboard");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [proposalsProject, setProposalsProject] = useState<Project | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (flagLoading) return null;
  if (!enabled) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h1 className="text-2xl font-bold">Gig Marketplace</h1>
        <p className="text-muted-foreground mt-2">This feature is currently disabled by the administrator.</p>
      </div>
    );
  }

  const handleNewProject = () => { setEditingProject(null); setEmployerView("form"); };
  const handleEditProject = (p: Project) => { setEditingProject(p); setEmployerView("form"); };
  const handleManageProposals = (p: Project) => { setProposalsProject(p); setEmployerView("proposals"); };
  const handleProjectSaved = () => { setEmployerView("dashboard"); setEditingProject(null); setRefreshKey(k => k + 1); };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-primary">Gig Marketplace</h1>
        <p className="text-muted-foreground text-sm mt-1">Find projects or hire talent for your next venture</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse" className="gap-1.5"><Search className="w-4 h-4" /> Browse Projects</TabsTrigger>
          <TabsTrigger value="employer" className="gap-1.5"><Briefcase className="w-4 h-4" /> My Projects</TabsTrigger>
          <TabsTrigger value="proposals" className="gap-1.5"><FileText className="w-4 h-4" /> My Proposals</TabsTrigger>
          <TabsTrigger value="contracts" className="gap-1.5"><Handshake className="w-4 h-4" /> Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6">
          <TalentProjectBrowser />
        </TabsContent>

        <TabsContent value="employer" className="mt-6">
          {employerView === "dashboard" && (
            <EmployerProjectsDashboard
              onNew={handleNewProject}
              onEdit={handleEditProject}
              onView={handleEditProject}
              onManageProposals={handleManageProposals}
              refreshKey={refreshKey}
            />
          )}
          {employerView === "form" && (
            <ProjectForm
              editing={editingProject}
              onSaved={handleProjectSaved}
              onCancel={() => { setEmployerView("dashboard"); setEditingProject(null); }}
            />
          )}
          {employerView === "proposals" && proposalsProject && (
            <ProposalManagement
              project={proposalsProject}
              onBack={() => { setEmployerView("dashboard"); setProposalsProject(null); }}
            />
          )}
        </TabsContent>

        <TabsContent value="proposals" className="mt-6">
          <TalentProposalTracker />
        </TabsContent>

        <TabsContent value="contracts" className="mt-6">
          <ContractManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
