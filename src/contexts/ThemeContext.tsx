/* eslint-disable react-refresh/only-export-components */
/**
 * ThemeContext — manages light / dark / system theme preference.
 *
 * On mount it reads the user's saved preference from `profiles.theme`.
 * When the preference is "system", it mirrors the OS setting via
 * `window.matchMedia('(prefers-color-scheme: dark)')`.
 *
 * The resolved theme ("light" | "dark") is applied to the `<html>` element
 * as `data-theme="light"` or `data-theme="dark"`.
 *
 * `setTheme` updates both the DOM immediately and the Supabase row
 * (fire-and-forget — we don't block the UI on DB writes).
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** The user's stored preference (light | dark | system) */
  theme: ThemePreference;
  /** The actual theme applied to the DOM */
  resolved: ResolvedTheme;
  /** Change the preference — updates DOM + Supabase */
  setTheme: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* ── helpers ─────────────────────────────────────────────────────────────── */

const MQ = "(prefers-color-scheme: dark)";

function getOSTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(MQ).matches ? "dark" : "light";
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? getOSTheme() : pref;
}

function applyToDOM(resolved: ResolvedTheme) {
  const html = document.documentElement;
  html.setAttribute("data-theme", resolved);
  // Keep className in sync so Tailwind dark: utilities also work
  html.classList.toggle("dark", resolved === "dark");
}

/* ── provider ────────────────────────────────────────────────────────────── */

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolve("system"),
  );

  // On mount / user change — read saved preference from Supabase
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("theme")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (!error && data?.theme) {
          const pref = data.theme as ThemePreference;
          setThemeState(pref);
          const r = resolve(pref);
          setResolved(r);
          applyToDOM(r);
        }
      } catch {
        // silently fall back to system
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Listen for OS theme changes when preference is "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mq = window.matchMedia(MQ);

    function handler() {
      const r = getOSTheme();
      setResolved(r);
      applyToDOM(r);
    }

    // Apply immediately
    handler();

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // setTheme — update state + DOM + Supabase
  const setTheme = useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      const r = resolve(next);
      setResolved(r);
      applyToDOM(r);

      // Persist to Supabase (fire-and-forget)
      if (user) {
        supabase
          .from("profiles")

          .update({ theme: next } as any)
          .eq("id", user.id)
          .then(({ error }) => {
            if (error)
              logger.warn(
                "[ThemeContext] Failed to persist theme:",
                error.message,
              );
          });
      }
    },
    [user],
  );

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Consume the ThemeContext. Must be used inside <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
