/**
 * Support Service — Core business logic.
 * Owns: ticket CRUD, FAQ queries.
 * No cross-service imports.
 */

import { supabase } from "@/integrations/supabase/client";
import type { SupportTicket, CreateTicketPayload, FaqEntry } from "./types";

export async function createTicket(
  userId: string,
  payload: CreateTicketPayload
): Promise<{ ok: boolean; ticket?: SupportTicket; error?: string }> {
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: userId,
      request_type: payload.request_type,
      title: payload.title.trim().slice(0, 100),
      description: payload.description.trim(),
      priority: payload.priority,
      email: payload.email || null,
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

export async function getFaqs(): Promise<FaqEntry[]> {
  const { data, error } = await supabase
    .from("support_faq")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true });

  if (error || !data) return [];
  return data as unknown as FaqEntry[];
}
