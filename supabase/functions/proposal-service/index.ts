// supabase/functions/proposal-service/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.message.includes("timeout") ||
        lastError.message.includes("ECONNREFUSED") ||
        lastError.message.includes("ECONNRESET") ||
        lastError.message.includes("network");

      if (!isRetryable || attempt === MAX_RETRIES - 1) break;

      const delayMs = RETRY_DELAYS[attempt];
      console.log(`${operationName} failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error("Operation failed after retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, ...data } = await req.json();

    switch (action) {
      case "health": {
        return new Response(JSON.stringify({ status: "healthy" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "submit_proposal": {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing authorization header");

        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !userData.user) throw new Error("Unauthorized");

        const talentId = userData.user.id;

        const { data: roleData } = await supabase
          .from("user_roles").select("role")
          .eq("user_id", talentId).eq("role", "talent").single();
        if (!roleData) throw new Error("Only talents can submit proposals");

        const { data: project } = await supabase
          .from("projects").select("id, status")
          .eq("id", data.project_id).single();
        if (!project) throw new Error("Project not found");
        if (project.status !== "open") throw new Error("Project is not accepting proposals");

        const { data: existing } = await supabase
          .from("project_proposals").select("id")
          .eq("project_id", data.project_id).eq("talent_id", talentId)
          .eq("status", "pending").maybeSingle();
        if (existing) throw new Error("You have already submitted a proposal for this project");

        const proposal = await executeWithRetry(async () => {
          const { data: result, error } = await supabase
            .from("project_proposals")
            .insert({
              project_id: data.project_id,
              talent_id: talentId,
              price: data.price,
              timeline_days: data.timeline_days,
              cover_message: data.cover_message,
              status: "pending",
            })
            .select().single();
          if (error) throw error;
          return result;
        }, "create_proposal");

        supabase.from("platform_events").insert({
          event_type: "proposal.submitted",
          payload: { proposal_id: proposal.id, project_id: data.project_id, talent_id: talentId },
          source_service: "proposal-service",
        }).catch((err) => console.error("Event publish failed:", err));

        return new Response(JSON.stringify(proposal), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 201,
        });
      }

      case "accept_proposal": {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing authorization header");
        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !userData.user) throw new Error("Unauthorized");

        const { data: proposal } = await supabase
          .from("project_proposals")
          .select("*, projects(employer_id)")
          .eq("id", data.proposal_id).single();

        if (!proposal) throw new Error("Proposal not found");
        if (proposal.projects.employer_id !== userData.user.id) throw new Error("Not your proposal");
        if (proposal.status !== "pending") throw new Error("Can only accept pending proposals");

        const updated = await executeWithRetry(async () => {
          const { data: result, error } = await supabase
            .from("project_proposals")
            .update({ status: "accepted" })
            .eq("id", data.proposal_id).select().single();
          if (error) throw error;
          return result;
        }, "accept_proposal");

        supabase.from("platform_events").insert({
          event_type: "proposal.accepted",
          payload: { proposal_id: data.proposal_id, project_id: proposal.project_id },
          source_service: "proposal-service",
        }).catch((err) => console.error("Event publish failed:", err));

        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_proposals": {
        const query = supabase.from("project_proposals").select("*");
        if (data.project_id) query.eq("project_id", data.project_id);
        if (data.talent_id) query.eq("talent_id", data.talent_id);
        if (data.status) query.eq("status", data.status);
        query.order("created_at", { ascending: false });
        if (data.limit) query.limit(data.limit);

        const { data: proposals, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify(proposals), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("Error:", err);

    await supabase.from("service_health").upsert(
      {
        service_name: "proposal-service",
        status: "degraded",
        error_message: err instanceof Error ? err.message : String(err),
        last_check: new Date().toISOString(),
      },
      { onConflict: "service_name" }
    );

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
