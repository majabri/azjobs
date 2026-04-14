# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities by opening a **private security advisory** on the
[GitHub Security tab](../../security/advisories/new) rather than a public issue.

---

## Required Environment Variables

Copy `.env.example` to `.env` and populate the values before running the project locally.

| Variable | Where used | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend (Vite) | Supabase project URL |
| `VITE_SUPABASE_PROJECT_ID` | Frontend (Vite) | Supabase project reference ID |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend (Vite) | Supabase **anon** (public) key |

Edge Functions additionally rely on the following variables that are injected automatically
by the Supabase runtime and must **never** be hardcoded:

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | Injected by Supabase runtime |
| `SUPABASE_ANON_KEY` | Injected by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected by Supabase runtime – treat as a secret |
| `LOVABLE_API_KEY` | Set as a Supabase secret via `supabase secrets set` |

### Setting edge-function secrets

```sh
supabase secrets set LOVABLE_API_KEY=<value>
```

---

## Rules: .env Must Never Be Committed

`.env` and `.env.*` files are listed in `.gitignore`. **Never remove those entries.**

If a secret is accidentally committed:
1. Rotate / revoke the exposed secret immediately.
2. Remove it from the file and from git history (use `git filter-repo` or BFG Repo Cleaner).
3. Force-push all branches and tags.

---

## Edge-Function Authentication

All Supabase Edge Functions that handle user data or trigger billable operations
have `verify_jwt = true` in `supabase/config.toml`.  In addition, each function
performs an explicit auth check at the handler level as defense-in-depth.

Functions that are intentionally public (e.g. scheduled background jobs invoked
by the Supabase scheduler with a service-role token) keep `verify_jwt = false`
and must implement their own caller-validation logic.
