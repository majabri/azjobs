// supabase/functions/gig-service/index.ts
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

      case "create_project": {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing authorization header");

        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !userData.user) throw new Error("Unauthorized");

        const userId = userData.user.id;

        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "employer")
          .single();

        if (roleError || !roleData) {
          throw new Error("Only employers can create projects");
        }

        const { data: project, error: projectError } = await supabase
          .from("projects")
          .insert({
            employer_id: userId,
            title: data.title,
            description: data.description,
            budget_min: data.budget_min,
            budget_max: data.budget_max,
            timeline_days: data.timeline_days,
            skills_required: data.skills_required || [],
            status: data.status || "open",
          })
          .select()
          .single();

        if (projectError) throw projectError;

        await supabase.from("platform_events").insert({
          event_type: "project.created",
          payload: { project_id: project.id, employer_id: userId },
          source_service: "gig-service",
        });

        return new Response(JSON.stringify(project), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 201,
        });
      }

      case "list_projects": {
        const query = supabase.from("projects").select("*");
        if (data.employer_id) query.eq("employer_id", data.employer_id);
        if (data.status) query.eq("status", data.status);
        if (data.skills && data.skills.length > 0) query.contains("skills_required", data.skills);
        query.order("created_at", { ascending: false });
        if (data.limit) query.limit(data.limit);
        if (data.offset) query.range(data.offset, data.offset + (data.limit || 10) - 1);

        const { data: projects, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify(projects), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_project": {
        const { data: project, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", data.project_id)
          .single();

        if (error) throw error;
        if (!project) throw new Error("Project not found");

        return new Response(JSON.stringify(project), {
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
        service_name: "gig-service",
        status: "degraded",
        error_message: err instanceof Error ? err.message : String(err),
        last_check: new Date().toISOString(),
      },
      { onConflict: "service_name" }
    );

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
