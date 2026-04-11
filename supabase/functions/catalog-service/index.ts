/**
 * Phase 10.1: Catalog Service
 * Deno Edge Function for managing service catalog and orders
 * Stack: Supabase Edge Functions, TypeScript 5.8, PostgreSQL
 *
 * Endpoint: /functions/v1/catalog-service
 * Actions: create_listing, update_listing, list_listings, get_listing, place_order,
 *          update_order_status, deliver_order, complete_order, search_catalog, health_ping
 */

import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

// Type definitions
interface ServiceListing {
  id: string;
  talent_id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  tags: string[];
  pricing_type: "fixed" | "tiered";
  base_price: number;
  currency: string;
  delivery_days: number;
  revisions_included: number;
  status: "draft" | "active" | "paused";
  rating_avg: number | null;
  review_count: number;
  order_count: number;
  gallery_urls: string[];
  created_at: string;
  updated_at: string;
}

interface ServiceOrder {
  id: string;
  listing_id: string;
  tier_id: string | null;
  buyer_id: string;
  seller_id: string;
  requirements_text: string | null;
  status: "pending" | "accepted" | "in_progress" | "delivered" | "revision_requested" | "completed" | "cancelled" | "disputed";
  total_amount: number;
  platform_fee: number;
  seller_amount: number;
  delivery_deadline: string;
  delivered_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateListingRequest {
  action: "create_listing";
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  tags?: string[];
  pricing_type: "fixed" | "tiered";
  base_price: number;
  delivery_days: number;
  revisions_included?: number;
  gallery_urls?: string[];
}

interface UpdateListingRequest {
  action: "update_listing";
  listing_id: string;
  title?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  base_price?: number;
  delivery_days?: number;
  revisions_included?: number;
  status?: "draft" | "active" | "paused";
  gallery_urls?: string[];
}

interface ListListingsRequest {
  action: "list_listings";
  talent_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

interface GetListingRequest {
  action: "get_listing";
  listing_id: string;
}

interface PlaceOrderRequest {
  action: "place_order";
  listing_id: string;
  tier_id?: string;
  requirements_text?: string;
  delivery_days?: number;
}

interface UpdateOrderStatusRequest {
  action: "update_order_status";
  order_id: string;
  new_status: "accepted" | "in_progress" | "delivered" | "revision_requested" | "completed" | "cancelled" | "disputed";
}

interface DeliverOrderRequest {
  action: "deliver_order";
  order_id: string;
  deliverable_url?: string;
}

interface CompleteOrderRequest {
  action: "complete_order";
  order_id: string;
}

interface SearchCatalogRequest {
  action: "search_catalog";
  query?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  delivery_days_max?: number;
  limit?: number;
  offset?: number;
}

type RequestBody =
  | CreateListingRequest
  | UpdateListingRequest
  | ListListingsRequest
  | GetListingRequest
  | PlaceOrderRequest
  | UpdateOrderStatusRequest
  | DeliverOrderRequest
  | CompleteOrderRequest
  | SearchCatalogRequest
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
 * Verify user is a talent
 */
async function verifyTalentRole(
  supabase: any,
  userId: string
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_role")
      .eq("user_id", userId)
      .single();

    return profile?.user_role === "talent";
  } catch {
    return false;
  }
}

/**
 * Create a service listing
 */
async function createListing(
  supabase: any,
  userId: string,
  req: CreateListingRequest
): Promise<{ success: boolean; data?: ServiceListing; error?: string }> {
  try {
    const isTalent = await verifyTalentRole(supabase, userId);
    if (!isTalent) {
      return { success: false, error: "Only talent can create service listings" };
    }

    const { data, error } = await supabase
      .from("service_listings")
      .insert([
        {
          talent_id: userId,
          title: req.title,
          description: req.description,
          category: req.category,
          subcategory: req.subcategory || null,
          tags: req.tags || [],
          pricing_type: req.pricing_type,
          base_price: req.base_price,
          currency: "USD",
          delivery_days: req.delivery_days,
          revisions_included: req.revisions_included || 0,
          gallery_urls: req.gallery_urls || [],
          status: "draft",
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

/**
 * Update a service listing
 */
async function updateListing(
  supabase: any,
  userId: string,
  req: UpdateListingRequest
): Promise<{ success: boolean; data?: ServiceListing; error?: string }> {
  try {
    // Verify ownership
    const { data: listing, error: fetchError } = await supabase
      .from("service_listings")
      .select("talent_id")
      .eq("id", req.listing_id)
      .single();

    if (fetchError || !listing || listing.talent_id !== userId) {
      return { success: false, error: "Unauthorized to update this listing" };
    }

    const updateData: any = {};
    if (req.title) updateData.title = req.title;
    if (req.description) updateData.description = req.description;
    if (req.category) updateData.category = req.category;
    if (req.subcategory !== undefined) updateData.subcategory = req.subcategory;
    if (req.tags) updateData.tags = req.tags;
    if (req.base_price !== undefined) updateData.base_price = req.base_price;
    if (req.delivery_days !== undefined) updateData.delivery_days = req.delivery_days;
    if (req.revisions_included !== undefined) updateData.revisions_included = req.revisions_included;
    if (req.status) updateData.status = req.status;
    if (req.gallery_urls) updateData.gallery_urls = req.gallery_urls;

    const { data, error } = await supabase
      .from("service_listings")
      .update(updateData)
      .eq("id", req.listing_id)
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

/**
 * List service listings
 */
async function listListings(
  supabase: any,
  req: ListListingsRequest
): Promise<{
  success: boolean;
  data?: ServiceListing[];
  count?: number;
  error?: string;
}> {
  try {
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    let query = supabase
      .from("service_listings")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.status) {
      query = query.eq("status", req.status);
    } else {
      query = query.eq("status", "active");
    }

    if (req.talent_id) {
      query = query.eq("talent_id", req.talent_id);
    }

    const { data, error, count } = await query;

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

/**
 * Get a single service listing by ID
 */
async function getListing(
  supabase: any,
  listingId: string
): Promise<{ success: boolean; data?: ServiceListing; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("service_listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Listing not found" };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Place an order for a service
 */
async function placeOrder(
  supabase: any,
  userId: string,
  req: PlaceOrderRequest
): Promise<{ success: boolean; data?: ServiceOrder; error?: string }> {
  try {
    // Get listing
    const { data: listing, error: listingError } = await supabase
      .from("service_listings")
      .select("talent_id, base_price, delivery_days")
      .eq("id", req.listing_id)
      .single();

    if (listingError || !listing) {
      return { success: false, error: "Listing not found" };
    }

    const totalAmount = req.tier_id ? 0 : listing.base_price; // TODO: fetch tier price if tier_id provided
    const platformFee = totalAmount * 0.2;
    const sellerAmount = totalAmount * 0.8;
    const deliveryDays = req.delivery_days || listing.delivery_days;
    const deliveryDeadline = new Date();
    deliveryDeadline.setDate(deliveryDeadline.getDate() + deliveryDays);

    const { data, error } = await supabase
      .from("service_orders")
      .insert([
        {
          listing_id: req.listing_id,
          tier_id: req.tier_id || null,
          buyer_id: userId,
          seller_id: listing.talent_id,
          requirements_text: req.requirements_text || null,
          status: "pending",
          total_amount: totalAmount,
          platform_fee: platformFee,
          seller_amount: sellerAmount,
          delivery_deadline: deliveryDeadline.toISOString().split("T")[0],
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

/**
 * Update order status
 */
async function updateOrderStatus(
  supabase: any,
  userId: string,
  req: UpdateOrderStatusRequest
): Promise<{ success: boolean; data?: ServiceOrder; error?: string }> {
  try {
    // Verify access
    const { data: order, error: fetchError } = await supabase
      .from("service_orders")
      .select("buyer_id, seller_id")
      .eq("id", req.order_id)
      .single();

    if (fetchError || !order) {
      return { success: false, error: "Order not found" };
    }

    if (order.buyer_id !== userId && order.seller_id !== userId) {
      return { success: false, error: "Unauthorized to update this order" };
    }

    const { data, error } = await supabase
      .from("service_orders")
      .update({ status: req.new_status })
      .eq("id", req.order_id)
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

/**
 * Complete an order
 */
async function completeOrder(
  supabase: any,
  userId: string,
  orderId: string
): Promise<{ success: boolean; data?: ServiceOrder; error?: string }> {
  try {
    // Verify access
    const { data: order, error: fetchError } = await supabase
      .from("service_orders")
      .select("buyer_id, seller_id")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return { success: false, error: "Order not found" };
    }

    if (order.buyer_id !== userId) {
      return { success: false, error: "Only buyer can complete order" };
    }

    const { data, error } = await supabase
      .from("service_orders")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", orderId)
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

/**
 * Search catalog with filters
 */
async function searchCatalog(
  supabase: any,
  req: SearchCatalogRequest
): Promise<{
  success: boolean;
  data?: ServiceListing[];
  count?: number;
  error?: string;
}> {
  try {
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    let query = supabase
      .from("service_listings")
      .select("*", { count: "exact" })
      .eq("status", "active")
      .order("order_count", { ascending: false });

    if (req.query) {
      query = query.or(
        `title.ilike.%${req.query}%,description.ilike.%${req.query}%,tags.cs.{${req.query}}`
      );
    }

    if (req.category) {
      query = query.eq("category", req.category);
    }

    if (req.min_price !== undefined) {
      query = query.gte("base_price", req.min_price);
    }

    if (req.max_price !== undefined) {
      query = query.lte("base_price", req.max_price);
    }

    if (req.min_rating !== undefined) {
      query = query.gte("rating_avg", req.min_rating);
    }

    if (req.delivery_days_max !== undefined) {
      query = query.lte("delivery_days", req.delivery_days_max);
    }

    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1
    );

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

    // Extract authorization token for authenticated actions
    const authHeader = req.headers.get("Authorization") || "";
    const userId = getUserIdFromToken(authHeader);

    let response;

    switch (body.action) {
      case "create_listing":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const supabase1 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        response = await createListing(
          supabase1,
          userId,
          body as CreateListingRequest
        );
        break;

      case "update_listing":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const supabase2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        response = await updateListing(
          supabase2,
          userId,
          body as UpdateListingRequest
        );
        break;

      case "list_listings":
        const supabase3 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        response = await listListings(supabase3, body as ListListingsRequest);
        break;

      case "get_listing":
        const supabase4 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        response = await getListing(supabase4, (body as GetListingRequest).listing_id);
        break;

      case "place_order":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const supabase5 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        response = await placeOrder(
          supabase5,
          userId,
          body as PlaceOrderRequest
        );
        break;

      case "update_order_status":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const supabase6 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        response = await updateOrderStatus(
          supabase6,
          userId,
          body as UpdateOrderStatusRequest
        );
        break;

      case "complete_order":
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        const supabase7 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        response = await completeOrder(
          supabase7,
          userId,
          (body as CompleteOrderRequest).order_id
        );
        break;

      case "search_catalog":
        const supabase8 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        response = await searchCatalog(supabase8, body as SearchCatalogRequest);
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
    console.error("Error in catalog-service:", error);
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
