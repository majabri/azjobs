

## Job Seeker Profile — Plan

### What We're Building
A persistent, editable **Job Seeker Profile** page where users can store their personal/professional details (name, email, phone, summary, work experience, skills, education, certifications). The profile can be **auto-populated by uploading a resume** (AI extracts structured fields) and **manually edited** at any time. This profile then pre-fills the resume textarea on the Job Seeker analysis page.

### Database

Create a `job_seeker_profiles` table:
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, unique — one profile per user)
- `full_name`, `email`, `phone`, `location` (text, nullable)
- `summary` (text, nullable)
- `skills` (text[], nullable — array of skill strings)
- `work_experience` (jsonb, nullable — array of `{title, company, startDate, endDate, description}`)
- `education` (jsonb, nullable — array of `{degree, institution, year}`)
- `certifications` (text[], nullable)
- `updated_at` (timestamptz, default now())

RLS: Users can only read/insert/update/delete their own row (`auth.uid() = user_id`).

### Backend Function

Create an edge function `extract-profile-fields` that:
1. Accepts the raw resume text (already extracted)
2. Sends it to the Lovable AI gateway (Gemini 2.5 Flash) with a prompt to return structured JSON with name, email, phone, location, summary, skills, work experience, education, certifications
3. Returns the parsed JSON

### New Page: `/profile`

**`src/pages/Profile.tsx`** — A form-based profile editor with sections:
- **Header**: "My Profile" with Save button
- **Import from Resume**: Upload button (reuses existing `parseDocument`) → sends extracted text to `extract-profile-fields` edge function → populates form fields
- **Editable sections**: Personal info (name, email, phone, location), Professional Summary (textarea), Work Experience (dynamic list — add/remove entries), Skills (tag input), Education (dynamic list), Certifications (dynamic list)
- **Save**: Upserts to `job_seeker_profiles` table
- **Auto-load**: On mount, fetch existing profile from DB

### Integration with Job Seeker Page

- On the Job Seeker input page, add a "Load from Profile" button next to the resume textarea
- When clicked, fetch the user's profile and format it as plain text to populate the resume field

### Routing

- Add `/profile` route in `App.tsx` wrapped in `ProtectedRoute`
- Add a "My Profile" link in the navigation/UserMenu

### Files to Create/Modify
1. **Create** `supabase/functions/extract-profile-fields/index.ts`
2. **Create** `src/pages/Profile.tsx`
3. **Migration** for `job_seeker_profiles` table + RLS
4. **Edit** `src/App.tsx` — add `/profile` route
5. **Edit** `src/pages/JobSeeker.tsx` — add "Load from Profile" button
6. **Edit** `src/components/UserMenu.tsx` — add Profile link

