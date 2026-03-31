/**
 * ============================================================
 *  ⚠️  DELETE THIS FUNCTION AFTER FIRST USE  ⚠️
 *
 *  Bootstrap the very first admin account when no admin exists.
 *  Once an admin row is present in user_roles, this function
 *  permanently refuses to run (returns 403).
 * ============================================================
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-token",
};

/** Generate a cryptographically random password (base64url, 24 bytes → 32 chars). */
function generateTempPassword(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  // base64url encode without padding
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 1. Validate bootstrap token ──────────────────────────
  const BOOTSTRAP_TOKEN = Deno.env.get("BOOTSTRAP_TOKEN");
  if (!BOOTSTRAP_TOKEN) {
    return new Response(
      JSON.stringify({ error: "BOOTSTRAP_TOKEN not configured on server." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const clientToken = req.headers.get("x-bootstrap-token") ?? "";
  if (clientToken !== BOOTSTRAP_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 2. Build service-role client ─────────────────────────
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 3. Check if ANY admin already exists ─────────────────
  const { count, error: countErr } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (countErr) {
    return new Response(JSON.stringify({ error: "DB error checking admins." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if ((count ?? 0) > 0) {
    // ⚠️ An admin already exists – permanently refuse.
    return new Response(
      JSON.stringify({ error: "Admin already exists. Bootstrap disabled." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── 4. Create (or reclaim) the admin user ─────────────────
  const email = "amir.jabri@icloud.com";
  const username = "azadmin";
  const tempPassword = generateTempPassword();

  let userId: string;

  const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { must_set_password: true },
  });

  if (createErr) {
    if (createErr.message.includes("already been registered")) {
      // User exists in auth — look them up and update password + metadata
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find((u: { email?: string }) => u.email === email);
      if (!existing) {
        return new Response(
          JSON.stringify({ error: "User reported as existing but not found." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = existing.id;
      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
        password: tempPassword,
        email_confirm: true,
        user_metadata: { must_set_password: true },
      });
      if (updateErr) {
        return new Response(
          JSON.stringify({ error: `Failed to update existing user: ${updateErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } else {
    userId = userData.user.id;
  }

  // ── 5. Upsert profile ───────────────────────────────────
  const { error: profileErr } = await supabase
    .from("profiles")
    .upsert(
      { user_id: userId, username, email, full_name: "Admin" },
      { onConflict: "user_id" },
    );

  if (profileErr) {
    console.error("Profile upsert failed (non-fatal):", profileErr.message);
  }

  // ── 6. Upsert admin role ────────────────────────────────
  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  if (roleErr) {
    return new Response(
      JSON.stringify({ error: `Failed to set admin role: ${roleErr.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── 7. Return credentials (one-time only) ───────────────
  // DO NOT log the password.
  console.log("Bootstrap: first admin created successfully.");

  return new Response(
    JSON.stringify({
      ok: true,
      email,
      username,
      tempPassword,
      message: "Admin created. Login at /admin/login with username 'azadmin'. You will be forced to change your password. DELETE THIS FUNCTION AFTER FIRST USE.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
