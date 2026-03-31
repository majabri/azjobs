import { supabase } from "@/integrations/supabase/client";

export interface AdminCommandResponse {
  command: string;
  args: Record<string, string>;
  result: Record<string, unknown>;
  success: boolean;
  timestamp: string;
  error?: string;
}

export async function executeAdminCommand(
  command: string,
  args: Record<string, string> = {},
): Promise<AdminCommandResponse> {
  const { data, error } = await supabase.functions.invoke("admin-command", {
    body: { command, args },
  });

  if (error) {
    return {
      command,
      args,
      result: { error: error.message },
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }

  return data as AdminCommandResponse;
}

export const ALLOWED_COMMANDS = [
  {
    name: "agent.retry",
    description: "Retry a failed agent run",
    args: [{ name: "run_id", required: true, placeholder: "UUID of the run" }],
    example: 'agent.retry run_id="abc-123"',
  },
  {
    name: "agent.run",
    description: "Manually trigger an agent run with a job description",
    args: [{ name: "job_description", required: true, placeholder: "Software Engineer at Acme Corp" }],
    example: 'agent.run job_description="Software Engineer at Acme Corp"',
  },
  {
    name: "queue.clear",
    description: "Clear all pending and failed jobs from the queue",
    args: [],
    example: "queue.clear",
  },
  {
    name: "queue.stats",
    description: "Show current queue statistics",
    args: [],
    example: "queue.stats",
  },
  {
    name: "user.disable",
    description: "Disable a user account by email",
    args: [{ name: "email", required: true, placeholder: "user@example.com" }],
    example: 'user.disable email="user@example.com"',
  },
  {
    name: "user.promote",
    description: "Promote a user to admin by email",
    args: [{ name: "email", required: true, placeholder: "user@example.com" }],
    example: 'user.promote email="user@example.com"',
  },
  {
    name: "system.health",
    description: "Check overall system health",
    args: [],
    example: "system.health",
  },
] as const;

/**
 * Parse a command string like: `agent.retry run_id="abc-123"`
 * Returns { command, args } or null if invalid.
 */
export function parseCommandString(input: string): { command: string; args: Record<string, string> } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.match(/^(\S+)(.*)/s);
  if (!parts) return null;

  const command = parts[1];
  const rest = parts[2].trim();
  const args: Record<string, string> = {};

  if (rest) {
    const argMatches = rest.matchAll(/(\w+)=(?:"([^"]*?)"|'([^']*?)'|(\S+))/g);
    for (const m of argMatches) {
      args[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
    }
  }

  return { command, args };
}
