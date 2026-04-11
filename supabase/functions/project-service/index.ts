/**
 * Phase 9.3: Project Service (Contracts & Milestones)
 * Deno Edge Function for managing gig contracts and milestones
 * Stack: Supabase Edge Functions, TypeScript 5.8, PostgreSQL
 *
 * Endpoint: /functions/v1/project-service
 * Actions: create_contract, update_contract_status, add_milestone, update_milestone,
 *          submit_milestone, approve_milestone, list_contracts, health_ping
 */

import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

// Type definitions
interface GigContract {
  id: string;
  project_id: string;
  proposal_id: string;
  employer_id: string;
  talent_id: string;
  title: string;
  description: string | null;
  total_amount: number;
  currency: string;
  payment_type: "fixed" | "milestone";
  status: "draft" | "active" | "paused" | "completed" | "disputed" | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ContractMilestone {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  status: "pending" | "in_progress" | "submitted" | "revision_requested" | "approved" | "paid";
  deliverable_url: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CreateContractRequest {
  action: "create_contract";
  proposal_id: string;
  title: string;
  description?: string;
  payment_type: "fixed" | "milestone";
}

interface UpdateContractStatusRequest {
  action: "update_contract_status";
  contract_id: string;
  new_status: "active" | "paused" | "completed" | "disputed" | "cancelled";
}

interface AddMilestoneRequest {
  action: "add_milestone";
  contract_id: string;
  title: string;
  description?: string;
  amount: number;
  due_date?: string;
}

interface UpdateMilestoneRequest {
  action: "update_milestone";
  milestone_id: string;
  title?: string;
  description?: string;
  amount?: number;
  due_date?: string;
}

interface SubmitMilestoneRequest {
  action: "submit_milestone";
  milestone_id: string;
  deliverable_url: string;
}

interface ApproveMilestoneRequest {
  action: "approve_milestone";
  milestone_id: string;
  approve: boolean;
}

interface ListContractsRequest {
  action: "list_contracts";
  status?: string;
  limit?: number;
  offset?: number;
}

type RequestBody =
  | CreateContractRequest
  | UpdateContractStatusRequest
  | AddMilestoneRequest
  | UpdateMilestoneRequest
  | SubmitMilestoneRequest
  | ApproveMilestoneRequest
  | ListContractsRequest
  | { action: "health_ping" };

/**
 * Extract user ID from JWT token
 */
function getUserIdFromToken(authHeader: string): string | null {
  try {
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Create a contract from an accepted proposal
 */
async function createContract(
  supabase: any,
  userId: string,
  req: CreateContractRequest
): Promise<{ success: boolean; data?: GigContract; error?: string }> {
  try {
    // Get proposal and verify it's accepted
    const { data: proposal, error: proposalError } = await supabase
      .from("gig_proposals")
      .select("project_id, talent_id, status, proposed_rate")
      .eq("id", req.proposal_id)
      .single();

    if (proposalError || !proposal) {
      return { success: false, error: "Proposal not found" };
    }

    if (proposal.status !== "accepted") {
      return { success: false, error: "Only accepted proposals can create contracts" };
    }

    // Get project to verify employer
    const { data: project } = await supabase
      .from("gig_projects")
      .select("employer_id, title")
      .eq("id", proposal.project_id)
      .single();

    if (!project || project.employer_id !== userId) {
      return { success: false, error: "Unauthorized to create contract" };
    }

    // Create contract
    const { data: contract, error } = await supabase
      .from("gig_contracts")
      .insert([
        {
          project_id: proposal.project_id,
          proposal_id: req.proposal_id,
          employer_id: userId,
          talent_id: proposal.talent_id,
          title: req.title,
          description: req.description || null,
          total_amount: proposal.proposed_rate,
          currency: "USD",
          payment_type: req.payment_type,
          status: "draft",
        },
      ])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: contract };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Update contract status
 */
async function updateContractStatus(
  supabase: any,
  userId: string,
  req: UpdateContractStatusRequest
): Promise<{ success: boolean; data?: GigContract; error?: string }> {
  try {
    // Verify ownership
    const { data: contract, error: fetchError } = await supabase
      .from("gig_contracts")
      .select("employer_id, talent_id, status")
      .eq("id", req.contract_id)
      .single();

    if (fetchError || !contract) {
      return { success: false, error: "Contract not found" };
    }

    if (contract.employer_id !== userId && contract.talent_id !== userId) {
      return { success: false, error: "Unauthorized to update this contract" };
    }

    // Update status
    const updateData: any = { status: req.new_status };
    if (req.new_status === "active" && !contract.started_at) {
      updateData.started_at = new Date().toISOString();
    }
    if (req.new_status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("gig_contracts")
      .update(updateData)
      .eq("id", req.contract_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Add a milestone to a contract
 */
async function addMilestone(
  supabase: any,
  userId: string,
  req: AddMilestoneRequest
): Promise<{ success: boolean; data?: ContractMilestone; error?: string }> {
  try {
    // Verify contract ownership (employer)
    const { data: contract } = await supabase
      .from("gig_contracts")
      .select("employer_id")
      .eq("id", req.contract_id)
      .single();

    if (!contract || contract.employer_id !== userId) {
      return { success: false, error: "Unauthorized to add milestone" };
    }

    // Get highest sort_order
    const { data: maxMilestone } = await supabase
      .from("contract_milestones")
      .select("sort_order")
      .eq("contract_id", req.contract_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = (maxMilestone?.sort_order || 0) + 1;

    // Create milestone
    const { data: milestone, error } = await supabase
      .from("contract_milestones")
      .insert([
        {
          contract_id: req.contract_id,
          title: req.title,
          description: req.description || null,
          amount: req.amount,
          due_date: req.due_date || null,
          sort_order: nextSortOrder,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: milestone };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Update a milestone
 */
async function updateMilestone(
  supabase: any,
  userId: string,
  req: UpdateMilestoneRequest
): Promise<{ success: boolean; data?: ContractMilestone; error?: string }> {
  try {
    // Verify access
    const { data: milestone, error: fetchError } = await supabase
      .from("contract_milestones")
      .select("contract_id, status")
      .eq("id", req.milestone_id)
      .single();

    if (fetchError || !milestone) {
      return { success: false, error: "Milestone not found" };
    }

    // Check contract access
    const { data: contract } = await supabase
      .from("gig_contracts")
      .select("employer_id")
      .eq("id", milestone.contract_id)
      .single();

    if (!contract || contract.employer_id !== userId) {
      return { success: false, error: "Unauthorized to update milestone" };
    }

    if (!["pending", "revision_requested"].includes(milestone.status)) {
      return {
        success: false,
        error: "Can only update pending or revision_requested milestones",
      };
    }

    const updateData: any = {};
    if (req.title) updateData.title = req.title;
    if (req.description !== undefined) updateData.description = req.description;
    if (req.amount !== undefined) updateData.amount = req.amount;
    if (req.due_date !== undefined) updateData.due_date = req.due_date;

    const { data, error } = await supabase
      .from("contract_milestones")
      .update(updateData)
      .eq("id", req.milestone_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Submit a milestone (talent delivers work)
 */
async function submitMilestone(
  supabase: any,
  userId: string,
  req: SubmitMilestoneRequest
): Promise<{ success: boolean; data?: ContractMilestone; error?: string }> {
  try {
    // Get milestone and verify access
    const { data: milestone, error: fetchError } = await supabase
      .from("contract_milestones")
      .select("contract_id, status")
      .eq("id", req.milestone_id)
      .single();

    if (fetchError || !milestone) {
      return { success: false, error: "Milestone not found" };
    }

    // Verify talent access
    const { data: contract } = await supabase
      .from("gig_contracts")
      .select("talent_id")
      .eq("id", milestone.contract_id)
      .single();

    if (!contract || contract.talent_id !== userId) {
      return { success: false, error: "Unauthorized to submit this milestone" };
    }

    if (!["pending", "revision_requested"].includes(milestone.status)) {
      return {
        success: false,
        error: "Can only submit pending or revision_requested milestones",
      };
    }

    // Update milestone
    const { data, error } = await supabase
      .from("contract_milestones")
      .update({
        status: "submitted",
        deliverable_url: req.deliverable_url,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", req.milestone_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Approve or request revision on a milestone
 */
async function approveMilestone(
  supabase: any,
  userId: string,
  req: ApproveMilestoneRequest
): Promise<{ success: boolean; data?: ContractMilestone; error?: string }> {
  try {
    // Get milestone and verify access
    const { data: milestone, error: fetchError } = await supabase
      .from("contract_milestones")
      .select("contract_id, status")
      .eq("id", req.milestone_id)
      .single();

    if (fetchError || !milestone) {
      return { success: false, error: "Milestone not found" };
    }

    // Verify employer access
    const { data: contract } = await supabase
      .from("gig_contracts")
      .select("employer_id")
      .eq("id", milestone.contract_id)
      .single();

    if (!contract || contract.employer_id !== userId) {
      return { success: false, error: "Unauthorized to approve this milestone" };
    }

    if (!["submitted", "revision_requested"].includes(milestone.status)) {
      return {
        success: false,
        error: "Can only approve submitted milestones",
      };
    }

    const newStatus = req.approve ? "approved" : "revision_requested";
    const { data, error } = await supabase
      .from("contract_milestones")
      .update({
        status: newStatus,
        approved_at: req.approve ? new Date().toISOString() : null,
      })
      .eq("id", req.milestone_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * List contracts for the current user
 */
async function listContracts(
  supabase: any,
  userId: string,
  req: ListContractsRequest
): Promise<{
  success: boolean;
  data?: GigContract[];
  count?: number;
  error?: string;
}> {
  try {
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    let query = supabase
      .from("gig_contracts")
      .select("*", { count: "exact" })
      .or(`employer_id.eq.${userId},talent_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.status) {
      query = query.eq("status", req.status);
    }

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data, count };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Health ping for watchdog monitoring
 */
function healthPing(): { status: string; timestamp: string } {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;

    // Handle health_ping (no auth required)
    if (body.action === "health_ping") {
      return new Response(JSON.stringify(healthPing()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract authorization token
    const authHeader = req.headers.get("Authorization") || "";
    const userId = getUserIdFromToken(authHeader);

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    let response;

    switch (body.action) {
      case "create_contract":
        response = await createContract(
          supabase,
          userId,
          body as CreateContractRequest
        );
        break;

      case "update_contract_status":
        response = await updateContractStatus(
          supabase,
          userId,
          body as UpdateContractStatusRequest
        );
        break;

      case "add_milestone":
        response = await addMilestone(
          supabase,
          userId,
          body as AddMilestoneRequest
        );
        break;

      case "update_milestone":
        response = await updateMilestone(
          supabase,
          userId,
          body as UpdateMilestoneRequest
        );
        break;

      case "submit_milestone":
        response = await submitMilestone(
          supabase,
          userId,
          body as SubmitMilestoneRequest
        );
        break;

      case "approve_milestone":
        response = await approveMilestone(
          supabase,
          userId,
          body as ApproveMilestoneRequest
        );
        break;

      case "list_contracts":
        response = await listContracts(
          supabase,
          userId,
          body as ListContractsRequest
        );
        break;

      default:
        response = { success: false, error: "Unknown action" };
    }

    const statusCode = response.success ? 200 : 400;
    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in project-service:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
