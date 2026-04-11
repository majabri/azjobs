/**
 * Phase 10.3: Reputation Service
 * Deno Edge Function for managing reviews and reputation scores
 * Stack: Supabase Edge Functions, TypeScript 5.8, PostgreSQL
 */

import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

interface SubmitReviewRequest {
  action: "submit_review";
  reviewee_id: string;
  order_id?: string;
  contract_id?: string;
  rating: number;
  title: string;
  body: string;
}

interface GetReputationRequest {
  action: "get_reputation";
  user_id: string;
}

interface RespondToReviewRequest {
  action: "respond_to_review";
  review_id: string;
  response: string;
}

interface GetUserReviewsRequest {
  action: "get_user_reviews";
  user_id: string;
  limit?: number;
  offset?: number;
}

type RequestBody =
  | SubmitReviewRequest
  | GetReputationRequest
  | RespondToReviewRequest
  | GetUserReviewsRequest
  | { action: "health_ping" };

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

async function submitReview(
  supabase: any,
  userId: string,
  req: SubmitReviewRequest
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (req.rating < 1 || req.rating > 5) {
      return { success: false, error: "Rating must be between 1 and 5" };
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert([
        {
          reviewer_id: userId,
          reviewee_id: req.reviewee_id,
          order_id: req.order_id || null,
          contract_id: req.contract_id || null,
          rating: req.rating,
          title: req.title,
          body: req.body,
        },
      ])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function getReputation(
  supabase: any,
  userId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .rpc("get_user_reputation", { p_user_id: userId });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data[0] || null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function respondToReview(
  supabase: any,
  userId: string,
  req: RespondToReviewRequest
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Verify reviewee is responding
    const { data: review, error: fetchError } = await supabase
      .from("reviews")
      .select("reviewee_id")
      .eq("id", req.review_id)
      .single();

    if (fetchError || !review || review.reviewee_id !== userId) {
      return { success: false, error: "Unauthorized to respond to this review" };
    }

    const { data, error } = await supabase
      .from("reviews")
      .update({
        response: req.response,
        response_at: new Date().toISOString(),
      })
      .eq("id", req.review_id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function getUserReviews(
  supabase: any,
  userId: string,
  req: GetUserReviewsRequest
): Promise<{ success: boolean; data?: any[]; count?: number; error?: string }> {
  try {
    const limit = req.limit || 10;
    const offset = req.offset || 0;

    const { data, error, count } = await supabase
      .from("reviews")
      .select("*", { count: "exact" })
      .eq("reviewee_id", req.user_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data, count };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function healthPing(): { status: string; timestamp: string } {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
}

serve(async (req: Request) => {
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

    if (body.action === "health_ping") {
      return new Response(JSON.stringify(healthPing()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const userId = getUserIdFromToken(authHeader);

    let response;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    switch (body.action) {
      case "submit_review":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        response = await submitReview(supabase, userId, body as SubmitReviewRequest);
        break;

      case "get_reputation":
        response = await getReputation(supabase, (body as GetReputationRequest).user_id);
        break;

      case "respond_to_review":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        response = await respondToReview(supabase, userId, body as RespondToReviewRequest);
        break;

      case "get_user_reviews":
        response = await getUserReviews(supabase, userId || "", body as GetUserReviewsRequest);
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
    console.error("Error in reputation-service:", error);
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
