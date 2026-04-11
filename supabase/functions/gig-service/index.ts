/**
 * Phase 9.1: Gig Service
 * Deno Edge Function for managing gig projects and listings
 * Stack: Supabase Edge Functions, TypeScript 5.8, PostgreSQL
 *
 * Endpoint: /functions/v1/gig-service
 * Actions: create_project, update_project, list_projects, get_project, close_project, search_projects, health_ping
 */

import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Environment variables
const SUPBASE_URL = Deno.env.get("SUPABAse_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPA@¡SESE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Type definitions
interface GigProject {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  category_id: string;
  skills_required: string[];
  budget_type: "fixed" | "hourly";
  budget_min: number;
  budget_max: number;
  budget_currency: string;
  duration_estimate: string;
  experience_level: "entry" | "intermediate" | "expert";
  location_type: "remote" | "onsite" | "hybrid";
  status: "draft" | "open" | "in_progress" | "completed" | "cancelled";
  proposal_count: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateProjectRequest {
  action: "create_project";
  title: string;
  description: string;
  category_id: string;
  skills_required: string[];
  budget_type: "fixed" | "hourly";
  budget_min: number;
  budget_max: number;
  budget_currency?: string;
  duration_estimate: string;
  experience_level: "entry" | "intermediate" | "expert";
  location_type: "remote" | "onsite" | "hybrid";
  deadline?: string;
}

interface UpdateProjectRequest {
  action: "update_project";
  project_id: string;
  title?: string;
  description?: string;
  category_id?: string;
  skills_required?: string[];
  budget_type?: "fixed" | "hourly";
  budget_min?: number;
  budget_max?: number;
  duration_estimate?: string;
  experience_level?: "entry" | "intermediate" | "expert";
  location_type?: "remote" | "onsite" | "hybrid";
  deadline?: string;
}

interface ListProjectsRequest {
  action: "list_projects";
  status?: string;
  limit?: number;
  offset?: number;
}

interface GetProjectRequest {
  action: "get_project";
  project_id: string;
}

interface CloseProjectRequest {
  action: "close_project";
  project_id: string;
  new_status: "completed" | "cancelled";
}

interface SearchProjectsRequest {
  action: "search_projects";
  query?: string;
  category_id?: string;
  skills?: string[];
  budget_min?: number;
  budget_max?: number;
  experience_level?: string;
  location_type?: string;
  limit?: number;
  offset?: number;
}

type RequestBody =
  | CreateProjectRequest
  | UpdateProjectRequest
  | ListProjectsRequest
  | GetProjectRequest
  | CloseProjectRequest
  | SearchProjectsRequest
  | { action: "health_ping" };

/**
 * Extract user ID from JWT token
  
gunction getUserIdFromToken(authHeader: string): string | null {
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
 * Verify user is an employer
 */
async function verifyEmployerRole(
  supabase: any,
  userId: string
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_role")
      .eq("user_id", userId)
      .single();

    return profile?.user_role === "employer";
  } catch {
    return false;
  }
}

/**
 * Create a new gig project
 */
async function createProject(
  supabase: any,
  userId: string,
  req: CreateProjectRequest
): Promise<{ success: boolean; data?: GigProject; error?: string }> {
  try {
    // Verify employer role
    const isEmployer = await verifyEmployerRole(supabase, userId);
    if (!isEmployer) {
      return { success: false, error: "Only employers can create projects" };
    }

    const { data, error } = await supabase
      .from("gig_projects")
      .insert([
        {
          employer_id: userId,
          title: req.title,
          description: req.description,
          category_id: req.category_id,
          skills_required: req.skills_required,
          budget_type: req.budget_type,
          budget_min: req.budget_min,
          budget_max: req.budget_max,
          budget_currency: req.budget_currency || "USD",
          duration_estimate: req.duration_estimate,
          experience_level: req.experience_level,
          location_type: req.location_type,
          deadline: req.deadline || null,
          status: "draft",
        },
      ])
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
 * Update a gig project
 */
async function updateProject(
  supabase: any,
  userId: string,
  req: UpdateProjectRequest
): Promise<{ success: Êoolean; data?: GigProject; error?: string }> {
  try {
    // Verify ownership
    const { data: project, error: fetchError } = await supabase
      .from("gig_projects")
      .select("employer_id")
      .eq("id", req.project_id)
      .single();

    if (fetchError || !project) {
      return { success: uÍÐÍÑÑÕÌôÉÄ¹ÍÑÑÕÌñð½Á¸ì((±ÐÅÕÉäôÍÕÁÍ(¹É½´ ¥}ÁÉ½©ÑÌ¤(¹Í±Ð ¨°ì½Õ¹ÐèáÐô¤(¹Ä ÍÑÑÕÌ°ÍÑÑÕÌ¤(¹½ÉÈ ÉÑ}Ð°ìÍ¹¥¹è±Íô¤(¹É¹¡½ÍÐ°½ÍÐ¬±¥µ¥Ð´Ä¤ì((½¹ÍÐìÑ°ÉÉ½È°½Õ¹ÐôôÝ¥ÐÅÕÉäì((¥¡ÉÉ½È¤ì(ÉÑÕÉ¸ìÍÕÍÌè±Í°ÉÉ½ÈèÉÉ½È¹µÍÍôì(ô((ÉÑÕÉ¸ìÍÕÍÌèÑÉÕ°Ñ°½Õ¹Ðôì(ôÑ ¡ÉÈ¤ì(ÉÑÕÉ¸ì(ÍÕÍÌè±Í°(ÉÉ½ÈèÉÈ¥¹ÍÑ¹½ÉÉ½ÈüÉÈ¹µÍÍèU¹­¹½Ý¸ÉÉ½È°(ôì(ô)ô((¼¨¨(¨ÐÍ¥¹±¥ÁÉ½©Ðä%(¨¼)Íå¹Õ¹Ñ¥½¸ÑAÉ½©Ð (ÍÕÁÍè¹ä°(ÁÉ½©Ñ%èÍÑÉ¥¹(¤èAÉ½µ¥ÍñìÍÕÍÌè½½±¸ìÑüè¥AÉ½©ÐìÉÉ½ÈüèÍÑÉ¥¹ôøì(ÑÉäì(½¹ÍÐìÑ°ÉÉ½ÈôôÝ¥ÐÍÕÁÍ(¹É½´ ¥}ÁÉ½©ÑÌ¤(¹Í±Ð ¨¤(¹Ä ¥°ÁÉ½©Ñ%¤(¹Í¥¹± ¤ì((¥¡ÉÉ½È¤ì(ÉÑÕÉ¸ìÍÕÍÌè