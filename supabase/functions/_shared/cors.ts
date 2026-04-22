/**
 * Standard CORS headers for iCareerOS Edge Functions.
 *
 * Usage:
 *   import { corsHeaders, handleCors } from "../_shared/cors.ts";
 *
 *   // In your handler:
 *   if (req.method === "OPTIONS") return handleCors();
 *   return new Response(JSON.stringify(data), {
 *     headers: { ...corsHeaders, "Content-Type": "application/json" },
 *   });
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
} as const;

/** Return a 204 preflight response. Call this for all OPTIONS requests. */
export function handleCors(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/** Wrap any JSON payload in a standard 200 response with CORS headers. */
export function jsonResponse(
  body: unknown,
  status = 200,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extra,
    },
  });
}

/** Return a standard error response with CORS headers. */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}
