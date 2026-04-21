import { supabase } from "@/integrations/supabase/client";
import type { ServiceCatalog, ServicePackage, CatalogOrder, ServiceReview } from "./types";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

// ── Services ──────────────────────────────────────────
export async function fetchPublishedServices(): Promise<ServiceCatalog[]> {
  const { data, error } = await supabase
    .from("service_catalog" as any)
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function fetchMyServices(): Promise<ServiceCatalog[]> {
  const id = await uid();
  const { data, error } = await supabase
    .from("service_catalog" as any)
    .select("*")
    .eq("seller_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function fetchServiceById(serviceId: string): Promise<ServiceCatalog | null> {
  const { data, error } = await supabase
    .from("service_catalog" as any)
    .select("*")
    .eq("id", serviceId)
    .single();
  if (error) return null;
  return data as any;
}

export async function createService(svc: Partial<ServiceCatalog>): Promise<ServiceCatalog> {
  const id = await uid();
  const { data, error } = await supabase
    .from("service_catalog" as any)
    .insert({ ...svc, seller_id: id } as any)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function updateService(serviceId: string, svc: Partial<ServiceCatalog>): Promise<void> {
  const { error } = await supabase
    .from("service_catalog" as any)
    .update(svc as any)
    .eq("id", serviceId);
  if (error) throw error;
}

export async function deleteService(serviceId: string): Promise<void> {
  const { error } = await supabase
    .from("service_catalog" as any)
    .delete()
    .eq("id", serviceId);
  if (error) throw error;
}

// ── Packages ──────────────────────────────────────────
export async function fetchPackages(serviceId: string): Promise<ServicePackage[]> {
  const { data, error } = await supabase
    .from("service_packages" as any)
    .select("*")
    .eq("service_id", serviceId)
    .order("price", { ascending: true });
  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function upsertPackages(serviceId: string, pkgs: Partial<ServicePackage>[]): Promise<void> {
  // delete existing then insert
  await supabase.from("service_packages" as any).delete().eq("service_id", serviceId);
  const rows = pkgs.map((p) => ({ ...p, service_id: serviceId }));
  const { error } = await supabase.from("service_packages" as any).insert(rows as any);
  if (error) throw error;
}

// ── Orders ────────────────────────────────────────────
export async function createOrder(order: Partial<CatalogOrder>): Promise<CatalogOrder> {
  const id = await uid();
  const { data, error } = await supabase
    .from("catalog_orders" as any)
    .insert({ ...order, buyer_id: id } as any)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function fetchMyOrders(role: "buyer" | "seller"): Promise<CatalogOrder[]> {
  const id = await uid();
  const col = role === "buyer" ? "buyer_id" : "seller_id";
  const { data, error } = await supabase
    .from("catalog_orders" as any)
    .select("*")
    .eq(col, id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("catalog_orders" as any)
    .update({ status } as any)
    .eq("id", orderId);
  if (error) throw error;
}

// ── Reviews ───────────────────────────────────────────
export async function fetchReviews(serviceId: string): Promise<ServiceReview[]> {
  const { data, error } = await supabase
    .from("service_reviews" as any)
    .select("*")
    .eq("service_id", serviceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function createReview(review: Partial<ServiceReview>): Promise<void> {
  const id = await uid();
  const { error } = await supabase
    .from("service_reviews" as any)
    .insert({ ...review, reviewer_id: id } as any);
  if (error) throw error;
}
