// Phase 2.6.3: Support Service Edge Function
// Deno Edge Function handling ticket creation, triage, comments, status updates
// Deploy to: supabase/functions/support-service
// Triggers: REST API + Real-time events

import {
  serve,
  json,
  checkAuth,
  createClient,
} from "https://esm.sh/@supabase/supabase-js";
import { Anthropic } from "https://esm.sh/@anthropic-ai/sdk";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface CreateTicketRequest {
  category: string;
  subject: string;
  description: string;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  screenshot_url?: string;
  page_url?: string;
  user_agent?: string;
  session_id?: string;
  sentry_event_id?: string;
}

interface TriageTicketRequest {
  ticket_id: string;
}

interface AddCommentRequest {
  ticket_id: string;
  body: string;
  is_public: boolean;
}

interface UpdateStatusRequest {
  ticket_id: string;
  new_status: string;
  note?: string;
}

interface SendNotificationsRequest {
  batch_size?: number;
}

interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  reporter_email: string;
  reporter_name: string;
  category: string;
  subject: string;
  description: string;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  page_url?: string;
  priority: string;
  status: string;
  known_issue_id?: string;
}

interface IssueSignal {
  issue_type: string;
  severity: string;
  affected_area: string;
  error_keywords: string[];
  reproducibility: string;
}

interface KnownIssue {
  id: string;
  issue_title: string;
  status: string;
  severity: string;
  affected_area: string;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
const resendKey = Deno.env.get("RESEND_API_KEY");

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Parse request
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const authHeader = req.headers.get("Authorization");

    // Check auth (service_role or authenticated user)
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    // Route to action handler
    let response;
    switch (action) {
      case "create_ticket":
        response = await handleCreateTicket(
          req,
          userId,
          authHeader?.includes("service_role")
        );
        break;
      case "triage_ticket":
        response = await handleTriageTicket(req);
        break;
      case "add_comment":
        response = await handleAddComment(req, userId);
        break;
      case "update_status":
        response = await handleUpdateStatus(req);
        break;
      case "send_pending_notifications":
        response = await handleSendPendingNotifications(req);
        break;
      case "health_ping":
        response = json({ status: "healthy", timestamp: new Date().toISOString() });
        break;
      default:
        response = json(
          { error: "Unknown action", action },
          { status: 400 }
        );
    }

