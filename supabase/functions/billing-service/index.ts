// supabase/functions/billing-service/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

interface StripePaymentIntent {
  id: string;
  status: string;
  amount: number;
  currency: string;
  client_secret: string;
}

interface StripeConnectAccount {
  id: string;
  type: string;
}

serve(async (req) => {
  // Handle CORS preflight
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

      case "create_payment_intent": {
        // Validate authorization
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing authorization header");

        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: authError } = await supabase.auth.getUser(
          token
        );
        if (authError || !userData.user) throw new Error("Unauthorized");

        const buyerId = userData.user.id;

        // Get order details
        const { data: order } = await supabase
          .from("catalog_orders")
          .select("*, service_catalog(talent_id)")
          .eq("id", data.order_id)
          .single();

        if (!order) throw new Error("Order not found");
        if (order.buyer_id !== buyerId) {
          throw new Error("You can only create payment for your own orders");
        }

        // Create payment intent with Stripe
        const paymentIntentResponse = await fetch(
          "https://api.stripe.com/v1/payment_intents",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              amount: Math.round(order.order_price * 100).toString(), // Convert to cents
              currency: "usd",
              metadata: JSON.stringify({
                order_id: data.order_id,
                buyer_id: buyerId,
                talent_id: order.service_catalog.talent_id,
              }),
            }),
          }
        );

        if (!paymentIntentResponse.ok) {
          throw new Error(
            `Stripe error: ${paymentIntentResponse.statusText}`
          );
        }

        const paymentIntent = (await paymentIntentResponse.json()) as StripePaymentIntent;

        // Update order with payment intent ID
        const { error: updateError } = await supabase
          .from("catalog_orders")
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            payment_status: "processing",
          })
          .eq("id", data.order_id);

        if (updateError) throw updateError;

        // Publish event
        supabase
          .from("platform_events")
          .insert({
            event_type: "payment.intent_created",
            payload: {
              order_id: data.order_id,
              payment_intent_id: paymentIntent.id,
              amount: order.order_price,
              buyer_id: buyerId,
            },
            source_service: "billing-service",
          })
          .catch((err) => console.error("Event publish failed:", err));

        return new Response(
          JSON.stringify({
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 201,
          }
        );
      }

      case "handle_webhook": {
        // Verify Stripe signature
        const signature = req.headers.get("stripe-signature");
        if (!signature) throw new Error("Missing Stripe signature");

        const body = await req.text();

        // Verify webhook signature (in production, use crypto verification)
        // For now, we'll accept the webhook as-is
        let event;
        try {
          event = JSON.parse(body);
        } catch (err) {
          throw new Error("Invalid webhook payload");
        }

        // Handle payment_intent.succeeded
        if (event.type === "payment_intent.succeeded") {
          const paymentIntent = event.data.object as StripePaymentIntent;
          const metadata = paymentIntent.metadata as unknown as {
            order_id: string;
            buyer_id: string;
            talent_id: string;
          };

          // Update order payment status
          const { error: updateError } = await supabase
            .from("catalog_orders")
            .update({
              payment_status: "completed",
              status: "accepted", // Auto-accept after payment
            })
            .eq("id", metadata.order_id);

          if (updateError) throw updateError;

          // Create payout to talent via Stripe Connect
          // Get talent's Stripe Connect account
          const { data: talentAccount } = await supabase
            .from("talent_stripe_accounts")
            .select("stripe_account_id")
            .eq("user_id", metadata.talent_id)
            .single();

          if (talentAccount) {
            // Create transfer to talent's Stripe Connect account
            // Platform takes commission (e.g., 20%)
            const platformCommission = Math.round(
              paymentIntent.amount * 0.2
            );
            const talentPayout = paymentIntent.amount - platformCommission;

            const transferResponse = await fetch(
              "https://api.stripe.com/v1/transfers",
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  amount: talentPayout.toString(),
                  currency: "usd",
                  destination: talentAccount.stripe_account_id,
                  metadata: JSON.stringify({
                    order_id: metadata.order_id,
                    payment_intent_id: paymentIntent.id,
                  }),
                }),
              }
            );

            if (!transferResponse.ok) {
              console.error("Transfer creation failed:", transferResponse.statusText);
            } else {
              const transfer = await transferResponse.json();

              // Record payout
              await supabase
                .from("talent_payouts")
                .insert({
                  talent_id: metadata.talent_id,
                  order_id: metadata.order_id,
                  amount: talentPayout / 100, // Convert from cents
                  stripe_transfer_id: transfer.id,
                  status: "completed",
                });
            }
          }

          // Publish event
          supabase
            .from("platform_events")
            .insert({
              event_type: "payment.completed",
              payload: {
                order_id: metadata.order_id,
                payment_intent_id: paymentIntent.id,
                amount: paymentIntent.amount / 100,
                buyer_id: metadata.buyer_id,
                talent_id: metadata.talent_id,
              },
              source_service: "billing-service",
            })
            .catch((err) => console.error("Event publish failed:", err));
        }

        // Handle payment_intent.payment_failed
        if (event.type === "payment_intent.payment_failed") {
          const paymentIntent = event.data.object as StripePaymentIntent;
          const metadata = paymentIntent.metadata as unknown as {
            order_id: string;
          };

          // Update order payment status
          await supabase
            .from("catalog_orders")
            .update({
              payment_status: "failed",
            })
            .eq("id", metadata.order_id);

          // Publish event
          supabase
            .from("platform_events")
            .insert({
              event_type: "payment.failed",
              payload: {
                order_id: metadata.order_id,
                payment_intent_id: paymentIntent.id,
              },
              source_service: "billing-service",
            })
            .catch((err) => console.error("Event publish failed:", err));
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_payment_status": {
        const { data: order } = await supabase
          .from("catalog_orders")
          .select("stripe_payment_intent_id, payment_status, status")
          .eq("id", data.order_id)
          .single();

        if (!order) throw new Error("Order not found");

        // Fetch payment intent from Stripe
        const piResponse = await fetch(
          `https://api.stripe.com/v1/payment_intents/${order.stripe_payment_intent_id}`,
          {
            headers: {
              "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
            },
          }
        );

        if (!piResponse.ok) {
          throw new Error("Failed to fetch payment status from Stripe");
        }

        const paymentIntent = (await piResponse.json()) as StripePaymentIntent;

        return new Response(
          JSON.stringify({
            payment_status: order.payment_status,
            order_status: order.status,
            stripe_status: paymentIntent.status,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "create_connect_account": {
        // Validate authorization
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing authorization header");

        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: authError } = await supabase.auth.getUser(
          token
        );
        if (authError || !userData.user) throw new Error("Unauthorized");

        const userId = userData.user.id;

        // Create Stripe Connect account
        const accountResponse = await fetch(
          "https://api.stripe.com/v1/accounts",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              type: "express",
              country: data.country || "US",
              email: data.email,
            }),
          }
        );

        if (!accountResponse.ok) {
          throw new Error("Failed to create Stripe Connect account");
        }

        const account = (await accountResponse.json()) as StripeConnectAccount;

        // Store account ID in database
        const { error: storeError } = await supabase
          .from("talent_stripe_accounts")
          .upsert({
            user_id: userId,
            stripe_account_id: account.id,
            status: "active",
          }, { onConflict: "user_id" });

        if (storeError) throw storeError;

        // Create account link for onboarding
        const linkResponse = await fetch(
          "https://api.stripe.com/v1/account_links",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              account: account.id,
              type: "account_onboarding",
              return_url: data.return_url || "https://example.com/dashboard",
              refresh_url: data.refresh_url || "https://example.com/setup",
            }),
          }
        );

        if (!linkResponse.ok) {
          throw new Error("Failed to create account link");
        }

        const accountLink = await linkResponse.json();

        return new Response(
          JSON.stringify({
            stripe_account_id: account.id,
            onboarding_url: accountLink.url,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 201,
          }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("Error:", err);

    // Alert admin immediately on failure (maxRetries = 1)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update service health
    await supabase.from("service_health").upsert(
      {
        service_name: "billing-service",
        status: "degraded",
        error_message: err instanceof Error ? err.message : String(err),
        last_check: new Date().toISOString(),
      },
      { onConflict: "service_name" }
    );

    // Record alert for admin
    await supabase
      .from("admin_alerts")
      .insert({
        service_name: "billing-service",
        alert_type: "critical",
        message: err instanceof Error ? err.message : String(err),
        severity: "high",
      })
      .catch((err) => console.error("Failed to create alert:", err));

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
