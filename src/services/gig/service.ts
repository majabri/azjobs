/**
 * Gig Service — Core logic.
 */

import { supabase } from "@/integrations/supabase/client";
import { reportServiceError } from "@/lib/serviceEvents";
import type { Gig, GigBid } from "./types";

export async function fetchOpenGigs(): Promise<Gig[]> {
  try {
    const { data, error } = await supabase
      .from("gigs" as any)
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as any[]) || [];
  } catch (e) {
    await reportServiceError("gig", e);
    return [];
  }
}

export async function fetchMyGigs(): Promise<Gig[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
      .from("gigs" as any)
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as any[]) || [];
  } catch (e) {
    await reportServiceError("gig", e);
    return [];
  }
}

export async function createGig(gig: Partial<Gig>): Promise<Gig | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("gigs" as any)
      .insert({ ...gig, user_id: session.user.id } as any)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  } catch (e) {
    await reportServiceError("gig", e);
    return null;
  }
}

export async function submitBid(bid: { gig_id: string; amount: number; message: string }): Promise<GigBid | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("gig_bids" as any)
      .insert({ ...bid, bidder_id: session.user.id } as any)
      .select()
      .single();
    if (error) throw error;
    return data as any;
  } catch (e) {
    await reportServiceError("gig", e);
    return null;
  }
}

export async function fetchBidsForGig(gigId: string): Promise<GigBid[]> {
  try {
    const { data, error } = await supabase
      .from("gig_bids" as any)
      .select("*")
      .eq("gig_id", gigId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as any[]) || [];
  } catch (e) {
    await reportServiceError("gig", e);
    return [];
  }
}
