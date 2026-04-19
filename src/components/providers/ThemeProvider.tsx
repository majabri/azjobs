/* eslint-disable react-refresh/only-export-components */
/**
 * ThemeProvider — light / dark / system theme switcher.
 *
 * This is the canonical ThemeProvider for iCareerOS.
 * It delegates to the core implementation in ThemeContext and re-exports
 * a compatible API so components can import from either path.
 *
 * The resolved theme is applied to <html data-theme="light|dark"> and
 * the .dark class is kept in sync for Tailwind dark: utility classes.
 *
 * User preference is persisted to Supabase (profiles.theme_preference).
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Theme = 'light' | 'dark' | 'system';
/** Alias for backwards compatibility with existing components */
export type ThemePreference = Theme;

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => Promise<void>;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('system');
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Listen to OS dark/light changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load saved preference from Supabase when user logs in
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('theme_preference')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const pref = data?.theme_preference as Theme | null;
        if (pref && ['light', 'dark', 'system'].includes(pref)) {
          setThemeState(pref);
        }
      });
    return () => { cancelled = true; };
  }, [user]);

  // Apply data-theme and .dark class to <html> whenever theme or system pref changes
  useEffect(() => {
    const resolved = theme === 'system'
      ? (systemDark ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    // Keep .dark class in sync for Tailwind dark: utility classes
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [theme, systemDark]);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  const setTheme = async (t: Theme) => {
    setThemeState(t);
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ theme_preference: t } as never)
      .eq('user_id', user.id);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
