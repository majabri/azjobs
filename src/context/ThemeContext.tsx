/* eslint-disable react-refresh/only-export-components */
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

function applyTheme(theme: ThemeOption) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeOption>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('theme')
        .eq('user_id', user.id)
        .single();
      const saved = (data?.theme as ThemeOption) || 'system';
      setThemeState(saved);
      const resolved = applyTheme(saved);
      setResolvedTheme(resolved);
    });
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = applyTheme('system');
      setResolvedTheme(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = async (newTheme: ThemeOption) => {
    setThemeState(newTheme);
    const resolved = applyTheme(newTheme);
    setResolvedTheme(resolved);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('profiles')
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
