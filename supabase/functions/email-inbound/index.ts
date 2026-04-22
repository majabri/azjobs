/**
 * email-inbound — DEPRECATED.
 *
 * This function was a Resend inbound webhook for bugs@icareeros.com.
 * It has been replaced by `poll-support-inbox`, a scheduled IMAP poller
 * that connects directly to Bluehost mail servers.
 *
 * This stub is kept deployed so any old webhook calls receive a graceful
 * 410 Gone rather than a 404, making the migration visible in logs.
 */

Deno.serve(() => {
  return new Response(
    JSON.stringify({
      error:
        "This endpoint is deprecated. Inbound email is now handled by poll-support-inbox.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  );
});
