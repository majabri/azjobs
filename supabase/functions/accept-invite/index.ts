// supabase/functions/accept-invite/index.ts
// POST /functions/v1/accept-invite
// Called after signup to mark the invitation as accepted and build the referral tree.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user
    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      },
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { token, invite_code } = body as {
      token?: string;
      invite_code?: string;
    };

    // Use the database RPC for atomic acceptance
    const { data: result, error: rpcError } = await supabase.rpc(
      "accept_invitation",
      {
        p_token: token || null,
        p_invite_code: invite_code || null,
        p_new_user_id: user.id,
      },
    );

    if (rpcError) {
      console.error("Accept invite RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: "Failed to accept invitation." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notification email to inviter (best-effort)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && result.inviter_id) {
      try {
        const { data: inviter } = await supabase
          .from("profiles")
          .select("full_name, username")
          .eq("user_id", result.inviter_id)
          .single();

        const { data: inviterAuth } = await supabase.auth.admin.getUserById(
          result.inviter_id,
        );

        const { data: newUserProfile } = await supabase
          .from("profiles")
          .select("full_name, username")
          .eq("user_id", user.id)
          .single();

        // Count total accepted invites for this inviter
        const { count } = await supabase
          .from("invitations")
          .select("id", { count: "exact", head: true })
          .eq("inviter_id", result.inviter_id)
          .eq("status", "accepted");

        const inviteeName =
          newUserProfile?.full_name || newUserProfile?.username || "Someone";
        const inviterEmail = inviterAuth?.user?.email;

        if (inviterEmail) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "iCareerOS <noreply@icareeros.com>",
              to: [inviterEmail],
              subject: "Your invite was accepted!",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                  <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="color: #3B5BDB; font-size: 24px; margin: 0;">iCareerOS</h1>
                  </div>
                  <p style="font-size: 16px; color: #333;">
                    Great news &mdash; <strong>${inviteeName}</strong> just joined iCareerOS
                    using your invitation!
                  </p>
                  <p style="font-size: 16px; color: #333;">
                    You've now invited <strong>${count || 1}</strong> people to the platform.
                    Keep spreading the word!
                  </p>
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="https://icareeros.com/invite"
                       style="background-color: #3B5BDB; color: white; padding: 14px 32px;
                              border-radius: 8px; text-decoration: none; font-size: 16px;
                              font-weight: 600; display: inline-block;">
                      Send More Invites
                    </a>
                  </div>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
                  <p style="font-size: 12px; color: #aaa; text-align: center;">
                    &mdash; The iCareerOS Team
                  </p>
                </div>
              `,
            }),
          });
        }
      } catch (emailErr) {
        console.error("Notification email failed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        referral_code: result.referral_code,
        depth: result.depth,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
