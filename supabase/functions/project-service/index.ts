// supabase/functions/project-service/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

      case "create_contract": {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing authorization header");
        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !userData.user) throw new Error("Unauthorized");

        const employerId = userData.user.id;

        const { data: proposal } = await supabase
          .from("project_proposals")
          .select("*, projects(employer_id)")
          .eq("id", data.proposal_id).single();

        if (!proposal) throw new Error("Proposal not found");
        if (proposal.projects.employer_id !== employerId) throw new Error("Not your proposal");
        if (proposal.status !== "accepted") throw new Error("Can only create contracts from accepted proposals");

        const { data: contract, error: contractError } = await supabase
          .from("contracts")
          .insert({
            project_id: proposal.project_id,
            proposal_id: data.proposal_id,
            employer_id: employerId,
            talent_id: proposal.talent_id,
            agreed_price: proposal.price,
            agreed_timeline_days: proposal.timeline_days,
            status: "active",
          })
          .select().single();

        if (contractError) throw contractError;

        await supabase.from("projects")
          .update({ status: "in_progress" })
          .eq("id", proposal.project_id);

        supabase.from("platform_events").insert({
          event_type: "contract.created",
          payload: { contract_id: contract.id, project_id: proposal.project_id },
          source_service: "project-service",
        }).catch((err) => console.error("Event publish failed:", err));

        return new Response(JSON.stringify(contract), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 201,
        });
      }

      case "create_milestone": {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing authorization header");
        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !userData.user) throw new Error("Unauthorized");

        const { data: contract } = await supabase
          .from("contracts").select("*")
          .eq("id", data.contract_id).single();

        if (!contract) throw new Error("Contract not found");
        if (contract.employer_id !== userData.user.id) throw new Error("Only employer can create milestones");

        const { data: milestone, error } = await supabase
          .from("milestones")
          .insert({
            contract_id: data.contract_id,
            title: data.title,
            description: data.description,
            amount: data.amount,
            due_date: data.due_date,
            status: "pending",
          })
          .select().single();

        if (error) throw error;

        supabase.from("platform_events").insert({
          event_type: "milestone.created",
          payload: { milestone_id: milestone.id, contract_id: data.contract_id },
          source_service: "project-service",
        }).catch((err) => console.error("Event publish failed:", err));

        return new Response(JSON.stringify(milestone), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 201,
        });
      }

      case "update_milestone_status": {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing authorization header");
        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !userData.user) throw new Error("Unauthorized");

        const { data: milestone } = await supabase
          .from("milestones").select("*, contracts(*)")
          .eq("id", data.milestone_id).single();

        if (!milestone) throw new Error("Milestone not found");
        const contract = milestone.contracts;
        if (contract.employer_id !== userData.user.id && contract.talent_id !== userData.user.id) {
          throw new Error("You are not a party to this contract");
        }
        if (data.status === "completed" && contract.employer_id !== userData.user.id) {
          throw new Error("Only employer can mark milestone as completed");
        }

        const { data: updated, error } = await supabase
          .from("milestones")
          .update({ status: data.status })
          .eq("id", data.milestone_id).select().single();

        if (error) throw error;

        supabase.from("platform_events").insert({
          event_type: "milestone.status_changed",
          payload: { milestone_id: data.milestone_id, new_status: data.status },
          source_service: "project-service",
        }).catch((err) => console.error("Event publish failed:", err));

        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_contracts": {
        const query = supabase.from("contracts").select("*");
        if (data.employer_id) query.eq("employer_id", data.employer_id);
        if (data.talent_id) query.eq("talent_id", data.talent_id);
        if (data.status) query.eq("status", data.status);
        query.order("created_at", { ascending: false });
        if (data.limit) query.limit(data.limit);

        const { data: contracts, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify(contracts), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_milestones": {
        const query = supabase.from("milestones").select("*");
        if (data.contract_id) query.eq("contract_id", data.contract_id);
        if (data.status) query.eq("status", data.status);
        query.order("due_date", { ascending: true });
        if (data.limit) query.limit(data.limit);

        const { data: milestones, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify(milestones), {
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
        service_name: "project-service",
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
