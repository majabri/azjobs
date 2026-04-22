/**
 * support-notify — sends transactional emails for the support ticket system.
 *
 * Events:
 *   ticket_created  — confirmation to the user after they submit a ticket
 *   staff_reply     — notification to the user when staff responds
 *
 * Transport: Bluehost SMTP (replaces Resend).
 * Called internally by the frontend or by poll-support-inbox.
 *
 * Required Supabase secrets:
 *   BLUEHOST_SMTP_HOST  e.g. mail.icareeros.com
 *   BLUEHOST_SMTP_PORT  e.g. 465 (SSL) or 587 (STARTTLS)
 *   BLUEHOST_SMTP_USER  e.g. bugs@icareeros.com
 *   BLUEHOST_SMTP_PASS  your Bluehost email password
 */

import { log } from "../_shared/logger.ts";
import { SMTPClient } from "npm:emailjs@4.0.3";

interface NotifyPayload {
  event: "ticket_created" | "staff_reply";
  to: string;
  ticketNumber: string;
  ticketTitle: string;
  replyBody?: string;
}

const FROM_NAME = "iCareerOS Support";
const SUPPORT_URL = "https://icareeros.com/support";

function ticketCreatedHtml(p: NotifyPayload): string {
  return `<!DOCTYPE html>
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
</html>`;
}

function staffReplyHtml(p: NotifyPayload): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="color:#4F46E5">New Reply — ${p.ticketNumber}</h2>
  <p>Our support team replied to your ticket <strong>${p.ticketTitle}</strong>:</p>
  <blockquote style="border-left:3px solid #4F46E5;padding-left:12px;margin:16px 0;white-space:pre-wrap;color:#444">${p.replyBody ?? ""}</blockquote>
  <p><a href="${SUPPORT_URL}" style="color:#4F46E5">View and reply at icareeros.com/support →</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="font-size:12px;color:#888">iCareerOS · <a href="https://icareeros.com" style="color:#888">icareeros.com</a></p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  // CORS pre-flight (not normally needed for server-to-server, but harmless)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  // ── SMTP config from secrets ─────────────────────────────────────────────
  const smtpHost = Deno.env.get("BLUEHOST_SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("BLUEHOST_SMTP_PORT") ?? "465", 10);
  const smtpUser = Deno.env.get("BLUEHOST_SMTP_USER");
  const smtpPass = Deno.env.get("BLUEHOST_SMTP_PASS");

  if (!smtpHost || !smtpUser || !smtpPass) {
    log("error", "support-notify: SMTP secrets not configured");
    return new Response(
      JSON.stringify({ error: "Email gateway not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── Parse payload ────────────────────────────────────────────────────────
  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { event, to, ticketNumber, ticketTitle } = payload;
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

  // ── Send via SMTP ────────────────────────────────────────────────────────
  try {
    // Port 465 = implicit TLS (ssl:true); port 587 = STARTTLS (tls:true)
    const useSsl = smtpPort === 465;
    const client = new SMTPClient({
      user: smtpUser,
      password: smtpPass,
      host: smtpHost,
      port: smtpPort,
      ssl: useSsl,
      tls: !useSsl,
    });

    await client.sendAsync({
      from: `${FROM_NAME} <${smtpUser}>`,
      to,
      subject,
      attachment: [{ data: html, alternative: true }],
    });

    log("info", "support-notify: email sent", { event, to, ticketNumber });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    log("error", "support-notify: SMTP error", {
      event,
      to,
      ticketNumber,
      err: String(err),
    });
    return new Response(
      JSON.stringify({ error: "Failed to send email", detail: String(err) }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
