## Description
<!-- Brief explanation of what this PR does and why -->

**Type of Change:**
- [ ] 🐛 Bug fix
- [ ] ✨ New feature / edge function
- [ ] 📝 Documentation
- [ ] ♻️ Refactor (no behavior change)
- [ ] 🗄️ Database migration
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix

**Related issue / ticket:** <!-- Link or N/A -->

---

## ✅ PRE-DEPLOYMENT VALIDATION CHECKLIST

> **REQUIRED for all PRs** — the automated pipeline checks these too.
> Do NOT merge without completing this section.
> Context: [ICR-2026-04-25-001 postmortem](https://drive.google.com/file/d/12OVdNHesItN03YkiqDMbywjV1wHcoRY8/view)

### Schema Alignment (complete if touching `supabase/` or edge functions)
- [ ] Every `INSERT` statement explicitly sets **all columns involved in `CHECK` constraints**
- [ ] Counter/metric fields (`jobs_found`, `jobs_matched`, `applications_sent`, etc.) are initialized to `0`, not left implicit
- [ ] No `NULL` for constrained fields — unless intentional and documented below
- [ ] New migrations include `DEFAULT` values on numeric columns with constraints

**If you left any field as NULL intentionally, explain here:**
<!-- e.g. "status is nullable; constraint only applies when status = 'complete'" -->

### Code Quality
- [ ] INSERT statements have an inline comment explaining field initialization
- [ ] Any new `CHECK` constraint is documented in the migration file
- [ ] Migration includes `-- DOWN:` rollback comment or explicit rollback plan

### Testing
- [ ] Unit/integration test covers the INSERT → constraint path
- [ ] `bash scripts/validate-schema.sh` passes locally

### Documentation (complete if applicable)
- [ ] `docs/DEPLOY-CHECKLIST.md` updated (for prod migrations)
- [ ] `docs/AGENT_HANDOFF_YYYYMMDD.md` updated (for known-issue closures)

---

## How to Test
<!-- Steps for reviewer to verify this works correctly -->
1.
2.
3.

## Screenshots / Logs
<!-- Optional: paste relevant Supabase logs, test output, or UI screenshots -->
