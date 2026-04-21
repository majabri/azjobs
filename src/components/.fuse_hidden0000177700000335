import { useTheme, type ThemeOption } from '@/context/ThemeContext';

const OPTIONS: { value: ThemeOption; label: string; desc: string }[] = [
  { value: 'light',  label: 'Light',      desc: 'Clean white interface'  },
  { value: 'dark',   label: 'Dark',        desc: 'Easy on the eyes'       },
  { value: 'system', label: 'Automatic',   desc: 'Follows system setting' },
];

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-picker-section">
      <h3 className="theme-picker-title">Appearance</h3>
      <p className="theme-picker-sub">Choose how iCareerOS looks for you</p>
      <div className="theme-picker-grid">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`theme-opt-card${theme === opt.value ? ' selected' : ''}`}
            onClick={() => setTheme(opt.value)}
            aria-pressed={theme === opt.value}
          >
            {theme === opt.value && <span className="theme-sel-dot" aria-hidden="true" />}
            <div className={`theme-preview theme-preview--${opt.value}`} aria-hidden="true">
              <div className="preview-topbar">
                <span className="preview-logo-dot" />
                <span className="preview-logo-text" />
              </div>
              <div className="preview-body">
                <span className="preview-sidebar" />
                <div className="preview-main">
                  <span className="preview-bar accent" />
                  <span className="preview-bar" style={{ width: '75%' }} />
                  <span className="preview-bar" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
            <span className="theme-opt-label">{opt.label}</span>
            <span className="theme-opt-desc">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
