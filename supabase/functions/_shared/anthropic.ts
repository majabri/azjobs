/**
 * Shared Anthropic API client for Edge Functions.
 *
 * Replaces the former Lovable AI gateway proxy.  Every Edge Function that
 * previously called `https://ai.gateway.lovable.dev/v1/chat/completions`
 * should now import `callAnthropic` from this module instead.
 *
 * Usage:
 *   import { callAnthropic } from "../_shared/anthropic.ts";
 *   const reply = await callAnthropic({ system: "...", userMessage: "..." });
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

export interface AnthropicOptions {
  /** System prompt */
  system?: string;
  /** Single user message (convenience shorthand) */
  userMessage?: string;
  /** Full messages array — takes precedence over userMessage */
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Model id. Defaults to claude-sonnet-4-20250514 */
  model?: string;
  /** Max tokens to sample. Defaults to 4096 */
  maxTokens?: number;
  /** Temperature 0–1. Defaults to 0.7 */
  temperature?: number;
}

export interface AnthropicResponse {
  content: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

export async function callAnthropic(opts: AnthropicOptions): Promise<AnthropicResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const messages = opts.messages ?? [{ role: "user" as const, content: opts.userMessage ?? "" }];

  const body: Record<string, unknown> = {
    model: opts.model ?? "claude-sonnet-4-20250514",
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.7,
    messages,
  };

  if (opts.system) {
    body.system = opts.system;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  return {
    content: data.content?.[0]?.text ?? "",
    model: data.model,
    usage: data.usage ?? { input_tokens: 0, output_tokens: 0 },
  };
}
