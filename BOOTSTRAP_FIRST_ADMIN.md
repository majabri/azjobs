# Bootstrap First Admin

> ⚠️ **DELETE AFTER FIRST USE** — Once the admin is created, remove the
> `bootstrap-first-admin` edge function and rotate the `BOOTSTRAP_TOKEN` secret.

## Overview

This edge function creates the very first admin account when **zero admins**
exist in the system. After an admin row is present it permanently refuses to
run (HTTP 403).

## Setup

### 1. Set the `BOOTSTRAP_TOKEN` secret

Choose a strong random token (e.g. `openssl rand -base64 32`). Then set it as
a backend secret in Lovable Cloud (or via `supabase secrets set`):

```
BOOTSTRAP_TOKEN=<your-random-token>
```

### 2. Deploy

The edge function deploys automatically when pushed via Lovable.

### 3. Call the function

```bash
curl -X POST \
  https://gberhsbddthwkjimsqig.supabase.co/functions/v1/bootstrap-first-admin \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: <your-random-token>" \
  -d '{}'
```

On success the response contains:

```json
{
  "ok": true,
  "email": "amir.jabri@icloud.com",
  "username": "azadmin",
  "tempPassword": "<random-32-char-password>",
  "message": "..."
}
```

### 4. First login

1. Go to **https://azjobs.lovable.app/admin/login**
2. Username: `azadmin` / Password: the `tempPassword` from the response
3. The app will redirect to `/admin/set-password` — choose a strong permanent password.

### 5. Clean up

- Delete or disable the `bootstrap-first-admin` edge function.
- Rotate (delete) the `BOOTSTRAP_TOKEN` secret.
- The function already refuses to run if any admin exists, but removing it is
  best practice.

## Security notes

- The function requires the `SUPABASE_SERVICE_ROLE_KEY` (auto-injected by the
  runtime) to create auth users.
- The `x-bootstrap-token` header prevents unauthorized calls.
- The password is never logged server-side.
