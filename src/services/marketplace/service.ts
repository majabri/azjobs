import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ServiceCatalog, ServicePackage, CatalogOrder, ServiceReview } from "./types";

type ServiceCatalogRow = Database["public"]["Tables"]["service_catalog"]["Row"];
type ServiceCatalogInsert = Database["public"]["Tables"]["service_catalog"]["Insert"];
type ServicePackageInsert = Database["public"]["Tables"]["service_packages"]["Insert"];
type CatalogOrderInsert = Database["public"]["Tables"]["catalog_orders"]["Insert"];
type ServiceReviewInsert = Database["public"]["Tables"]["service_reviews"]["Insert"];

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

// ── Services ──────────────────────────────────────────
export async function fetchPublishedServices(): Promise<ServiceCatalog[]> {
  const { data, error } = await supabase
    .from("service_catalog")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ServiceCatalog[];
}

export async function fetchMyServices(): Promise<ServiceCatalog[]> {
  const id = await uid();
  const { data, error } = await supabase
    .from("service_catalog")
    .select("*")
    .eq("seller_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ServiceCatalog[];
}

export async function fetchServiceById(serviceId: string): Promise<ServiceCatalog | null> {
  const { data, error } = await supabase
    .from("service_catalog")
    .select("*")
    .eq("id", serviceId)
    .single();
  if (error) return null;
  return data as ServiceCatalog;
}

export async function createService(svc: Partial<ServiceCatalog>): Promise<ServiceCatalog> {
  const id = await uid();
  const { data, error } = await supabase
    .from("service_catalog")
    .insert({ ...svc, seller_id: id } as ServiceCatalogInsert)
    .select()
    .single();
  if (error) throw error;
  return data as ServiceCatalog;
}

export async function updateService(serviceId: string, svc: Partial<ServiceCatalog>): Promise<void> {
  const { error } = await supabase
    .from("service_catalog")
    .update(svc as Partial<ServiceCatalogRow>)
    .eq("id", serviceId);
  if (error) throw error;
}

export async function deleteService(serviceId: string): Promise<void> {
  const { error } = await supabase
    .from("service_catalog")
    .delete()
    .eq("id", serviceId);
  if (error) throw error;
}

// ── Packages ──────────────────────────────────────────
export async function fetchPackages(serviceId: string): Promise<ServicePackage[]> {
  const { data, error } = await supabase
    .from("service_packages")
    .select("*")
    .eq("service_id", serviceId)
    .order("price", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ServicePackage[];
}

export async function upsertPackages(serviceId: string, pkgs: Partial<ServicePackage>[]): Promise<void> {
  await supabase.from("service_packages").delete().eq("service_id", serviceId);
  const rows = pkgs.map((p) => ({ ...p, service_id: serviceId })) as ServicePackageInsert[];
  const { error } = await supabase.from("service_packages").insert(rows);
  if (error) throw error;
}

// ── Orders ────────────────────────────────────────────
export async function createOrder(order: Partial<CatalogOrder>): Promise<CatalogOrder> {
  const id = await uid();
  const { data, error } = await supabase
    .from("catalog_orders")
    .insert({ ...order, buyer_id: id } as CatalogOrderInsert)
    .select()
    .single();
  if (error) throw error;
  return data as CatalogOrder;
}

export async function fetchMyOrders(role: "buyer" | "seller"): Promise<CatalogOrder[]> {
  const id = await uid();
  const col = role === "buyer" ? "buyer_id" : "seller_id";
  const { data, error } = await supabase
    .from("catalog_orders")
    .select("*")
    .eq(col, id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CatalogOrder[];
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("catalog_orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw error;
}

// ── Reviews ───────────────────────────────────────────
export async function fetchReviews(serviceId: string): Promise<ServiceReview[]> {
  const { data, error } = await supabase
    .from("service_reviews")
    .select("*")
    .eq("service_id", serviceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ServiceReview[];
}

export async function createReview(review: Partial<ServiceReview>): Promise<void> {
  const id = await uid();
  const { error } = await supabase
    .from("service_reviews")
    .insert({ ...review, reviewer_id: id } as ServiceReviewInsert);
  if (error) throw error;
}
