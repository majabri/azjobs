import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ~100 years effective ban duration
const PERMANENT_BAN_DURATION = "876600h";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify the caller is an authenticated admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use the caller's JWT to verify admin role
  const callerClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  const {
    data: { user: callerUser },
    error: callerError,
  } = await callerClient.auth.getUser();
  if (callerError || !callerUser) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check if the caller is an admin
  const { data: roleData } = await callerClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerUser.id)
    .single();

  if (!roleData || roleData.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Forbidden: admin role required" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Admin client with service role for privileged operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { email, fullName, role, password, phone, username } = body;

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "email and role are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create the auth user
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password: password ? password : undefined,
        email_confirm: true,
        user_metadata: { full_name: fullName ?? "" },
      });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Insert role (trigger may have already inserted 'job_seeker'; upsert to the desired role)
    await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role } as any, { onConflict: "user_id" });

    // Insert job_seeker_profile if relevant
    if (role === "job_seeker" || role === "recruiter") {
      await adminClient
        .from("job_seeker_profiles" as any)
        .upsert({ user_id: userId, full_name: fullName ?? "", email } as any, {
          onConflict: "user_id",
        });
    }

    // Sync email, full_name, phone, and optional username into profiles table
    const profileUpdate: Record<string, unknown> = {
      email,
      full_name: fullName ?? "",
    };
    if (phone) profileUpdate.phone = phone;
    if (username) profileUpdate.username = username;

    await adminClient
      .from("profiles")
      .update(profileUpdate as any)
      .eq("user_id", userId);

    return new Response(JSON.stringify({ success: true, userId, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "delete") {
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (userId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Clean up all related database records first (non-fatal if already gone)
    await adminClient
      .from("job_seeker_profiles" as any)
      .delete()
      .eq("user_id", userId);
    await adminClient
      .from("resume_versions" as any)
      .delete()
      .eq("user_id", userId);
    await adminClient
      .from("agent_runs" as any)
      .delete()
      .eq("user_id", userId);
    await adminClient
      .from("learning_events" as any)
      .delete()
      .eq("user_id", userId);
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);
    await adminClient.from("notifications").delete().eq("user_id", userId);
    await adminClient.from("job_applications").delete().eq("user_id", userId);
    await adminClient.from("analysis_history").delete().eq("user_id", userId);
    await adminClient.from("email_preferences").delete().eq("user_id", userId);
    await adminClient.from("outreach_contacts").delete().eq("user_id", userId);
    await adminClient.from("interview_sessions").delete().eq("user_id", userId);
    await adminClient.from("ignored_jobs").delete().eq("user_id", userId);
    await adminClient.from("offers").delete().eq("user_id", userId);
    await adminClient
      .from("scraped_jobs" as any)
      .delete()
      .eq("user_id", userId);

    // Try to delete the auth user; ignore "not found" (already gone)
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);
    if (
      deleteError &&
      !deleteError.message?.toLowerCase().includes("not found")
    ) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "update") {
    const { userId, email: newEmail, fullName, phone } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = {};
    if (newEmail) updates.email = newEmail;
    if (fullName !== undefined) {
      // Fetch existing metadata so we don't wipe other fields (e.g. must_set_password)
      const { data: existingUser } =
        await adminClient.auth.admin.getUserById(userId);
      const existingMeta = existingUser?.user?.user_metadata ?? {};
      updates.user_metadata = { ...existingMeta, full_name: fullName };
    }

    if (Object.keys(updates).length === 0 && phone === undefined) {
      return new Response(JSON.stringify({ error: "Nothing to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } =
        await adminClient.auth.admin.updateUserById(userId, updates);
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Sync fields to profiles table
    const profileUpdate: Record<string, unknown> = {};
    if (newEmail) profileUpdate.email = newEmail;
    if (fullName !== undefined) profileUpdate.full_name = fullName;
    if (phone !== undefined) profileUpdate.phone = phone;

    if (Object.keys(profileUpdate).length > 0) {
      await adminClient
        .from("profiles")
        .update(profileUpdate as any)
        .eq("user_id", userId);
    }

    // Also sync email and fullName in job_seeker_profiles if present
    const jspUpdate: Record<string, unknown> = {};
    if (newEmail) jspUpdate.email = newEmail;
    if (fullName !== undefined) jspUpdate.full_name = fullName;

    if (Object.keys(jspUpdate).length > 0) {
      await adminClient
        .from("job_seeker_profiles" as any)
        .update(jspUpdate as any)
        .eq("user_id", userId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Ban / disable user ──────────────────────────────────────────────────
  if (action === "ban") {
    const { userId } = body;
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: "Cannot disable your own account" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const { error: banError } = await adminClient.auth.admin.updateUserById(
      userId,
      {
        ban_duration: PERMANENT_BAN_DURATION,
      },
    );
    if (banError) {
      return new Response(JSON.stringify({ error: banError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ success: true, message: "User has been disabled" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Promote user to admin ───────────────────────────────────────────────
  if (action === "promote_admin") {
    const { userId } = body;
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id" });
    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ success: true, message: "User promoted to admin" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
