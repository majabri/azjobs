/**
 * Phase 9.2: Proposal Service
 * Deno Edge Function for managing gig proposals
 * Stack: Supabase Edge Functions, TypeScript 5.8, PostgreSQL
 *
 * Endpoint: /functions/v1/proposal-service
 * Actions: submit_proposal, list_proposals, update_proposal_status, withdraw_proposal, health_ping
 */

import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Type definitions
interface GigProposal {
  id: string;
  project_id: string;
  talent_id: string;
  cover_letter: string;
  proposed_rate: number;
  proposed_timeline: string;
  portfolio_links: string[];
  status: "pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
  fit_score: number | null;
  ai_analysis: Record<string, unknown> | null;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SubmitProposalRequest {
  action: "submit_proposal";
  project_id: string;
  cover_letter: string;
  proposed_rate: number;
  proposed_timeline: string;
  portfolio_links?: string[];
}

interface ListProposalsRequest {
  action: "list_proposals";
  project_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

interface UpdateProposalStatusRequest {
  action: "update_proposal_status";
  proposal_id: string;
  new_status: "shortlisted" | "accepted" | "rejected" | "withdrawn";
}

interface WithdrawProposalRequest {
  action: "withdraw_proposal";
  proposal_id: string;
}

type RequestBody =
  | SubmitProposalRequest
  | ListProposalsRequest
  | UpdateProposalStatusRequest
  | WithdrawProposalRequest
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
 * Verify user is a talent
 */
async function verifyTalentRole(
  supabase: any,
  userId: string
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_role")
      .eq("user_id", userId)
      .single();

    return profile?.user_role === "talent";
  } catch {
    return false;
  }
}

/**
 * Calculate AI fit score based on skills match and experience
 * This is a simple implementation; in production, integrate with ML model
 */
async function calculateFitScore(
  supabase: any,
  talentId: string,
  projectId: string
): Promise<{ fit_score: number; ai_analysis: Record<string, unknown> }> {
  try {
    // Get talent profile and skills
    const { data: talent } = await supabase
      .from("user_profiles")
      .select("skills, experience_level")
      .eq("user_id", talentId)
      .single();

    // Get project requirements
    const { data: project } = await supabase
      .from("gig_projects")
      .select("skills_required, experience_level")
      .eq("id", projectId)
      .single();

    let skillsMatch = 0;
    let experienceMatch = 0;

    // Calculate skills match
    if (talent?.skills && project?.skills_required) {
      const talentSkillsSet = new Set(
        (talent.skills as string[]).map((s) => s.toLowerCase())
      );
      const requiredSkillsSet = new Set(
        (project.skills_required as string[]).map((s) => s.toLowerCase())
      );

      let matches = 0;
      for (const skill of requiredSkillsSet) {
        if (talentSkillsSet.has(skill)) matches++;
      }

      skillsMatch = requiredSkillsSet.size > 0 ? matches / requiredSkillsSet.size : 0.5;
    }

    // Calculate experience match
    const experienceLevels = ["entry", "intermediate", "expert"];
    const talentLevel = experienceLevels.indexOf(talent?.experience_level || "entry");
    const projectLevel = experienceLevels.indexOf(project?.experience_level || "entry");

    // Perfect match: 100%, one level off: 80%, two levels off: 60%, mismatched: 40%
    if (talentLevel === projectLevel) {
      experienceMatch = 1.0;
    } else if (Math.abs(talentLevel - projectLevel) === 1) {
      experienceMatch = 0.8;
    } else if (Math.abs(talentLevel - projectLevel) === 2) {
      experienceMatch = 0.6;
    } else {
      experienceMatch = 0.4;
    }

    // Weighted fit score (60% skills, 40% experience)
    const fitScore = skillsMatch * 0.6 + experienceMatch * 0.4;
    const fitScorePercent = Math.round(fitScore * 100);

    return {
      fit_score: fitScorePercent,
      ai_analysis: {
        skills_match: Math.round(skillsMatch * 100),
        experience_match: Math.round(experienceMatch * 100),
        overall_fit: fitScorePercent,
        calculated_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error calculating fit score:", error);
    return {
      fit_score: 50,
      ai_analysis: {
        error: "Fit score calculation failed",
        calculated_at: new Date().toISOString(),
      },
    };
  }
}

/**
 * Submit a proposal to a gig project
 * Includes queue retry logic for notification delivery
 */
async function submitProposal(
  supabase: any,
  userId: string,
  req: SubmitProposalRequest
): Promise<{ success: boolean; data?: GigProposal; error?: string }> {
  try {
    // Verify talent role
    const isTalent = await verifyTalentRole(supabase, userId);
    if (!isTalent) {
      return { success: false, error: "Only talent can submit proposals" };
    }

    // Validate cover letter length (min 50 chars)
    if (req.cover_letter.trim().length < 50) {
      return {
        success: false,
        error: "Cover letter must be at least 50 characters",
      };
    }

    // Check if project exists
    const { data: project, error: projectError } = await supabase
      .from("gig_projects")
      .select("id, status")
      .eq("id", req.project_id)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Project not found" };
    }

    if (project.status !== "open") {
      return { success: false, error: "Project is not accepting proposals" };
    }

    // Check if talent already has a pending proposal for this project
    const { data: existingProposal } = await supabase
      .from("gig_proposals")
      .select("id")
      .eq("project_id", req.project_id)
      .eq("talent_id", userId)
      .eq("status", "pending")
      .single();

    if (existingProposal) {
      return {
        success: false,
        error: "You already have a pending proposal for this project",
      };
    }

    // Calculate AI fit score
    const { fit_score, ai_analysis } = await calculateFitScore(
      supabase,
      userId,
      req.project_id
    );

    // Insert proposal
    const { data: proposal, error: insertError } = await supabase
      .from("gig_proposals")
      .insert([
        {
          project_id: req.project_id,
          talent_id: userId,
          cover_letter: req.cover_letter,
          proposed_rate: req.proposed_rate,
          proposed_timeline: req.proposed_timeline,
          portfolio_links: req.portfolio_links || [],
          fit_score,
          ai_analysis,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    // Add to proposal queue for notification delivery (retry with exponential backoff)
    const { error: queueError } = await supabase
      .from("proposal_queue")
      .insert([
        {
          proposal_id: proposal.id,
          status: "pending",
          retry_count: 0,
          max_retries: 3,
          next_retry_at: new Date().toISOString(),
        },
      ]);

    if (queueError) {
      console.error("Failed to queue proposal notification:", queueError);
      // Don't fail the whole operation if queue fails
    }

    return { success: true, data: proposal };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * List proposals for a project (employer) or by talent
 */
async function listProposals(
  supabase: any,
  userId: string,
  req: ListProposalsRequest
): Promise<{
  success: boolean;
  data?: GigProposal[];
  count?: number;
  error?: string;
}> {
  try {
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    let query = supabase
      .from("gig_proposals")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // If project_id is provided, verify employer owns project
    if (req.project_id) {
      const { data: project } = await supabase
        .from("gig_projects")
        .select("employer_id")
        .eq("id", req.project_id)
        .single();

      if (!project || project.employer_id !== userId) {
        return {
          success: false,
          error: "Unauthorized to view proposals for this project",
        };
      }

      query = query.eq("project_id", req.project_id);
    } else {
      // Default: return user's own proposals (talent view)
      query = query.eq("talent_id", userId);
    }

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
 * Update proposal status (employer action)
 */
async function updateProposalStatus(
  supabase: any,
  userId: string,
  req: UpdateProposalStatusRequest
): Promise<{ success: boolean; data?: GigProposal; error?: string }> {
  try {
    // Get proposal and verify employer owns project
    const { data: proposal, error: fetchError } = await supabase
      .from("gig_proposals")
      .select("project_id, status")
      .eq("id", req.proposal_id)
      .single();

    if (fetchError || !proposal) {
      return { success: false, error: "Proposal not found" };
    }

    const { data: project } = await supabase
      .from("gig_projects")
      .select("employer_id")
      .eq("id", proposal.project_id)
      .single();

    if (!project || project.employer_id !== userId) {
      return { success: false, error: "Unauthorized to update this proposal" };
    }

    // Update proposal status
    const { data, error } = await supabase
      .from("gig_proposals")
      .update({
        status: req.new_status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.proposal_id)
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
 * Withdraw a proposal (talent action)
 */
async function withdrawProposal(
  supabase: any,
  userId: string,
  proposalId: string
): Promise<{ success: boolean; data?: GigProposal; error?: string }> {
  try {
    // Verify ownership
    const { data: proposal, error: fetchError } = await supabase
      .from("gig_proposals")
      .select("talent_id, status")
      .eq("id", proposalId)
      .single();

    if (fetchError || !proposal) {
      return { success: false, error: "Proposal not found" };
    }

    if (proposal.talent_id !== userId) {
      return { success: false, error: "Unauthorized to withdraw this proposal" };
    }

    if (!["pending", "shortlisted"].includes(proposal.status)) {
      return {
        success: false,
        error: `Cannot withdraw proposal with status: ${proposal.status}`,
      };
    }

    // Update status to withdrawn
    const { data, error } = await supabase
      .from("gig_proposals")
      .update({ status: "withdrawn" })
      .eq("id", proposalId)
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
      case "submit_proposal":
        response = await submitProposal(
          supabase,
          userId,
          body as SubmitProposalRequest
        );
        break;

      case "list_proposals":
        response = await listProposals(
          supabase,
          userId,
          body as ListProposalsRequest
        );
        break;

      case "update_proposal_status":
        response = await updateProposalStatus(
          supabase,
          userId,
          body as UpdateProposalStatusRequest
        );
        break;

      case "withdraw_proposal":
        response = await withdrawProposal(
          supabase,
          userId,
          (body as WithdrawProposalRequest).proposal_id
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
    console.error("Error in proposal-service:", error);
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
