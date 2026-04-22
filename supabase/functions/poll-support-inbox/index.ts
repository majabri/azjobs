/**
 * poll-support-inbox — scheduled IMAP poller for bugs@icareeros.com.
 *
 * Runs on a cron schedule (every 5 minutes via pg_cron or Supabase scheduled fn).
 * Fetches UNSEEN emails, creates support_tickets + ticket_messages, marks as read.
 *
 * Required Supabase secrets:
 *   BLUEHOST_IMAP_HOST   e.g. mail.icareeros.com
 *   BLUEHOST_IMAP_PORT   e.g. 993 (IMAPS)
 *   BLUEHOST_IMAP_USER   e.g. bugs@icareeros.com
 *   BLUEHOST_IMAP_PASS   your Bluehost email password
 *
 * Optional:
 *   POLL_SECRET          shared secret — if set, requests must include
 *                        Authorization: Bearer <POLL_SECRET>
 *                        (used when invoking from pg_cron / external cron)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1";
import { simpleParser } from "npm:mailparser@3";
import { log } from "../_shared/logger.ts";

// ── Supabase service-role client ─────────────────────────────────────────────
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Category inference from subject ─────────────────────────────────────────
function inferCategory(subject: string): string {
  const s = subject.toLowerCase();
  if (
    s.includes("bug") ||
    s.includes("error") ||
    s.includes("broken") ||
    s.includes("crash")
  )
    return "bug";
  if (
    s.includes("feature") ||
    s.includes("request") ||
    s.includes("suggestion") ||
    s.includes("wish")
  )
    return "feature_request";
  if (
    s.includes("billing") ||
    s.includes("payment") ||
    s.includes("invoice") ||
    s.includes("charge")
  )
    return "billing";
  if (
    s.includes("account") ||
    s.includes("login") ||
    s.includes("password") ||
    s.includes("access")
  )
    return "account";
  return "general";
}

// ── Skip system/bounce emails that should never become tickets ───────────────
const BOUNCE_FROM_PATTERNS = [
  /mailer-daemon/i,
  /mail delivery system/i,
  /postmaster/i,
  /no-?reply@/i,
  /noreply@/i,
  /cpanel@/i,
  /whm@/i,
  /root@/i,
];

const BOUNCE_SUBJECT_PATTERNS = [
  /^mail delivery failed/i,
  /^delivery status notification/i,
  /^undelivered mail returned/i,
  /^returned mail:/i,
  /^auto-?reply:/i,
  /^out of office/i,
  /^automatic reply/i,
];

function isSystemEmail(fromAddr: string, subject: string): boolean {
  if (BOUNCE_FROM_PATTERNS.some((p) => p.test(fromAddr))) return true;
  if (BOUNCE_SUBJECT_PATTERNS.some((p) => p.test(subject))) return true;
  return false;
}

// ── Strip reply history from email body ─────────────────────────────────────
function cleanBody(text: string): string {
  // Trim lines after common reply separators (Outlook, Gmail, Apple Mail)
  const separators = [
    /^-{3,}\s*Original Message/im,
    /^On .+ wrote:$/im,
    /^>{1,}/m,
    /^From:\s+/im,
  ];
  let out = text;
  for (const sep of separators) {
    const match = sep.exec(out);
    if (match) {
      out = out.slice(0, match.index);
    }
  }
  return out.trim();
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Optional bearer token guard
  const pollSecret = Deno.env.get("POLL_SECRET");
  if (pollSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${pollSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ── IMAP config ────────────────────────────────────────────────────────────
  const imapHost = Deno.env.get("BLUEHOST_IMAP_HOST");
  const imapPort = parseInt(Deno.env.get("BLUEHOST_IMAP_PORT") ?? "993", 10);
  const imapUser = Deno.env.get("BLUEHOST_IMAP_USER");
  const imapPass = Deno.env.get("BLUEHOST_IMAP_PASS");

  if (!imapHost || !imapUser || !imapPass) {
    log("error", "poll-support-inbox: IMAP secrets not configured");
    return new Response(JSON.stringify({ error: "IMAP not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapPort === 993, // true for IMAPS (993), false for STARTTLS (143)
    auth: { user: imapUser, pass: imapPass },
    logger: false, // suppress verbose IMAP logging
  });

  let processed = 0;
  let errors = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch all UNSEEN messages
      const uids: number[] = [];
      for await (const msg of client.fetch(
        { seen: false },
        { uid: true, envelope: true, source: true },
      )) {
        uids.push(msg.uid);

        try {
          // Parse the raw RFC 2822 source
          const parsed = await simpleParser(msg.source);

          const fromAddr = parsed.from?.value?.[0]?.address ?? "";
          const fromName = parsed.from?.value?.[0]?.name ?? fromAddr;
          const subject = (parsed.subject ?? "(no subject)").slice(0, 100);

          // Skip bounces, auto-replies, and system emails
          if (isSystemEmail(fromAddr, subject)) {
            log("info", "poll-support-inbox: skipping system/bounce email", {
              fromAddr,
              subject,
            });
            processed++;
            continue;
          }

          // Also skip emails sent from our own address (avoid looping)
          if (fromAddr.toLowerCase() === imapUser!.toLowerCase()) {
            log("info", "poll-support-inbox: skipping self-sent email", {
              fromAddr,
              subject,
            });
            processed++;
            continue;
          }

          const bodyText = cleanBody(parsed.text ?? parsed.html ?? "").slice(
            0,
            8000,
          );
          const category = inferCategory(subject);

          // Try to match sender to an existing user
          let userId: string | null = null;
          if (fromAddr) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("email", fromAddr)
              .maybeSingle();
            userId = profile?.id ?? null;

            if (!userId) {
              // Fallback: check auth.users directly via RPC (service role can read it)
              const { data: authUser } = await supabase.rpc(
                "get_user_id_by_email",
                {
                  p_email: fromAddr,
                },
              );
              userId = authUser ?? null;
            }
          }

          // Create the support ticket
          const { data: ticket, error: ticketErr } = await supabase
            .from("support_tickets")
            .insert({
              user_id: userId,
              guest_email: userId ? null : fromAddr || null,
              title: subject,
              category,
              request_type: "general_feedback", // default for inbound email
              source: "email",
              status: "open",
              priority: "normal",
              description: bodyText, // legacy field — keep in sync
              email: fromAddr || null,
            })
            .select("id, ticket_number")
            .single();

          if (ticketErr || !ticket) {
            log("error", "poll-support-inbox: ticket insert failed", {
              fromAddr,
              subject,
              err: ticketErr?.message,
            });
            errors++;
            continue;
          }

          // Create the first ticket message
          await supabase.from("ticket_messages").insert({
            ticket_id: ticket.id,
            user_id: userId,
            body: bodyText || "(empty message)",
            is_internal_note: false,
            is_staff_reply: false,
          });

          // Send confirmation email back to sender (fire-and-forget)
          if (fromAddr) {
            supabase.functions
              .invoke("support-notify", {
                body: {
                  event: "ticket_created",
                  to: fromAddr,
                  ticketNumber: ticket.ticket_number,
                  ticketTitle: subject,
                },
              })
              .catch(() => {
                /* non-critical */
              });
          }

          log("info", "poll-support-inbox: ticket created", {
            ticketNumber: ticket.ticket_number,
            from: fromAddr,
            subject,
          });
          processed++;
        } catch (msgErr) {
          log("error", "poll-support-inbox: error processing message", {
            err: String(msgErr),
          });
          errors++;
        }
      }

      // Mark all processed messages as SEEN
      if (uids.length > 0) {
        await client.messageFlagsAdd({ uid: uids as unknown as string }, [
          "\\Seen",
        ]);
      }
    } finally {
      lock.release();
    }
  } catch (connErr) {
    log("error", "poll-support-inbox: IMAP connection error", {
      err: String(connErr),
    });
    return new Response(
      JSON.stringify({
        error: "IMAP connection failed",
        detail: String(connErr),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    await client.logout().catch(() => {});
  }

  log("info", "poll-support-inbox: poll complete", { processed, errors });
  return new Response(JSON.stringify({ ok: true, processed, errors }), {
    headers: { "Content-Type": "application/json" },
  });
});
