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

const languages = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
] as const;

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const current = languages.find((l) => l.code === i18n.language) || languages[0];

  const changeLanguage = useCallback(
    async (code: string) => {
      await i18n.changeLanguage(code);
      localStorage.setItem("fitcheck_language", code);

      // Persist to DB if logged in
      if (user) {
        try {
          await supabase.from("user_preferences" as any).upsert(
            {
              user_id: user.id,
              preference_key: "language",
              preference_value: code,
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "user_id,preference_key" }
          );
        } catch {
          // silent — localStorage is the fallback
        }
      }
    },
    [i18n, user]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2">
          <Globe className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">{current.flag} {current.code.toUpperCase()}</span>
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
