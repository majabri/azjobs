// supabase/functions/send-invite/index.ts (v2)
// POST /functions/v1/send-invite
// Creates an invitation and sends a magic link for email invites.
// The magic link uses Supabase Auth's magiclink flow so the invitee
// registers with the exact email they were invited with â no password needed.

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
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Auth client to verify the caller
    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { type, email } = body as { type: "email" | "code"; email?: string };

    if (!type || !["email", "code"].includes(type)) {
      return new Response(
        JSON.stringify({
          error: "Invalid invite type. Must be 'email' or 'code'.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (type === "email" && !email) {
      return new Response(
        JSON.stringify({ error: "Email is required for email-type invites." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Self-invite check
    if (type === "email" && email === user.email) {
      return new Response(
        JSON.stringify({ error: "You cannot invite yourself." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
          JSON.stringify({
            error: "This email is already registered on iCareerOS.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
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
          JSON.stringify({
            error: "This email already has a pending invite.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check daily limit (race-condition safe via advisory lock)
    const { data: limitCheck, error: limitError } = await supabase.rpc(
      "check_and_increment_invite_limit",
      { p_inviter_id: user.id }
    );

    if (limitError) {
      console.error("Limit check error:", limitError);
      return new Response(
        JSON.stringify({ error: "Failed to check invite limit." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!limitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Daily invite limit reached (5 per day).",
          invites_remaining_today: 0,
          resets_at: limitCheck.resets_at,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get inviter's profile for code generation and email personalization
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, full_name")
      .eq("user_id", user.id)
      .single();

    const usernamePrefix = profile?.username || profile?.full_name || "USER";
    const token = generateToken();
    const inviteCode =
      type === "code" ? generateInviteCode(usernamePrefix) : null;

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
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ===================================================================
    // MAGIC LINK FLOW: For email invites, send a magic link via Resend.
    // The link lands on /auth/signup?invite=<token>&magic=1
    // which auto-validates the invite and completes registration.
    // ===================================================================
    if (type === "email" && resendApiKey) {
      const inviterName =
        profile?.full_name || profile?.username || "Someone";

      // Build the magic link URL:
      // The token is the invite token â the signup page will validate it,
      // pre-fill the email, and use Supabase OTP to authenticate.
      const siteUrl = Deno.env.get("SITE_URL") || "https://icareeros.com";
      const magicLinkUrl = `${siteUrl}/auth/signup?invite=${token}&email=${encodeURIComponent(email!)}&magic=1`;

      try {
        // Step 1: Send a Supabase OTP to the email (creates user if needed)
        // This generates a one-time code Supabase will validate on login
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email!,
          options: {
            shouldCreateUser: true,
            data: {
              invited_via_token: token,
              invited_by: user.id,
            },
            emailRedirectTo: `${siteUrl}/auth/callback?invite=${token}`,
          },
        });

        if (otpError) {
          console.error("OTP generation error:", otpError);
          // Fall back to branded email with manual link
        }

        // Step 2: Send branded invitation email via Resend
        // (This gives us full branding control vs. the default Supabase email)
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
                  <h1 style="color: #00B8A9; font-size: 28px; margin: 0;">iCareerOS</h1>
                  <p style="color: #888; font-size: 14px; margin-top: 4px;">AI-Powered Career Operating System</p>
                </div>

                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                  <strong>${inviterName}</strong> thinks you'd be a great fit for
                  <strong>iCareerOS</strong> and has invited you to join the platform.
                </p>

                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                  Click the button below to complete your registration. No password needed &mdash;
                  you'll be signed in automatically with this email address.
                </p>

                <div style="text-align: center; margin: 36px 0;">
                  <a href="${magicLinkUrl}"
                     style="background-color: #00B8A9; color: white; padding: 16px 40px;
                            border-radius: 8px; text-decoration: none; font-size: 16px;
                            font-weight: 600; display: inline-block;">
                    Complete Registration
                  </a>
                </div>

                <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 24px 0;">
                  <p style="font-size: 13px; color: #666; margin: 0;">
                    <strong>Your email:</strong> ${email}<br/>
                    <strong>Invited by:</strong> ${inviterName}<br/>
                    <strong>Expires:</strong> 7 days from now
                  </p>
                </div>

                <p style="font-size: 13px; color: #999; line-height: 1.5;">
                  If the button doesn't work, copy and paste this link into your browser:<br/>
                  <a href="${magicLinkUrl}" style="color: #00B8A9; word-break: break-all;">${magicLinkUrl}</a>
                </p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                  You received this because ${inviterName} invited you to iCareerOS.<br/>
                  If you didn't expect this, you can safely ignore this email.
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
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
