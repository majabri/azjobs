# iCareerOS — Claude Workspace Instructions

> These rules apply to all Claude sessions working in this repo.

## Supabase Project Refs

| Environment | Ref | Name |
|---|---|---|
| **Production** | `bryoehuhhhjqcueomgev` | CareerPlatform |
| **Staging** | `muevgfmpzykihjuihnga` | icareeros-staging (created 2026-04-19) |

⚠️ The ref `gberhsbddthwkjimsqig` (old Lovable project) **no longer exists** in the org. Do not reference it anywhere.

## Branch Policy

- All work targets `dev`. Feature branches from `dev`, PR back to `dev`.
- **Never push to `main`** — main is protected and deployment-gated.
- Delete feature branches after merge.

## Stack Quick Reference

| Component | Technology |
|---|---|
| Framework | React 18 + TypeScript 5.8 |
| Build | Vite + Bun |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL, Edge Functions, Auth) |
| Hosting | Vercel (jabri-solutions team) |
| Payments | Stripe + Stripe Connect |
| AI | Anthropic Claude |
| Email | Resend |

## Edge Function Invocation

Always use `supabase.functions.invoke("<fn>", { body })` — never raw `fetch(VITE_SUPABASE_URL/functions/v1/...)`.

Exception: SSE streaming responses (e.g. `mock-interview`) require raw fetch with `resp.body?.getReader()`.

## Active Edge Functions (verified 2026-04-20)

`discover-jobs`, `career-path-analysis`, `match-jobs`, `discovery-agent`, `search-jobs`,
`generate-outreach`, `salary-projection`, `learning-insights`, `interview-predictor`,
`extract-profile-fields`, `rewrite-resume`, `generate-cover-letter`,
`generate-interview-prep`, `generate-followup-email`, `recruiter-assistant`

SSE streaming (raw fetch exception): `mock-interview`, `rewrite-resume`, `generate-cover-letter`,
`generate-interview-prep`, `generate-followup-email`, `recruiter-assistant`

## Never

- Commit secrets or `.env` values
- Modify production schema without explicit approval
- Touch DNS or registrar settings
