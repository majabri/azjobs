import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { corsHeaders } from "../_shared/cors.ts";

// ~100 years effective ban duration
const PERMANENT_BAN_DURATION = "876600h";

// ─── Strict command registry ────────────────────────────────────────────────
// ONLY these commands are allowed. No arbitrary shell / OS execution.
const COMMAND_REGISTRY = new Set([
  "agent.retry",
  "agent.run",
  "queue.clear",
  "queue.stats",
  "user.disable",
  "user.promote",
  "system.health",
]);

// ─── Handler functions ───────────────────────────────────────────────────────

async function handleAgentRetry(
  args: Record<string, string>,
  adminClient: any,
): Promise<Record<string, unknown>> {
  const { run_id } = args;
  if (!run_id) return { error: "run_id is required" };

  const { data, error } = await adminClient
    .from("agent_runs")
    .update({
      status: "pending",
      started_at: null,
      completed_at: null,
      errors: [],
    })
    .eq("id", run_id)
    .select("id, status, user_id")
    .single();

  if (error) return { error: error.message };
  return {
    success: true,
    run: data,
    message: `Run ${run_id} queued for retry`,
  };
}

async function handleAgentRun(
  args: Record<string, string>,
  adminClient: any,
  adminUserId: string,
): Promise<Record<string, unknown>> {
  const { job_description } = args;
  if (!job_description) return { error: "job_description is required" };

  const { data, error } = await adminClient
    .from("agent_runs")
    .insert({
      user_id: adminUserId,
      status: "pending",
      started_at: new Date().toISOString(),
      jobs_found: 0,
      jobs_matched: 0,
      applications_sent: 0,
      errors: [],
    })
    .select("id, status")
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    run_id: data.id,
    status: data.status,
    message:
      "Agent run created. It will be picked up by the agent orchestrator.",
  };
}

async function handleQueueClear(
  adminClient: any,
): Promise<Record<string, unknown>> {
  const { error, count } = await adminClient
    .from("job_queue")
    .delete({ count: "exact" })
    .in("status", ["pending", "failed"]);

  if (error) return { error: error.message };
  return {
    success: true,
    cleared: count ?? 0,
    message: `Cleared ${count ?? 0} jobs from queue`,
  };
}

async function handleQueueStats(
  adminClient: any,
): Promise<Record<string, unknown>> {
  const { data, error } = await adminClient.from("job_queue").select("status");

  if (error) return { error: error.message };

  const stats = (data || []).reduce(
    (acc: Record<string, number>, row: { status: string }) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    {},
  );

  return { success: true, stats, total: data?.length ?? 0 };
}

async function handleUserDisable(
  args: Record<string, string>,
  adminClient: any,
): Promise<Record<string, unknown>> {
  const { email } = args;
  if (!email) return { error: "email is required" };

  const { data: users, error: listErr } =
    await adminClient.auth.admin.listUsers();
  if (listErr) return { error: listErr.message };

  const target = users.users.find((u: any) => u.email === email);
  if (!target) return { error: `User with email ${email} not found` };

  const { error } = await adminClient.auth.admin.updateUserById(target.id, {
    ban_duration: PERMANENT_BAN_DURATION,
  });

  if (error) return { error: error.message };
  return {
    success: true,
    message: `User ${email} has been disabled`,
    user_id: target.id,
  };
}

async function handleUserPromote(
  args: Record<string, string>,
  adminClient: any,
): Promise<Record<string, unknown>> {
  const { email } = args;
  if (!email) return { error: "email is required" };

  const { data: users, error: listErr } =
    await adminClient.auth.admin.listUsers();
  if (listErr) return { error: listErr.message };

  const target = users.users.find((u: any) => u.email === email);
  if (!target) return { error: `User with email ${email} not found` };

  const { error } = await adminClient
    .from("user_roles")
    .upsert({ user_id: target.id, role: "admin" }, { onConflict: "user_id" });

  if (error) return { error: error.message };
  return {
    success: true,
    message: `User ${email} promoted to admin`,
    user_id: target.id,
  };
}

async function handleSystemHealth(
  adminClient: any,
): Promise<Record<string, unknown>> {
  const checks: Record<string, unknown> = {};

  // DB check
  const { error: dbErr, count } = await adminClient
    .from("user_roles")
    .select("id", { count: "exact", head: true });
  checks.database = dbErr
    ? { status: "error", detail: dbErr.message }
    : { status: "ok", users: count };

  // Queue check
  const { data: qData, error: qErr } = await adminClient
    .from("job_queue")
    .select("status");
  const qStats = (qData || []).reduce(
    (acc: Record<string, number>, r: { status: string }) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {},
  );
  checks.queue = qErr
    ? { status: "error", detail: qErr.message }
    : { status: "ok", stats: qStats };

  // Recent errors check
  const { data: errData } = await adminClient
    .from("agent_runs")
    .select("id, started_at")
    .in("status", ["failed", "completed_with_errors"])
    .order("started_at", { ascending: false })
    .limit(1);

  checks.last_error =
    errData && errData.length > 0 ? { timestamp: errData[0].started_at } : null;

  checks.api = { status: "ok", timestamp: new Date().toISOString() };

  return { success: true, checks, timestamp: new Date().toISOString() };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth: require valid JWT ─────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Missing authorization" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: authErr,
    } = await callerClient.auth.getUser();
    if (authErr || !callerUser)
      return respond({ error: "Invalid session" }, 401);

    // ── Auth: require admin role ────────────────────────────────────────────
    const { data: roleData } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return respond({ error: "Forbidden: admin role required" }, 403);
    }

    // ── Rate limiting: 30 commands per minute per admin ─────────────────────
    if (!checkRateLimit(`admin-command:${callerUser.id}`, 30, 60_000)) {
      return respond(
        { error: "Rate limit exceeded. Max 30 commands per minute." },
        429,
      );
    }

    const body = await req.json();
    const { command, args = {} } = body as {
      command: string;
      args: Record<string, string>;
    };

    // ── Validate command against registry ───────────────────────────────────
    if (!command || !COMMAND_REGISTRY.has(command)) {
      return respond(
        {
          error: `Unknown command: "${command}". Allowed commands: ${[...COMMAND_REGISTRY].join(", ")}`,
        },
        400,
      );
    }

    // ── Execute with privileged admin client ────────────────────────────────
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let result: Record<string, unknown>;

    switch (command) {
      case "agent.retry":
        result = await handleAgentRetry(args, adminClient);
        break;
      case "agent.run":
        result = await handleAgentRun(args, adminClient, callerUser.id);
        break;
      case "queue.clear":
        result = await handleQueueClear(adminClient);
        break;
      case "queue.stats":
        result = await handleQueueStats(adminClient);
        break;
      case "user.disable":
        result = await handleUserDisable(args, adminClient);
        break;
      case "user.promote":
        result = await handleUserPromote(args, adminClient);
        break;
      case "system.health":
        result = await handleSystemHealth(adminClient);
        break;
      default:
        return respond({ error: "Command not implemented" }, 501);
    }

    const success = !result.error;

    // ── Audit log: record every command execution ───────────────────────────
    await adminClient.from("admin_command_log").insert({
      admin_id: callerUser.id,
      command,
      args,
      result,
      success,
      executed_at: new Date().toISOString(),
    });

    return respond({
      command,
      args,
      result,
      success,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("admin-command error:", err);
    return respond({ error: "Internal server error" }, 500);
  }
});
