import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeOption = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: ThemeOption;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeOption) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: async () => {},
});

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemeOption): 'light' | 'dark' {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  try { localStorage.setItem('icareeros-theme', JSON.stringify(theme)); } catch (_) {}
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeOption>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('theme')
        .eq('user_id', user.id)
        .single();
      const saved = (data?.theme as ThemeOption) || 'system';
      setThemeState(saved);
      setResolvedTheme(applyTheme(saved));
    });
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setResolvedTheme(applyTheme('system'));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = async (newTheme: ThemeOption) => {
    setThemeState(newTheme);
    setResolvedTheme(applyTheme(newTheme));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('user_profiles')
      .update({ theme: newTheme })
      .eq('user_id', user.id);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