    // Add CORS headers
    if (response instanceof Response) {
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    return response;
  } catch (error) {
    console.error("Support service error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});

// ============================================================================
// ACTION: CREATE_TICKET
// ============================================================================

async function handleCreateTicket(
  req: Request,
  userId: string | null,
  isServiceRole: boolean
): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Parse FormData (for file upload support)
  const formData = await req.formData();
  const category = formData.get("category")?.toString();
  const subject = formData.get("subject")?.toString();
  const description = formData.get("description")?.toString();
  const stepsToReproduce = formData.get("steps_to_reproduce")?.toString();
  const expectedBehavior = formData.get("expected_behavior")?.toString();
  const actualBehavior = formData.get("actual_behavior")?.toString();
  const screenshotFile = formData.get("screenshot") as File | null;
  const pageUrl = formData.get("page_url")?.toString();
  const userAgent = formData.get("user_agent")?.toString();
  const sessionId = formData.get("session_id")?.toString();
  const sentryEventId = formData.get("sentry_event_id")?.toString();

  // Validate required fields
  if (!category || !subject || !description) {
    return json(
      { error: "Missing required fields: category, subject, description" },
      { status: 400 }
    );
  }

  // Ensure authenticated
  if (!userId && !isServiceRole) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sanitize inputs
  const sanitized = {
    category: sanitizeInput(category),
    subject: sanitizeInput(subject),
    description: sanitizeInput(description),
    steps_to_reproduce: stepsToReproduce ? sanitizeInput(stepsToReproduce) : null,
    expected_behavior: expectedBehavior ? sanitizeInput(expectedBehavior) : null,
    actual_behavior: actualBehavior ? sanitizeInput(actualBehavior) : null,
  };

  // Handle screenshot upload (if provided)
  let screenshotUrl: string | null = null;
  if (screenshotFile) {
    screenshotUrl = await uploadScreenshot(screenshotFile, userId!);
  }

  // Get user info
  const { data: userData } = await supabase.auth.admin.getUserById(userId!);
  const reporterEmail = userData?.user?.email || "unknown@icareer.os";
  const reporterName = userData?.user?.user_metadata?.name || "Anonymous";

  // Insert ticket
  const { data: ticket, error: insertError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: userId,
      reporter_email: reporterEmail,
      reporter_name: reporterName,
      ticket_source: "user_report",
      category: sanitized.category,
      subject: sanitized.subject,
      description: sanitized.description,
      steps_to_reproduce: sanitized.steps_to_reproduce,
      expected_behavior: sanitized.expected_behavior,
      actual_behavior: sanitized.actual_behavior,
      page_url: pageUrl,
      user_agent: userAgent,
      session_id: sessionId,
      sentry_event_id: sentryEventId,
      screenshot_url: screenshotUrl,
      priority: priorityFromCategory(category),
      status: "open",
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("Error inserting ticket:", insertError);
    return json({ error: "Failed to create ticket" }, { status: 500 });
  }

  // Queue acknowledgment email
  await queueNotification(supabase, ticket.id, {
    recipient_email: reporterEmail,
    recipient_name: reporterName,
    notification_type: "ticket_received",
    subject: `We received your report: ${ticket.ticket_number}`,
    ticket_number: ticket.ticket_number,
    issue_subject: ticket.subject,
  });

  // Publish event for triage
  await supabase.from("realtime_events").insert({
    event_type: "support.ticket_created",
    payload: {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      category: ticket.category,
      description: ticket.description,
    },
    created_at: new Date().toISOString(),
  });

  return json({
    success: true,
    ticket_id: ticket.id,
    ticket_number: ticket.ticket_number,
    confirmation_email_queued: true,
    message: "Thank you for your report!",
  });
}

// ============================================================================
// ACTION: TRIAGE_TICKET
// ============================================================================

async function handleTriageTicket(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await req.json() as TriageTicketRequest;
  const { ticket_id } = body;

  if (!ticket_id) {
    return json({ error: "ticket_id required" }, { status: 400 });
  }

  // Fetch ticket
  const { data: ticket, error: fetchError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticket_id)
    .single();

  if (fetchError || !ticket) {
    return json({ error: "Ticket not found" }, { status: 404 });
  }

  try {
    // Extract issue signal using Claude
    const issueSignal = await extractIssueSignal(ticket);

    // Find matching known issue
    let knownIssueId: string | null = null;
    const matchingIssue = await findMatchingKnownIssue(ticket, issueSignal);

    if (matchingIssue) {
      knownIssueId = matchingIssue.id;
    } else if (issueSignal.severity === "critical" || issueSignal.severity === "high") {
      // Create new known issue for critical/high bugs
      const newKnownIssue = await createNewKnownIssueFromTicket(ticket, issueSignal);
      knownIssueId = newKnownIssue?.id ?? null;
    }

    // Update ticket with known_issue link and status
    const newStatus = knownIssueId ? "triaging" : "open";
    await updateTicketStatus(supabase, ticket.id, newStatus, "AI triage complete");

    if (knownIssueId) {
      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({ known_issue_id: knownIssueId })
        .eq("id", ticket.id);

      if (!updateError) {
        // Notify user that ticket was triaged
        await queueNotification(supabase, ticket.id, {
          recipient_email: ticket.reporter_email,
          recipient_name: ticket.reporter_name,
          notification_type: "ticket_triaged",
          subject: `Your report ${ticket.ticket_number} is being investigated`,
          ticket_number: ticket.ticket_number,
          issue_subject: ticket.subject,
        });
      }
    }

    // Create GitHub issue for critical bugs
    if (issueSignal.severity === "critical") {
      await openGithubIssueFromTicket(ticket, issueSignal);
    }

    return json({
      success: true,
      ticket_id: ticket.id,
      known_issue_id: knownIssueId,
      issue_signal: issueSignal,
    });
  } catch (error) {
    console.error("Triage error:", error);
    return json(
      { error: "Triage failed", details: error instanceof Error ? error.message : null },
      { status: 500 }
    );
  }
}

// ============================================================================
// ACTION: ADD_COMMENT
// ============================================================================

async function handleAddComment(
  req: Request,
  userId: string | null
): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  if (!userId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as AddCommentRequest;
  const { ticket_id, body: commentBody, is_public } = body;

  if (!ticket_id || !commentBody) {
    return json(
      { error: "Missing required fields: ticket_id, body" },
      { status: 400 }
    );
  }

  // Verify user owns ticket
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticket_id)
    .eq("user_id", userId)
    .single();

  if (!ticket) {
    return json({ error: "Ticket not found or access denied" }, { status: 404 });
  }

  // Get user info
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const authorName = userData?.user?.user_metadata?.name || "User";

  // Insert comment
  const { data: comment, error: insertError } = await supabase
    .from("ticket_comments")
    .insert({
      ticket_id: ticket_id,
      author_type: "user",
      author_id: userId,
      author_name: authorName,
      body: sanitizeInput(commentBody),
      is_public: is_public ?? false,
    })
    .select("*")
    .single();

  if (insertError) {
    return json({ error: "Failed to add comment" }, { status: 500 });
  }

  // If public admin comment, notify user
  if (is_public) {
    await queueNotification(supabase, ticket_id, {
      recipient_email: ticket.reporter_email,
      recipient_name: ticket.reporter_name,
      notification_type: "ticket_triaged",
      subject: `Update on your report: ${ticket.ticket_number}`,
      ticket_number: ticket.ticket_number,
      issue_subject: ticket.subject,
      comment_preview: commentBody.slice(0, 100),
    });
  }

  return json({
    success: true,
    comment_id: comment.id,
    message: "Comment added",
  });
}

// ============================================================================
// ACTION: UPDATE_STATUS
// ============================================================================

async function handleUpdateStatus(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await req.json() as UpdateStatusRequest;
  const { ticket_id, new_status, note } = body;

  if (!ticket_id || !new_status) {
    return json(
      { error: "Missing required fields: ticket_id, new_status" },
      { status: 400 }
    );
  }

  // Fetch ticket
  const { data: ticket, error: fetchError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticket_id)
    .single();

  if (fetchError || !ticket) {
    return json({ error: "Ticket not found" }, { status: 404 });
  }

  // Update status
  await updateTicketStatus(supabase, ticket.id, new_status, note ?? "Status updated by admin");

  // Send notification based on new status
  const notificationType = statusToNotificationType(new_status);
  await queueNotification(supabase, ticket.id, {
    recipient_email: ticket.reporter_email,
    recipient_name: ticket.reporter_name,
    notification_type: notificationType,
    subject: `Your report ${ticket.ticket_number}: ${humanizeStatus(new_status)}`,
    ticket_number: ticket.ticket_number,
    issue_subject: ticket.subject,
    status: new_status,
  });

  return json({
    success: true,
    ticket_id: ticket.id,
    new_status: new_status,
    notification_queued: true,
  });
}

// ============================================================================
// ACTION: SEND_PENDING_NOTIFICATIONS
// ============================================================================

async function handleSendPendingNotifications(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await req.json() as SendNotificationsRequest;
  const batchSize = body.batch_size ?? 50;

  // Fetch pending notifications
  const { data: notifications, error: fetchError } = await supabase
    .from("ticket_notifications")
    .select("*")
    .eq("status", "pending")
    .limit(batchSize);

  if (fetchError) {
    return json({ error: "Failed to fetch notifications" }, { status: 500 });
  }

  if (!notifications || notifications.length === 0) {
    return json({ success: true, sent: 0, message: "No pending notifications" });
  }

  let successCount = 0;
  let failureCount = 0;

  // Send each notification
  for (const notification of notifications) {
    try {
      const result = await sendEmail(
        notification.recipient_email,
        notification.subject,
        notification.body_html,
        notification.body_text
      );

      if (result.success) {
        // Mark as sent
        await supabase
          .from("ticket_notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", notification.id);
        successCount++;
      } else {
        // Mark as failed
        await supabase
          .from("ticket_notifications")
          .update({ status: "failed" })
          .eq("id", notification.id);
        failureCount++;
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      failureCount++;
    }
  }

  return json({
    success: true,
    sent: successCount,
    failed: failureCount,
    total: notifications.length,
  });
}

// ============================================================================
// HELPER FUNCTIONS: PRIORITY & TRIAGE
// ============================================================================

function priorityFromCategory(category: string): string {
  const priorityMap: { [key: string]: string } = {
    bug: "high",
    cannot_login: "critical",
    data_issue: "critical",
    performance: "medium",
    feature_request: "low",
    billing: "high",
    other: "medium",
  };
  return priorityMap[category] || "medium";
}

async function extractIssueSignal(ticket: SupportTicket): Promise<IssueSignal> {
  if (!anthropic) {
    return {
      issue_type: "unknown",
      severity: "medium",
      affected_area: "general",
      error_keywords: [],
      reproducibility: "unknown",
    };
  }

  const prompt = `Analyze this support ticket and extract the issue signal:

Category: ${ticket.category}
Subject: ${ticket.subject}
Description: ${ticket.description}
Steps: ${ticket.steps_to_reproduce || "Not provided"}
Expected: ${ticket.expected_behavior || "Not provided"}
Actual: ${ticket.actual_behavior || "Not provided"}

Return a JSON object with:
- issue_type: (authentication, data_sync, performance, ui_bug, crash, other)
- severity: (critical, high, medium, low)
- affected_area: (auth, profile, jobs, messaging, search, other)
- error_keywords: (array of key error terms or symptoms)
- reproducibility: (always, sometimes, rare)`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Claude API error:", error);
  }

  return {
    issue_type: "unknown",
    severity: "medium",
    affected_area: "general",
    error_keywords: [],
    reproducibility: "unknown",
  };
}

async function findMatchingKnownIssue(
  ticket: SupportTicket,
  signal: IssueSignal
): Promise<KnownIssue | null> {
  const { data: issues } = await supabase
    .from("known_issues")
    .select("*")
    .eq("affected_area", signal.affected_area)
    .in("status", ["open", "in_progress"])
    .limit(10);

  if (!issues || issues.length === 0) {
    return null;
  }

  if (!anthropic) {
    return null;
  }

  // Use Claude to find best match
  const issueDescriptions = issues
    .map((i) => `- ${i.issue_title} (${i.status})`)
    .join("\n");

  const prompt = `Given this support ticket issue:
"${ticket.subject}: ${ticket.description}"

Which of these known issues is it most likely related to? Return just the ID, or "NONE".
${issueDescriptions}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    for (const issue of issues) {
      if (responseText.includes(issue.id)) {
        return issue;
      }
    }
  } catch (error) {
    console.error("Claude matching error:", error);
  }

  return null;
}

async function createNewKnownIssueFromTicket(
  ticket: SupportTicket,
  signal: IssueSignal
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("known_issues")
    .insert({
      issue_title: ticket.subject,
      issue_description: ticket.description,
      affected_area: signal.affected_area,
      severity: signal.severity,
      status: "open",
      created_from_ticket_id: ticket.id,
    })
    .select("id")
    .single();

  return error ? null : data;
}

// ============================================================================
// HELPER FUNCTIONS: EMAIL & NOTIFICATIONS
// ============================================================================

async function queueNotification(
  supabase: any,
  ticketId: string,
  options: {
    recipient_email: string;
    recipient_name?: string;
    notification_type: string;
    subject: string;
    ticket_number?: string;
    issue_subject?: string;
    status?: string;
    comment_preview?: string;
  }
): Promise<void> {
  const { html, text } = buildEmailTemplate(options);

  await supabase.from("ticket_notifications").insert({
    ticket_id: ticketId,
    recipient_email: options.recipient_email,
    recipient_name: options.recipient_name || "User",
    notification_type: options.notification_type,
    subject: options.subject,
    body_html: html,
    body_text: text,
    status: "pending",
  });
}

function buildEmailTemplate(options: any): { html: string; text: string } {
  const ticketNumber = options.ticket_number || "N/A";
  const issueSubject = options.issue_subject || "Your Report";
  const status = options.status ? humanizeStatus(options.status) : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 20px; background: #f9fafb; margin: 20px 0; border-radius: 8px; }
    .ticket-number { background: white; padding: 12px; border-radius: 6px; font-family: monospace; font-weight: bold; margin: 10px 0; }
    .footer { font-size: 12px; color: #6b7280; text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; }
    .button { background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>iCareerOS Support</h1>
      <p>${options.subject}</p>
    </div>
    <div class="content">
      <p>Hi ${options.recipient_name || "there"},</p>
      <p>Thank you for reporting: <strong>"${issueSubject}"</strong></p>
      <p><strong>Ticket Number:</strong></p>
      <div class="ticket-number">${ticketNumber}</div>
      ${status ? `<p><strong>Status:</strong> ${status}</p>` : ""}
      ${options.comment_preview ? `<p><strong>Update:</strong> ${options.comment_preview}...</p>` : ""}
      <p><a href="https://app.icareer.os/support/tickets/${ticketNumber}" class="button">View Ticket</a></p>
      <p>We appreciate your feedback and are working to improve iCareerOS.</p>
    </div>
    <div class="footer">
      <p>Â© 2026 iCareerOS. All rights reserved.<br>
      <a href="https://icareer.os/support">Support Center</a> |
      <a href="https://icareer.os/privacy">Privacy Policy</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `
iCareerOS Support

${options.subject}

Hi ${options.recipient_name || "there"},

Thank you for reporting: "${issueSubject}"

Ticket Number: ${ticketNumber}
${status ? `Status: ${status}` : ""}
${options.comment_preview ? `Update: ${options.comment_preview}...` : ""}

View your ticket: https://app.icareer.os/support/tickets/${ticketNumber}

We appreciate your feedback and are working to improve iCareerOS.

---
Â© 2026 iCareerOS. All rights reserved.
Support Center: https://icareer.os/support
Privacy Policy: https://icareer.os/privacy
`;

  return { html, text };
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!resendKey) {
    console.warn("Resend API key not configured, skipping email");
    return { success: false, error: "Resend not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "support@icareer.os",
        to,
        subject,
        html,
        text,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, messageId: data.id };
    } else {
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function updateTicketStatus(
  supabase: any,
  ticketId: string,
  newStatus: string,
  note: string
): Promise<void> {
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("status")
    .eq("id", ticketId)
    .single();

  if (ticket && ticket.status !== newStatus) {
    // Record history
    await supabase.from("ticket_status_history").insert({
      ticket_id: ticketId,
      from_status: ticket.status,
      to_status: newStatus,
      note,
      changed_at: new Date().toISOString(),
    });

    // Update ticket
    await supabase
      .from("support_tickets")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);
  }
}

// ============================================================================
// HELPER FUNCTIONS: UTILITIES
// ============================================================================

function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

async function uploadScreenshot(
  file: File,
  userId: string
): Promise<string | null> {
  if (file.size > 10 * 1024 * 1024) {
    console.warn("Screenshot too large, skipping");
    return null;
  }

  const filename = `${userId}/${Date.now()}-${file.name}`;

  try {
    const { data, error } = await supabase.storage
      .from("support-screenshots")
      .upload(filename, file);

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    return supabase.storage
      .from("support-screenshots")
      .getPublicUrl(data.path).data.publicUrl;
  } catch (error) {
    console.error("Upload exception:", error);
    return null;
  }
}

async function openGithubIssueFromTicket(
  ticket: SupportTicket,
  signal: IssueSignal
): Promise<void> {
  const githubToken = Deno.env.get("GITHUB_TOKEN");
  if (!githubToken) return;

  const body = `
## From Support Ticket: ${ticket.ticket_number}

**Reported by:** ${ticket.reporter_email}
**Category:** ${ticket.category}
**Severity:** ${signal.severity}

### Description
${ticket.description}

### Steps to Reproduce
${ticket.steps_to_reproduce || "Not provided"}

### Expected Behavior
${ticket.expected_behavior || "Not provided"}

### Actual Behavior
${ticket.actual_behavior || "Not provided"}

[View on Support Dashboard](https://app.icareer.os/admin/tickets/${ticket.ticket_number})
`;

  try {
    const response = await fetch(
      "https://api.github.com/repos/majabri/icos-app/issues",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          title: `[${signal.severity.toUpperCase()}] ${ticket.subject}`,
          body,
          labels: [signal.severity, signal.affected_area, "support"],
        }),
      }
    );

    if (response.ok) {
      const issue = await response.json();
      // Update ticket with GitHub issue URL
      await supabase
        .from("support_tickets")
        .update({ github_issue_url: issue.html_url })
        .eq("id", ticket.id);
    }
  } catch (error) {
    console.error("GitHub issue creation error:", error);
  }
}

function statusToNotificationType(status: string): string {
  const map: { [key: string]: string } = {
    open: "ticket_received",
    triaging: "ticket_triaged",
    in_progress: "fix_in_progress",
    fix_deployed: "fix_deployed",
    resolved: "ticket_resolved",
    wont_fix: "ticket_wont_fix",
    awaiting_user: "awaiting_user",
    duplicate: "duplicate_linked",
  };
  return map[status] || "ticket_received";
}

function humanizeStatus(status: string): string {
  const map: { [key: string]: string } = {
    open: "Open",
    triaging: "Being Investigated",
    in_progress: "Being Fixed",
    fix_deployed: "Fix Deployed",
    resolved: "Resolved",
    wont_fix: "Won't Fix",
    awaiting_user: "Awaiting Your Response",
    duplicate: "Duplicate",
  };
  return map[status] || status;
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}
