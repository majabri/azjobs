// supabase/functions/send-invite/index.ts
// POST /functions/v1/send-invite
// Creates an invitation (email or code) and optionally sends via Resend.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateInviteCode(usernamePrefix: string): string {
  const prefix = usernamePrefix.toUpperCase().slice(0, 4).padEnd(4, "X");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for readability
  let random = "";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    random += chars[b % chars.length];
  }
  return `${prefix}-${random}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Auth client to verify the caller
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { type, email } = body as { type: "email" | "code"; email?: string };

    if (!type || !["email", "code"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid invite type. Must be 'email' or 'code'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "email" && !email) {
      return new Response(
        JSON.stringify({ error: "Email is required for email-type invites." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Self-invite check
    if (type === "email" && email === user.email) {
      return new Response(
        JSON.stringify({ error: "You cannot invite yourself." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email is already a registered user
    if (type === "email") {
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "This email is already registered on iCareerOS." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for existing pending invite to this email
      const { data: pendingInvite } = await supabase
        .from("invitations")
        .select("id")
        .eq("invitee_email", email)
        .eq("status", "pending")
        .maybeSingle();

      if (pendingInvite) {
        return new Response(
          JSON.stringify({ error: "This email already has a pending invite." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check daily limit (race-condition safe via advisory lock in the RPC)
    const { data: limitCheck, error: limitError } = await supabase
      .rpc("check_and_increment_invite_limit", { p_inviter_id: user.id });

    if (limitError) {
      console.error("Limit check error:", limitError);
      return new Response(
        JSON.stringify({ error: "Failed to check invite limit." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!limitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Daily invite limit reached (5 per day).",
          invites_remaining_today: 0,
          resets_at: limitCheck.resets_at,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get inviter's username for code generation
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, full_name")
      .eq("user_id", user.id)
      .single();

    const usernamePrefix = profile?.username || profile?.full_name || "USER";
    const token = generateToken();
    const inviteCode = type === "code" ? generateInviteCode(usernamePrefix) : null;

    // Insert invitation
    const { data: invitation, error: insertError } = await supabase
      .from("invitations")
      .insert({
        inviter_id: user.id,
        invite_type: type,
        invitee_email: type === "email" ? email : null,
        token,
        invite_code: inviteCode,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via Resend if email-type invite
    if (type === "email" && resendApiKey) {
      const inviterName = profile?.full_name || profile?.username || "Someone";
      const signupUrl = `https://icareeros.com/auth/signup?invite=${token}`;

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "iCareerOS <noreply@icareeros.com>",
            to: [email],
            subject: `${inviterName} invited you to iCareerOS`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #00B8A9; font-size: 24px; margin: 0;">iCareerOS</h1>
                </div>
                <p style="font-size: 16px; color: #333;">Hi there,</p>
                <p style="font-size: 16px; color: #333;">
                  <strong>${inviterName}</strong> thinks you'd be a great fit for
                  <strong>iCareerOS</strong> &mdash; the AI-powered Career Operating System.
                </p>
                <p style="font-size: 16px; color: #333;">
                  iCareerOS is currently invite-only. Click below to claim your spot:
                </p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${signupUrl}"
                     style="background-color: #00B8A9; color: white; padding: 14px 32px;
                            border-radius: 8px; text-decoration: none; font-size: 16px;
                            font-weight: 600; display: inline-block;">
                    Join iCareerOS
                  </a>
                </div>
                <p style="font-size: 14px; color: #888;">
                  This invitation expires in 7 days.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                  &mdash; The iCareerOS Team
                </p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Resend error:", await emailResponse.text());
        }
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
        // Don't fail the invite creation â email delivery is best-effort
      }
    }

    return new Response(
      JSON.stringify({
        invitation_id: invitation.id,
        token: invitation.token,
        invite_code: invitation.invite_code,
        invites_remaining_today: limitCheck.remaining,
        expires_at: invitation.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
