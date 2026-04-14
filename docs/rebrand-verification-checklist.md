# iCareerOS Rebrand — Visual Verification Checklist

Tracks Issue #168. Run after all PRs #155–#167 have been merged to `dev` and deployed to staging.

---

## Pre-flight

- [ ] `dev` branch contains all 7 rebrand PRs (merged: #155, #157, #159, #161, #163, #165, #167)
- [ ] Supabase migration `20260414000000_user_theme_preference.sql` applied to staging DB
- [ ] Staging URL loaded in browser (Chrome recommended for DevTools console script)

---

## Landing Page (`/`)

| Check | Light | Dark |
|---|---|---|
| Header surface: `bg-card/95` — not solid primary fill | ☐ | ☐ |
| `ICareerOSLogo` renders orbital SVG with indigo ring | ☐ | ☐ |
| Wordmark: `iCareer` primary, `OS` foreground | ☐ | ☐ |
| Nav links: muted text, accent hover | ☐ | ☐ |
| "Sign In" button: solid indigo | ☐ | ☐ |
| "Try Demo" button: outlined, no fill | ☐ | ☐ |
| Mobile sticky bar: `bg-card/95 border-border` | ☐ | ☐ |
| Hero gradient: `from-indigo-900` (no navy) | ☐ | ☐ |
| All scroll sections visible without blank gaps | ☐ | ☐ |

---

## Auth Pages

| Check | Light | Dark |
|---|---|---|
| `/login` — 52px `ICareerOSLogo` visible | ☐ | ☐ |
| `/login` — wordmark correct split | ☐ | ☐ |
| `/signup` — same logo/wordmark | ☐ | ☐ |
| Form focus rings: indigo, not teal | ☐ | ☐ |
| Card background: `bg-card` (no hardcoded navy) | ☐ | ☐ |

---

## App Interior (post-login)

| Check | Light | Dark |
|---|---|---|
| Sidebar — 24px `ICareerOSLogo` | ☐ | ☐ |
| Sidebar wordmark correct | ☐ | ☐ |
| Sidebar active item: `bg-accent` or `bg-primary/10` | ☐ | ☐ |
| Dashboard cards: `bg-card border-border` | ☐ | ☐ |
| Primary buttons: indigo, not teal | ☐ | ☐ |
| Badge/pill tints: indigo accent | ☐ | ☐ |
| Links: `text-primary` (indigo) | ☐ | ☐ |

---

## Settings (`/settings`)

| Check | Light | Dark |
|---|---|---|
| Appearance section renders first | ☐ | ☐ |
| Three theme cards shown: Light, Dark, Automatic | ☐ | ☐ |
| Each card has mini-UI thumbnail | ☐ | ☐ |
| Selected card: `border-primary bg-accent` + indigo dot | ☐ | ☐ |
| Switching theme applies instantly (no reload) | ☐ | ☐ |
| Preference persists after page refresh | ☐ | N/A |

---

## Token Spot-checks (DevTools)

Open any route → DevTools → Elements → `<html>` → Computed tab. Verify:

| Token | Light expected | Dark expected |
|---|---|---|
| `--primary` | `228 69% 55%` | `228 96% 72%` |
| `--background` | `227 32% 97%` | `224 21% 8%` |
| `--card` | `0 0% 100%` | `222 28% 12%` |
| `--border` | `220 13% 91%` | `217 19% 27%` |

---

## Zero-Teal Console Script

On each route, open DevTools → Console and run `docs/verify-zero-teal.js`.

Expected output:

```
✅ Zero teal/navy computed styles found.
```

Routes to check:
- [ ] `/`
- [ ] `/login`
- [ ] `/signup`
- [ ] `/dashboard`
- [ ] `/settings`
- [ ] `/jobs` (or other interior route)

---

## Sign-off

| Reviewer | Date | Notes |
|---|---|---|
| | | |
