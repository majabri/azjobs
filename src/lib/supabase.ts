// Shim: re-export the canonical Supabase client.
// Some older pages import '@/lib/supabase' — point them at the single instance.
export { supabase } from "@/integrations/supabase/client";
export type { Database } from "@/integrations/supabase/types";
