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

        if (data?.preference_value && data.preference_value !== i18n.language) {
          await i18n.changeLanguage(data.preference_value as string);
          localStorage.setItem("fitcheck_language", data.preference_value as string);
        }
      } catch {
        // silent — localStorage fallback is already active
      }
    })();
  }, [user]);
}
