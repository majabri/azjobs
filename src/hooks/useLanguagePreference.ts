import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/lib/i18n";

/**
 * On login, loads the user's saved language preference from the database
 * and applies it. Falls back to localStorage / browser detection.
 */
export function useLanguagePreference() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const { data } = await supabase
          .from("user_preferences" as any)
          .select("preference_value")
          .eq("user_id", user.id)
          .eq("preference_key", "language")
          .maybeSingle();

        const row = data as any;
        if (row?.preference_value && row.preference_value !== i18n.language) {
          await i18n.changeLanguage(row.preference_value);
          localStorage.setItem("icareeros_language", row.preference_value);
        }
      } catch {
        // silent — localStorage fallback is already active
      }
    })();
  }, [user]);
}
