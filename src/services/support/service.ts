/**
 * Support Service — Core business logic.
 * Owns: ticket CRUD, FAQ queries.
 * No cross-service imports.
 */

import { supabase } from "@/integrations/supabase/client";
import type { SupportTicket, CreateTicketPayload, FaqEntry } from "./types";

/** Map legacy request_type values to the new category enum */
function toCategory(requestType: string): string {
  const map: Record<string, string> = {
    bug_report: "bug",
    feature_request: "feature_request",
    enhancement_request: "feature_request",
    account_billing: "billing",
    account_issue: "account",
    data_issue: "general",
    general_feedback: "general",
  };
  return map[requestType] ?? "general";
}

export async function createTicket(
  userId: string,
  payload: CreateTicketPayload,
): Promise<{ ok: boolean; ticket?: SupportTicket; error?: string }> {
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: userId,
      request_type: payload.request_type,
      category: toCategory(payload.request_type),
      title: payload.title.trim().slice(0, 100),
      description: payload.description.trim(),
      priority: payload.priority,
      email: payload.email || null,
      source: "web",
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, ticket: data as unknown as SupportTicket };
}

export async function getUserTickets(userId: string): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data as unknown as SupportTicket[];
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string | null;
  body: string;
  is_internal_note: boolean;
  is_staff_reply: boolean;
  created_at: string;
}

export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as unknown as TicketMessage[];
}

export async function addTicketMessage(
  ticketId: string,
  userId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("ticket_messages").insert({
    ticket_id: ticketId,
    user_id: userId,
    body: body.trim(),
    is_internal_note: false,
    is_staff_reply: false,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getFaqs(): Promise<FaqEntry[]> {
  const { data, error } = await supabase
    .from("support_faq")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true });

  if (error || !data) return [];
  return data as unknown as FaqEntry[];
}
