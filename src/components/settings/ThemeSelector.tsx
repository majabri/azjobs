/**
 * ThemeSelector — Appearance section for /settings.
 * Three clickable cards (Light, Dark, Automatic) with mini-UI preview thumbnails.
 * Clicking a card calls setTheme() immediately; preference auto-saves to Supabase.
 */

import React from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

const OPTIONS = [
  {
    value: 'light' as const,
    label: 'Light',
    desc: 'Clean white interface',
    preview: (
      <div className="h-12 rounded-md overflow-hidden border border-border">
        <div className="h-4 bg-white border-b border-border flex items-center px-2 gap-1">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <div className="w-8 h-1.5 rounded bg-slate-200" />
        </div>
        <div className="flex h-8 bg-slate-50">
          <div className="w-4 bg-white border-r border-border" />
          <div className="flex-1 p-1 flex flex-col gap-0.5">
            <div className="h-1.5 w-3/5 rounded bg-indigo-200" />
            <div className="h-1.5 w-4/5 rounded bg-slate-200" />
          </div>
        </div>
      </div>
    ),
  },
  {
    value: 'dark' as const,
    label: 'Dark',
    desc: 'Easy on the eyes',
    preview: (
      <div className="h-12 rounded-md overflow-hidden border border-slate-700">
        <div className="h-4 bg-[#161B27] border-b border-slate-700 flex items-center px-2 gap-1">
          <div className="w-2 h-2 rounded-full bg-indigo-400" />
          <div className="w-8 h-1.5 rounded bg-slate-600" />
        </div>
        <div className="flex h-8 bg-[#0F1117]">
          <div className="w-4 bg-[#161B27] border-r border-slate-700" />
          <div className="flex-1 p-1 flex flex-col gap-0.5">
            <div className="h-1.5 w-3/5 rounded bg-indigo-500" />
            <div className="h-1.5 w-4/5 rounded bg-slate-700" />
          </div>
        </div>
      </div>
    ),
  },
  {
    value: 'system' as const,
    label: 'Automatic',
    desc: 'Follows your device',
    preview: (
      <div className="h-12 rounded-md overflow-hidden border border-border flex">
        <div className="w-1/2 flex flex-col">
          <div className="h-4 bg-white border-b border-r border-border flex items-center px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          </div>
          <div className="flex-1 bg-slate-50 border-r border-border" />
        </div>
        <div className="w-1/2 flex flex-col">
          <div className="h-4 bg-[#161B27] border-b border-slate-700 flex items-center px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          </div>
          <div className="flex-1 bg-[#0F1117]" />
        </div>
      </div>
    ),
  },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">Appearance</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose how iCareerOS looks for you
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={[
              'rounded-xl border-2 p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              theme === opt.value
                ? 'border-primary bg-accent'
                : 'border-border bg-card hover:border-primary/40',
            ].join(' ')}
          >
            {opt.preview}
            <div className="mt-2 flex items-center gap-1.5">
              {theme === opt.value && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              )}
              <span className="text-xs font-medium text-foreground">{opt.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ThemeSelector;
