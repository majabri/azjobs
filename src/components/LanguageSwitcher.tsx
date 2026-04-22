import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

const languages = [
  { code: "en", label: "English", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "es", label: "Espa\u00f1ol", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "fr", label: "Fran\u00e7ais", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "de", label: "Deutsch", flag: "\u{1F1E9}\u{1F1EA}" },
] as const;

/**
 * FIX: Track whether the user_preferences table is available.
 * Shared with useLanguagePreference â if either detects the table
 * is missing, both stop trying.
 */
let tableUnavailable = false;

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const current =
    languages.find((l) => l.code === i18n.language) || languages[0];

  const changeLanguage = useCallback(
    async (code: string) => {
      await i18n.changeLanguage(code);
      localStorage.setItem("icareeros_language", code);

      // Persist to DB if logged in and table is available
      if (user && !tableUnavailable) {
        try {
          const { error } = await supabase.from("user_preferences").upsert(
            {
              user_id: user.id,
              language: code,
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "user_id" },
          );

          if (error) {
            const msg = (error.message ?? "").toLowerCase();
            const errCode = error.code ?? "";
            if (
              msg.includes("does not exist") ||
              msg.includes("relation") ||
              errCode === "42P01" ||
              errCode === "PGRST204"
            ) {
              tableUnavailable = true;
              logger.debug(
                "[LanguageSwitcher] user_preferences table unavailable â using localStorage only",
              );
            }
          }
        } catch {
          // silent â localStorage is the fallback
        }
      }
    },
    [i18n, user],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2">
          <Globe className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">
            {current.flag} {current.code.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={i18n.language === lang.code ? "bg-accent" : ""}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
