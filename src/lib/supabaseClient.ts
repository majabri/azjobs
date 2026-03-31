// Re-export the canonical Supabase client so that all code uses a single
// instance backed by environment variables. Do NOT put real credentials here.
export { supabase } from "@/integrations/supabase/client";
