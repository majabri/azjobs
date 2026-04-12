import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/lib/i18n";

/**
 * FIX: Cache whether the user_preferences table is available.
 * Once a 400/404 is returned (table missing), skip further queries
 * for the rest of the session to avoid noisy network errors.
 */
let tableUnavailable = false;

/**
 * On login, loads the user's saved language preference from the database
 * and applies it. Falls back to localStorage / browser detection.
 */
export function useLanguagePreference() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // If we already know the table is missing, skip the query entirely
    if (tableUnavailable) return;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_preferences" as any)
          .select("preference_value")
          .eq("user_id", user.id)
          .eq("preference_key", "language")
          .maybeSingle();

        // If the table does not exist Supabase returns a 400 / 404.
        // Cache this so we don't fire the same failing request on
        // every re-render or page navigation.
        if (error) {
          const code = (error as any)?.code ?? "";
          const msg = (error.message ?? "").toLowerCase();

          if (
            msg.includes("does not exist") ||
            msg.includes("relation") ||
            code === "42P01" || // PostgreSQL "undefined_table"
            code === "PGRST204" // PostgREST "table not found"
          ) {
            tableUnavailable = true;
            console.debug(
              "[useLanguagePreference] user_preferences table unavailable â falling back to localStorage"
            );
          }
          // Other transient errors are silently ignored; the
          // localStorage fallback is already active.
          return;
        }

        const row = data as any;
        if (row?.preference_value && row.preference_value !== i18n.language) {
          await i18n.changeLanguage(row.preference_value);
          localStorage.setItem("icareeros_language", row.preference_value);
        }
      } catch {
        // Network-level error â localStorage fallback is already active
      }
    })();
  }, [user]);
}
