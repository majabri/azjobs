/**
 * ThemeSelector — Appearance settings section.
   * Three clickable cards (Light, Dark, Automatic) with mini-UI previews.
   * Clicking a card calls setTheme() immediately (auto-saves to Supabase).
   */

import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { Monitor, Sun, Moon } from "lucide-react";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Automatic", icon: Monitor },
];

/* ── Mini-UI preview thumbnails ──────────────────────────────────────────── */

function LightPreview() {
    return (
          <div className="w-full h-20 rounded-md overflow-hidden border border-[#E2E4EC] bg-[#F5F6FA] p-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#3B5BDB]" />
              <div className="h-1.5 w-12 rounded bg-[#E2E4EC]" />
            </div>
            <div className="flex-1 rounded bg-white border border-[#E2E4EC] p-1.5 flex flex-col gap-1">
              <div className="h-1.5 w-16 rounded bg-[#1C1F36] opacity-60" />
              <div className="h-1.5 w-12 rounded bg-[#9CA3AF] opacity-40" />
              <div className="h-1.5 w-8 rounded bg-[#3B5BDB] opacity-50" />
            </div>
          </div>
        );
}

function DarkPreview() {
    return (
          <div className="w-full h-20 rounded-md overflow-hidden border border-[#2A2F3E] bg-[#0F1117] p-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#748FFC]" />
              <div className="h-1.5 w-12 rounded bg-[#2A2F3E]" />
            </div>
            <div className="flex-1 rounded bg-[#161B27] border border-[#2A2F3E] p-1.5 flex flex-col gap-1">
              <div className="h-1.5 w-16 rounded bg-[#E8EAF6] opacity-60" />
              <div className="h-1.5 w-12 rounded bg-[#4B5563] opacity-40" />
              <div className="h-1.5 w-8 rounded bg-[#748FFC] opacity-50" />
            </div>
          </div>
        );
}

function AutoPreview() {
    return (
          <div className="w-full h-20 rounded-md overflow-hidden flex">
      {/* Left half: light */}
      <div className="w-1/2 bg-[#F5F6FA] border border-[#E2E4EC] border-r-0 rounded-l-md p-1.5 flex flex-col gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3B5BDB]" />
              <div className="flex-1 rounded-sm bg-white p-1 flex flex-col gap-0.5">
                <div className="h-1 w-8 rounded bg-[#1C1F36] opacity-50" />
                <div className="h-1 w-6 rounded bg-[#9CA3AF] opacity-30" />
              </div>
            </div>
      {/* Right half: dark */}
            <div className="w-1/2 bg-[#0F1117] border border-[#2A2F3E] border-l-0 rounded-r-md p-1.5 flex flex-col gap-1">
        <div className="w-2.5 h-2.5 rounded-full bg-[#748FFC]" />
                      <div className="flex-1 rounded-sm bg-[#161B27] p-1 flex flex-col gap-0.5">
                        <div className="h-1 w-8 rounded bg-[#E8EAF6] opacity-50" />
                        <div className="h-1 w-6 rounded bg-[#4B5563] opacity-30" />
                      </div>
                    </div>
                  </div>
                );
       }

const previews: Record<ThemePreference, () => JSX.Element> = {
  light: LightPreview,
      dark: DarkPreview,
      system: AutoPreview,
    };

/* ── Main component ──────────────────────────────────────────────────────── */

export default function ThemeSelector() {
    const { theme, setTheme } = useTheme();

  return (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Appearance</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose how iCareerOS looks. Select Automatic to match your system settings.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
{OPTIONS.map(({ value, label, icon: Icon }) => {
          const isSelected = theme === value;
          const Preview = previews[value];

          return (
            <button
              key={value}
              type="button"
                              onClick={() => setTheme(value)}
              className={`
                                relative flex flex-col items-center gap-2 rounded-xl p-3
                                border-2 transition-all duration-150 cursor-pointer
                                hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                                ${isSelected
                                  ? "border-[var(--brand,#3B5BDB)] bg-[var(--bg-surface,#FFFFFF)] shadow-sm"
                                  : "border-border bg-card hover:border-muted-foreground/30"
                }
                              `}
              aria-pressed={isSelected}
                              aria-label={`${label} theme`}
                            >
                {/* Selected indicator dot */}
                              <div
                                className={`
                                  w-2.5 h-2.5 rounded-full transition-colors duration-150
                                  ${isSelected
                    ? "bg-[var(--brand,#3B5BDB)]"
                                    : "bg-border"
                }
                `}
              />

                {/* Preview thumbnail */}
                              <Preview />

                {/* Label */}
              <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-foreground">{label}</span>
                              </div>
                            </button>
                          );
})}
      </div>
            </div>
          );
}
