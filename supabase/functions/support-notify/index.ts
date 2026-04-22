/**
 * support-notify — sends Resend transactional emails for the support ticket system.
 *
 * Events:
 *   ticket_created  — confirmation to the user after they submit a ticket
 *   staff_reply     — notification to the user when staff responds
 *
 * Called internally by the frontend (authenticated) or by email-inbound (service role).
 * CORS is not needed — this is an internal server-to-server function.
 */

import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";

interface NotifyPayload {
  event: "ticket_created" | "staff_reply";
  to: string;                // recipient email
  ticketNumber: string;      // e.g. TKT-0042
  ticketTitle: string;
  replyBody?: string;        // only for staff_reply
}

const FROM = "iCareerOS Support <noreply@icareeros.com>";
const SUPPORT_URL = "https://icareeros.com/support";

function ticketCreatedHtml(p: NotifyPayload): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="color:#4F46E5">Ticket Received — ${p.ticketNumber}</h2>
  <p>Thanks for reaching out. We received your support request:</p>
  <blockquote style="border-left:3px solid #4F46E5;padding-left:12px;margin:16px 0;color:#444">
    <strong>${p.ticketTitle}</strong>
  </blockquote>
  <p>Our team will review it and get back to you shortly. You can track your ticket at:</p>
  <p><a href="${SUPPORT_URL}" style="color:#4F46E5">${SUPPORT_URL}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="font-size:12px;color:#888">iCareerOS · <a href="https://icareeros.com" style="color:#888">icareeros.com</a></p>
</body>
</html>`.trim();
}

function staffReplyHtml(p: NotifyPayload): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="color:#4F46E5">New Reply — ${p.ticketNumber}</h2>
  <p>Our support team replied to your ticket <strong>${p.ticketTitle}</strong>:</p>
  <blockquote style="border-left:3px solid #4F46E5;padding-left:12px;margin:16px 0;white-space:pre-wrap;color:#444">${p.replyBody ?? ""}</blockquote>
  <p><a href="${SUPPORT_URL}" style="color:#4F46E5">View and reply at icareeros.com/support →</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="font-size:12px;color:#888">iCareerOS · <a href="https://icareeros.com" style="color:#888">icareeros.com</a></p>
</body>
</html>`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    log("error", "support-notify: RESEND_API_KEY not set");
    return new Response(JSON.stringify({ error: "Email gateway not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { event, to, ticketNumber, ticketTitle, replyBody } = payload;
  if (!event || !to || !ticketNumber || !ticketTitle) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const subject =
    event === "ticket_created"
      ? `[${ticketNumber}] Support request received — iCareerOS`
      : `[${ticketNumber}] New reply from support — iCareerOS`;

  const html =
    event === "ticket_created"
      ? ticketCreatedHtml(payload)
      : staffReplyHtml(payload);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    log("error", "support-notify: Resend error", { event, to, ticketNumber, err });
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  log("info", "support-notify: email sent", { event, to, ticketNumber });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
