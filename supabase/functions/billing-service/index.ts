/**
 * Phase 10.2: Billing Service (Stripe Connect)
 * Deno Edge Function for payment processing and escrow management
 * Stack: Supabase Edge Functions, TypeScript 5.8, Stripe API
 *
 * Endpoint: /functions/v1/billing-service
 * Actions: create_stripe_account, create_payment_intent, handle_webhook,
 *          release_escrow, create_refund, get_balance, health_ping
 */

import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_PUBLISHABLE_KEY = Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "";

if (!STRIPE_SECRET_KEY) {
  console.error("CRITICAL: Missing STRIPE_SECRET_KEY environment variable");
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// Type definitions
interface StripeAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  account_type: "standard" | "express";
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface PaymentTransaction {
  id: string;
  order_id: string | null;
  contract_id: string | null;
  milestone_id: string | null;
  payer_id: string;
  payee_id: string;
  amount: number;
  currency: string;
  platform_fee: number | null;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  status: "pending" | "processing" | "succeeded" | "failed" | "refunded";
  type: "charge" | "release" | "refund";
  created_at: string;
  updated_at: string;
}

interface CreateStripeAccountRequest {
  action: "create_stripe_account";
  account_type: "standard" | "express";
  country?: string;
}

interface CreatePaymentIntentRequest {
  action: "create_payment_intent";
  amount: number;
  currency?: string;
  order_id?: string;
  contract_id?: string;
  description?: string;
}

interface HandleWebhookRequest {
  action: "handle_webhook";
  event: Record<string, unknown>;
}

interface ReleaseEscrowRequest {
  action: "release_escrow";
  hold_id: string;
}

interface CreateRefundRequest {
  action: "create_refund";
  transaction_id: string;
  reason?: string;
}

interface GetBalanceRequest {
  action: "get_balance";
}

type RequestBody =
  | CreateStripeAccountRequest
  | CreatePaymentIntentRequest
  | HandleWebhookRequest
  | ReleaseEscrowRequest
  | CreateRefundRequest
  | GetBalanceRequest
  | { action: "health_ping" };

/**
 * Extract user ID from JWT token
 */
function getUserIdFromToken(authHeader: string): string | null {
  try {
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Call Stripe API
 */
async function stripe(method: string, path: string, body?: Record<string, unknown>) {
  const url = `https://api.stripe.com/v1${path}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  if (body) {
    options.body = new URLSearchParams(
      Object.entries(body).map(([k, v]) => [k, String(v)])
    ).toString();
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Stripe error: ${(data as any).error?.message || "Unknown error"}`);
  }

  return data;
}

/**
 * Create a Stripe Connect account for seller onboarding
 */
async function createStripeAccount(
  supabase: any,
  userId: string,
  req: CreateStripeAccountRequest
): Promise<{ success: boolean; data?: StripeAccount; error?: string; account_link?: string }> {
  try {
    // Create Stripe connected account
    const stripeAccount = await stripe("POST", "/accounts", {
      type: req.account_type,
      country: req.country || "US",
      email: "", // Would be populated from user profile in production
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Save to database
    const { data, error } = await supabase
      .from("stripe_accounts")
      .insert([
        {
          user_id: userId,
          stripe_account_id: stripeAccount.id,
          account_type: req.account_type,
          onboarding_complete: false,
          charges_enabled: false,
          payouts_enabled: false,
        },
      ])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Create account link for onboarding
    const accountLink = await stripe("POST", "/account_links", {
      account: stripeAccount.id,
      type: "account_onboarding",
      refresh_url: `${Deno.env.get("APP_URL") || "https://example.com"}/account/stripe/refresh`,
      return_url: `${Deno.env.get("APP_URL") || "https://example.com"}/account/stripe/success`,
    });

    return {
      success: true,
      data,
      account_link: accountLink.url,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Create a payment intent for an order
 */
async function createPaymentIntent(
  supabase: any,
  userId: string,
  req: CreatePaymentIntentRequest
): Promise<{
  success: boolean;
  data?: { client_secret: string; payment_intent_id: string };
  error?: string;
}> {
  try {
    // Create Stripe payment intent
    const intent = await stripe("POST", "/payment_intents", {
      amount: Math.round(req.amount * 100), // Convert to cents
      currency: req.currency || "usd",
      description: req.description || "iCareerOS Order Payment",
      metadata: {
        order_id: req.order_id || "",
        contract_id: req.contract_id || "",
        buyer_id: userId,
      },
    });

    // Record transaction in database
    const { data: transaction, error } = await supabase
      .from("payment_transactions")
      .insert([
        {
          order_id: req.order_id || null,
          contract_id: req.contract_id || null,
          payer_id: userId,
          payee_id: null, // Will be set based on order/contract
          amount: req.amount,
          currency: req.currency || "USD",
          stripe_payment_intent_id: intent.id,
          status: "pending",
          type: "charge",
        },
      ])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        client_secret: intent.client_secret,
        payment_intent_id: intent.id,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Handle Stripe webhooks (payment.intent.succeeded, etc.)
 */
async function handleWebhook(
  supabase: any,
  eventData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const eventType = eventData.type as string;

    switch (eventType) {
      case "payment_intent.succeeded": {
        const intent = eventData.data?.object as any;
        // Update transaction status
        await supabase
          .from("payment_transactions")
          .update({ status: "succeeded" })
          .eq("stripe_payment_intent_id", intent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = eventData.data?.object as any;
        // Update transaction status
        await supabase
          .from("payment_transactions")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", intent.id);
        break;
      }

      case "account.updated": {
        const account = eventData.data?.object as any;
        // Update Stripe account status
        await supabase
          .from("stripe_accounts")
          .update({
            onboarding_complete: account.charges_enabled,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
          })
          .eq("stripe_account_id", account.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Release escrowed funds to seller
 */
async function releaseEscrow(
  supabase: any,
  holdId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get escrow hold details
    const { data: hold, error: holdError } = await supabase
      .from("escrow_holds")
      .select("*")
      .eq("id", holdId)
      .single();

    if (holdError || !hold) {
      return { success: false, error: "Escrow hold not found" };
    }

    if (hold.status !== "held") {
      return { success: false, error: "Escrow hold is not in held status" };
    }

    // Get contract/order to find seller
    let sellerId: string | null = null;
    if (hold.contract_id) {
      const { data: contract } = await supabase
        .from("gig_contracts")
        .select("talent_id")
        .eq("id", hold.contract_id)
        .single();
      sellerId = contract?.talent_id;
    } else if (hold.order_id) {
      const { data: order } = await supabase
        .from("service_orders")
        .select("seller_id")
        .eq("id", hold.order_id)
        .single();
      sellerId = order?.seller_id;
    }

    if (!sellerId) {
      return { success: false, error: "Cannot determine seller for escrow" };
    }

    // Create transfer in Stripe (if implemented)
    // For now, just mark as released in database
    const { error: updateError } = await supabase
      .rpc("release_escrow_hold", { p_hold_id: holdId });

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Create a refund
 */
async function createRefund(
  supabase: any,
  transactionId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get transaction details
    const { data: transaction, error: fetchError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchError || !transaction) {
      return { success: false, error: "Transaction not found" };
    }

    if (!transaction.stripe_payment_intent_id) {
      return { success: false, error: "Cannot refund non-stripe transaction" };
    }

    // Create refund in Stripe
    const refund = await stripe("POST", "/refunds", {
      payment_intent: transaction.stripe_payment_intent_id,
      reason: reason || "requested_by_customer",
    });

    // Record refund transaction
    await supabase.from("payment_transactions").insert([
      {
        payer_id: transaction.payee_id,
        payee_id: transaction.payer_id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: "succeeded",
        type: "refund",
        stripe_payment_intent_id: refund.id,
      },
    ]);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get seller balance
 */
async function getBalance(
  supabase: any,
  userId: string
): Promise<{
  success: boolean;
  data?: {
    available_balance: number;
    pending_balance: number;
    total_lifetime_earnings: number;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .rpc("get_seller_balance", { p_user_id: userId });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data[0] || {
        available_balance: 0,
        pending_balance: 0,
        total_lifetime_earnings: 0,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Health ping for watchdog monitoring
 */
function healthPing(): { status: string; timestamp: string } {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;

    // Handle health_ping (no auth required)
    if (body.action === "health_ping") {
      return new Response(JSON.stringify(healthPing()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract authorization token
    const authHeader = req.headers.get("Authorization") || "";
    const userId = getUserIdFromToken(authHeader);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    let response;

    switch (body.action) {
      case "create_stripe_account":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        response = await createStripeAccount(
          supabase,
          userId,
          body as CreateStripeAccountRequest
        );
        break;

      case "create_payment_intent":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        response = await createPaymentIntent(
          supabase,
          userId,
          body as CreatePaymentIntentRequest
        );
        break;

      case "handle_webhook":
        response = await handleWebhook(
          supabase,
          (body as HandleWebhookRequest).event
        );
        break;

      case "release_escrow":
        response = await releaseEscrow(
          supabase,
          (body as ReleaseEscrowRequest).hold_id
        );
        break;

      case "create_refund":
        response = await createRefund(
          supabase,
          (body as CreateRefundRequest).transaction_id,
          (body as CreateRefundRequest).reason
        );
        break;

      case "get_balance":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        response = await getBalance(supabase, userId);
        break;

      default:
        response = { success: false, error: "Unknown action" };
    }

    const statusCode = response.success ? 200 : 400;
    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in billing-service:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
