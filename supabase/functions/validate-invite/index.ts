// supabase/functions/validate-invite/index.ts
// POST /functions/v1/validate-invite
// Checks if a token or invite code is valid (no auth required â used on signup page).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { token, invite_code } = body as {
      token?: string;
      invite_code?: string;
    };

    if (!token && !invite_code) {
      return new Response(
        JSON.stringify({ valid: false, reason: "No token or code provided" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up invitation
    let query = supabase
      .from("invitations")
      .select("id, inviter_id, status, expires_at, invite_type, invitee_email");

    if (token) {
      query = query.eq("token", token);
    } else {
      query = query.eq("invite_code", invite_code!.toUpperCase());
    }

    const { data: invitation, error } = await query.maybeSingle();

    if (error || !invitation) {
      return new Response(
        JSON.stringify({ valid: false, reason: "not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check status
    if (invitation.status === "accepted") {
      return new Response(
        JSON.stringify({ valid: false, reason: "already_used" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invitation.status === "revoked") {
      return new Response(
        JSON.stringify({ valid: false, reason: "revoked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      // Auto-expire
      await supabase
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      return new Response(
        JSON.stringify({ valid: false, reason: "expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invitation.status !== "pending") {
      return new Response(
        JSON.stringify({ valid: false, reason: invitation.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get inviter's display name
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("user_id", invitation.inviter_id)
      .single();

    const inviterName =
      inviterProfile?.full_name || inviterProfile?.username || "An iCareerOS member";

    return new Response(
      JSON.stringify({
        valid: true,
        invitation_id: invitation.id,
        inviter_name: inviterName,
        invite_type: invitation.invite_type,
        prefilled_email: invitation.invitee_email || null,
        expires_at: invitation.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ valid: false, reason: "server_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
