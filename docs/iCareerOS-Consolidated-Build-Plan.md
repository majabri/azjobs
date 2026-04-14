# iCareerOS -- AI-Powered Career Operating System
## Consolidated Phased Build Instruction

**Version:** April 2026 (aligned with iCareerOS rebrand)
**Repo:** https://github.com/majabri/azjobs
**Stack:** Vite + React 18 + TypeScript 5.8 + Tailwind + shadcn-ui + Supabase + Bun
**Production domain:** icareeros.com

---

## Important: Before Starting

All feature names, route labels, and module names in this document reflect the iCareerOS rebrand already applied to the codebase. Do not revert any of the following names back to their previous labels. The table below is the canonical reference for all user-facing terminology.

---

## Canonical Name Reference (do not override)

| Platform Module / Feature | Canonical iCareerOS Name |
|---|---|
| Dashboard | Mission Control |
| Find Jobs / Job Search | Opportunity Radar |
| Auto Apply | Autopilot Mode |
| Analyze Job Fit | Match Score Lab |
| Applications tracker | Pipeline |
| Offer Comparison | Offer Desk |
| Interview Prep | Interview Simulator |
| Career goals / trajectory | Flight Plan |
| My Profile | Career Profile |
| Gig Marketplace | Open Market |
| Service Catalog (Fiverr-style listings) | Skill Store |
| Skill gap analysis and tracking | Skill Radar |
| Professional network management | Network Tracker |
| Career progression and reputation score | Career XP |
| Admin Dashboard | Command Center |
| Agent Monitoring + All 5 agents collectively | The Crew Status |
| Log Stream | Event Log |
| Platform Settings / Feature Flags | Feature Control |
| System Health | System Monitor |
| Support Tickets | Support Inbox |
| Discovery AI Agent | Discovery Agent (part of The Crew Status) |
| Fit Scoring AI Agent | Match Agent (part of The Crew Status) |
| Optimization AI Agent | Resume Agent (part of The Crew Status) |
| Execution AI Agent | Application Agent (part of The Crew Status) |
| Growth AI Agent | Learning Agent (part of The Crew Status) |
| Platform brand name | iCareerOS |
| Production domain | icareeros.com |
| Primary CTA color | #00B8A9 (teal) |
| Gig/income accent color | #F5A623 (gold) |
| Platform tagline | Intelligent Career Operating System |

---

## Conflict Resolutions (Decisions Made)

The following decisions resolve all conflicts between the original 11-phase production plan and the 7-phase strategy document. These are binding for all subsequent phases.

1. **Primary teal color:** #00B8A9 is canonical. The tailwind.config.ts value of #2DD4BF from the landing page branch must be updated to #00B8A9. The gold accent is #F5A623 (not #F59E0B).

2. **Plan structure:** The original 11-phase plan is the engineering execution backbone. The 7-phase strategy document layers product vision, AI architecture, and messaging on top. This consolidated plan merges both into 11 phases -- infrastructure first, then product, then AI, then launch.

3. **Two-sided marketplace:** The employer side remains part of iCareerOS. The Crew Status and Career OS concept apply to the job-seeker/professional side. Employer features (job postings, talent search, invites) continue as planned. The new doc's Career OS layers and agent architecture apply to the professional user experience only.

4. **Routes:** The new canonical routes from the strategy doc replace the old generic routes for professional users. Employer and admin routes remain unchanged. Route mapping is specified in Phase 7 below.

5. **Domain:** icareeros.com is the production domain. All references to fitcheck.app are retired. Vercel custom domain setup targets icareeros.com.

6. **Package name:** The package.json name field is "icareeros" (lowercase, no hyphens).

7. **FitCheck references:** All remaining FitCheck references in production docs will be replaced with iCareerOS as part of Phase 1 (rebrand sweep).

8. **Database tables:** Backend table names (job_postings, projects, service_catalog, etc.) do not need to match the canonical UI names. The i18n layer and component labels handle the translation from internal names to user-facing canonical names.

9. **Missing canonical entries:** Skill Store, Skill Radar, Network Tracker, and Career XP are now added to the canonical table above. They are future modules built in Phase 8+ alongside the Crew automation.

10. **Supabase project ref:** Production is bryoehuhhhjqcueomgev (CareerPlatform). The old Lovable ref gberhsbddthwkjimsqig is deprecated and must not be used for any new deployments.

---

## Master Rules (All Phases)

- Run each phase sequentially. Confirm output before moving to the next phase.
- Never override the canonical names in the reference table above.
- Never use the name "FitCheck" or "azjobs" in any user-facing output.
- Never use emoji in any final copy output.
- All code changes follow the branch strategy: feature/* -> dev -> main via PR.
- Never push directly to main or dev.
- Always use bun (never npm).
- One issue, one branch, one PR per task.
- All builds must pass bun run build before a PR is opened.
- Run CI locally before pushing: bun run tsc --noEmit && bun run lint && bun run test && bun run build
- If a phase produces code, confirm CI passes before marking the phase complete.
- Report at the end of each phase: what was produced, what decisions were made, and any open questions before proceeding.

---

## PHASE 1 -- Foundation and Rebrand Sweep (Days 1-3)

**Purpose:** Stabilize the codebase, remove legacy dependencies, fix critical issues, and complete the iCareerOS rebrand across all files.

**Source:** Original Phase 1 + rebrand sweep from new strategy doc.

### Task 1.0 -- Production Readiness Assessment
- Files: phase-01/task-1.0/
- Run assessment script, fill in ASSESSMENT.md with results
- Branch: feature/assessment

### Task 1.1 -- Remove Lovable Dependencies
- Files: phase-01/task-1.1/
- Apply vite.config.ts changes
- Replace auth imports per auth-replacement-guide.md
- Replace LOVABLE_API_KEY with ANTHROPIC_API_KEY in Edge Functions
- Update package.json name to "icareeros"
- Update package.json description to "iCareerOS -- Intelligent Career Operating System"
- Update OAuth origins in Supabase Dashboard
- Verify: bun run build
- Branch: feature/remove-lovable

### Task 1.2 -- Fix /admin/settings
- Files: phase-01/task-1.2/fix-feature-flags-rls.sql
- Run diagnostic queries, apply CREATE POLICY statements
- Branch: fix/admin-settings

### Task 1.3 -- Fix Blank Admin Pages
- Files: phase-01/task-1.3/
- Fix /admin/system, /admin/tickets, /admin/surveys
- Run diagnostic SQL, create missing tables
- Branch: fix/admin-pages

### Task 1.4 -- Retire /admin/login
- Files: phase-01/task-1.4/admin-login-retirement.md
- Add Navigate redirect in router
- Fix post-signout redirect
- DO NOT remove resolve_admin_email RPC
- Branch: fix/retire-admin-login

### Task 1.5 -- Marketplace Feature Flags
- Files: phase-01/task-1.5/marketplace-feature-flags.sql
- Branch: feature/marketplace-flags

### Task 1.6 -- iCareerOS Rebrand Sweep (NEW)
- Replace all "FitCheck" references in:
  - EXECUTION-GUIDE.md
  - ASSESSMENT.md
  - LOVABLE-UI-PROMPTS.md
  - UI-BUILD-REPORT.md
  - Phase 10 and 11 docs
  - i18n locale files
  - Any remaining source code references
- Replace fitcheck.app domain references with icareeros.com
- Update tailwind.config.ts: primary teal to #00B8A9, gold to #F5A623
- Update i18n navigation.json keys to use canonical module names
- Verify: bun run build, all tests pass
- Branch: feature/rebrand-sweep

### Phase 1 Output
All critical bugs fixed. Lovable dependencies removed. Package named "icareeros." Every file in the repo uses iCareerOS branding. No FitCheck references remain.

---

## PHASE 2 -- Security Hardening (Days 1-2)

**Purpose:** Remove hardcoded keys, fix lockfiles, configure GitHub secrets.

**Source:** Original Phase 2 (unchanged).

### Task 2.1 -- Remove Hardcoded Keys
- Apply env validation to vite.config.ts and supabase/client.ts
- Branch: fix/remove-hardcoded-keys

### Task 2.2 -- Fix Dual Lockfile
- Run phase-02/task-2.2-fix-lockfile.sh
- Branch: fix/lockfile

### Task 2.3 -- GitHub Secrets
- Add ANTHROPIC_API_KEY, SUPABASE_ACCESS_TOKEN to GitHub Actions secrets
- Follow phase-02/task-2.3-github-secrets.md

### Phase 2 Output
No credentials in source code. Single lockfile (bun.lockb). All secrets in GitHub Actions and Supabase vault.

---

## PHASE 3 -- Deployment and CI/CD (Days 3-7)

**Purpose:** Production deployment on Vercel, Supabase environment separation, and CI hardening.

**Source:** Original Phases 3 + 4 + 5 consolidated. These are all infrastructure setup tasks that can run in the same week.

### Task 3.1 -- Vercel Deployment
- Files: phase-03/vercel-setup-guide.md
- Import repo to Vercel, configure Bun build
- Set production + preview env vars
- Add Vercel secrets to GitHub
- Configure custom domain: icareeros.com (NOT fitcheck.app)
- Branch: feature/vercel-setup

### Task 3.2 -- Supabase Environment Separation
- Files: phase-04/
- Create staging Supabase project
- Run rls-audit.sql in production
- Enable PITR, set alerts
- Update Supabase project ref to bryoehuhhhjqcueomgev in all configs
- Branch: feature/supabase-staging

### Task 3.3 -- CI/CD Hardening
- Files: phase-05/
- Copy ci.yml to .github/workflows/ci.yml
- Remove all continue-on-error: true from CI steps
- Follow branch-protection.md for GitHub settings
- Merge Dependabot PRs
- Branch: feature/ci-hardening

### Phase 3 Output
Live production deployment at icareeros.com. Separate staging environment. CI pipeline blocks on lint, type, and test failures. Branch protection enforced.

---

## PHASE 4 -- Observability and Code Quality (Week 2)

**Purpose:** Error tracking, monitoring, event bus, and TypeScript strictness.

**Source:** Original Phases 6 + 8 consolidated. Both are "make the codebase production-grade" work.

### Task 4.1 -- Observability Setup
- Files: phase-06/
- Install @sentry/react
- Add Sentry to src/main.tsx
- Follow observability-guide.md for BetterStack + DB alerts
- Branch: feature/observability

### Task 4.2 -- Event Bus
- Files: phase-08/task-8.1-*
- Run event-bus migration
- Add event registry and publisher to src/events/
- Add check:events script to package.json
- Branch: feature/event-bus

### Task 4.3 -- Auth Testing
- Follow phase-08/task-8.2-auth-test-matrix.md
- Branch: feature/auth-tests

### Task 4.4 -- TypeScript and SOA Cleanup
- Run bun run tsc --noEmit, fix errors
- Run bun run check:soa, fix violations
- Enable strictNullChecks incrementally
- Branch: feature/ts-strict

### Phase 4 Output
Sentry capturing errors. BetterStack monitoring. Event bus publishing platform events. TypeScript strict mode enabled. SOA violations resolved.

---

## PHASE 5 -- Market Intelligence and Career OS Definition (Week 2)

**Purpose:** Research, competitive analysis, and product category definition. No code -- pure strategy output.

**Source:** New strategy doc Phases 1 + 2 consolidated. Both are research and positioning work.

### Task 5.1 -- Market and Competitive Intelligence
Aggregate and analyze the following categories of platforms:

1. Job boards: LinkedIn, Dice, CareerBuilder, ZipRecruiter
2. Career platforms: CareerOS (careeros.com / highered.com/careeros)
3. Gig and freelance platforms: Fiverr, Upwork, Freelancer, Toptal

For each platform, output: core function, strengths, weaknesses, level of automation (none / partial / full), role in the career journey.

Then produce:

- Comparison table across all platforms and categories
- Gap analysis: major fragmentation points -- what a professional must do manually today that iCareerOS eliminates
- Unified platform argument: why a single intelligent system (the Crew running on a shared Career Profile kernel) solves what no individual platform can. Reference the canonical module names (Opportunity Radar, Match Score Lab, Autopilot Mode, Open Market, Skill Store, Flight Plan, Skill Radar, Network Tracker, Career XP)

### Task 5.2 -- Define Career OS Concept
Define "Career Operating System" as a new product category. Not a job board, not a tracker, not a resume tool. It is infrastructure that runs on behalf of the user.

Four layers (use these exact layer names):

**Layer 1 -- Career Identity Layer.** The kernel. The structured, living Career Profile that every other module reads from and writes to. Includes work history, skills, preferences, voice, and match history. Gets more accurate with every outcome. Maps to: Career Profile module.

**Layer 2 -- Opportunity Intelligence Layer.** Real-time discovery and scoring across jobs, gigs, and projects. AI ranks every opportunity by fit before the user sees it. Maps to: Opportunity Radar, Match Score Lab, Open Market, Skill Store modules.

**Layer 3 -- Execution Layer.** The autonomous action layer. The Crew Status agents apply, tailor, submit proposals, and follow up -- without requiring user input per action. Maps to: Autopilot Mode, Application Agent, Resume Agent, Pipeline, Offer Desk modules.

**Layer 4 -- Growth Layer.** The long-game layer. Continuously closes skill gaps, tracks reputation, builds network, and compounds career value over time. Maps to: Flight Plan, Skill Radar, Network Tracker, Career XP, Learning Agent, Interview Simulator modules.

Then produce:

- Career OS vs. alternatives table: three columns (Job Boards / Gig Platforms / iCareerOS), rows: who does the work, automation level, unified view, income layer, learns over time, for all professionals
- Category positioning statement (one sentence, bold, timeless)

### Phase 5 Output Format
Structured tables + narrative analysis. Production-ready copy suitable for an investor deck or internal strategy document. Saved as a document in the repo.

---

## PHASE 6 -- Mission, Vision, and Agent Architecture (Week 2-3)

**Purpose:** Lock in the brand mission/vision and design the five Crew agents.

**Source:** New strategy doc Phases 3 + 4 consolidated. Both are foundational definitions that feed into the MVP build.

### Task 6.1 -- Mission and Vision
Provide two options:

**Option A -- Bold, category-defining (Google-style)**
- Mission (1 sentence): what iCareerOS does for the world
- Vision (1-2 sentences): the world that exists once iCareerOS succeeds

**Option B -- Practical, user-focused (Apple-style)**
- Mission (1 sentence): what iCareerOS gives to each individual
- Vision (1-2 sentences): what a person's career looks like when they have iCareerOS

Rules for both options: no feature names, no jargon, must work as the first line of an investor pitch, a homepage, and a job offer letter. Must be true today and still true in 10 years.

Approved reference anchors (already validated -- use as benchmark to meet or exceed):

- Mission (approved): To organize and execute the world of career opportunities, making them universally accessible, personalized, and actionable for every individual.
- Vision (approved): A world where every person has an intelligent, always-on system that guides, grows, and executes their career -- empowering them to achieve their full potential across any path they choose.

After the two options, provide a recommended choice with a one-paragraph rationale.

### Task 6.2 -- Product Architecture: The Crew Status (AI Agents)
Design the five core AI agents. These agents are collectively called The Crew Status. Each agent is always running, shares the same Career Profile kernel, and feeds results back into the system.

**Agent 1 -- Discovery Agent**
Role: Finds jobs, gigs, and projects across all sources before they go viral.
Inputs: Career Profile (target roles, skills, location, salary range, automation level), real-time feeds from job boards and Open Market.
Outputs: Scored opportunity list sent to Match Agent; new listings added to Opportunity Radar.
Key functionality: Multi-source aggregation, deduplication, recency weighting, source prioritization.

**Agent 2 -- Match Agent**
Role: Evaluates user fit for every opportunity and generates a 0-100 Match Score.
Inputs: Opportunity data from Discovery Agent, Career Profile kernel.
Outputs: Match Score per opportunity; ranked feed to Mission Control and Opportunity Radar; low-fit filtered out.
Key functionality: Semantic skill matching, ATS keyword alignment, historical win-rate weighting, continuous score recalibration.

**Agent 3 -- Resume Agent**
Role: Automatically tailors the Career Profile and resume for each specific opportunity.
Inputs: Career Profile, job description or gig brief, Match Score data.
Outputs: Tailored resume per application, ATS optimization report, cover message draft.
Key functionality: Keyword insertion, tone matching, bullet rewriting, ATS score prediction, per-application version management.

**Agent 4 -- Application Agent**
Role: Executes career actions autonomously -- applies to jobs, submits gig proposals, follows up.
Inputs: Tailored resume from Resume Agent, Match Score threshold from Flight Plan, Autopilot Mode level.
Outputs: Submitted applications logged to Pipeline; confirmation to user; follow-up scheduled.
Key functionality: Form submission, proposal generation for Open Market, follow-up sequencing, rate limiting, user notification.

**Agent 5 -- Learning Agent**
Role: Improves the entire system by learning from every outcome.
Inputs: Application outcomes, user feedback, salary data from Offer Desk, skill gap data from Skill Radar.
Outputs: Updated Match Score weights, skill gap recommendations, Flight Plan adjustments, Career XP triggers.
Key functionality: Outcome attribution, A/B tracking of resume variations, trajectory recalibration, continuous kernel improvement.

**Agent Interaction Loop:**

```
Career Profile (kernel)
        |
Discovery Agent -> finds opportunities
        |
Match Agent -> scores each opportunity
        |
Resume Agent -> tailors profile per opportunity
        |
Application Agent -> executes on the user's behalf
        |
Learning Agent -> reads outcomes, updates the kernel
        ^
Career Profile (kernel -- now smarter)
```

The loop runs continuously in the background. The user interacts with Mission Control to review results, adjust Flight Plan settings, and act on high-priority notifications.

### Phase 6 Output Format
Mission/vision options with recommendation. Structured agent specifications, interaction loop diagram, data flow table. Saved as strategy documents in the repo.

---

## PHASE 7 -- MVP Build (Week 2-4)

**Purpose:** Build the core iCareerOS features for the professional user experience. This is the primary product build phase.

**Source:** New strategy doc Phase 5 + original Phase 7 employer features. Both are core feature builds that happen in the same sprint.

### Job Seeker / Professional Features

**Feature 1 -- Career Profile**
Route: /profile
- Resume upload (PDF / DOCX parsed into structured profile)
- Skills input and tagging
- Work experience (parsed from resume, editable)
- Target roles, companies, and salary range (Flight Plan settings)
- Autopilot Mode level selector (Manual / Smart / Full Auto)
- Branch: feature/career-profile

**Feature 2 -- Opportunity Radar**
Route: /job-search
- Aggregated feed: jobs + Open Market gigs in one view
- Search with filters: role, location, salary range, remote type, opportunity type (job / gig / project)
- Each card shows: title, company/poster, location, salary, source, and Match Score badge
- Save to Pipeline button per card
- Branch: feature/opportunity-radar

**Feature 3 -- Match Score Lab**
Route: /job-seeker
- Paste any job description
- System scores the Career Profile against it (0-100)
- Output: Match Score, skill gap list, ATS keyword suggestions
- One-click: add suggested keywords to Career Profile
- Branch: feature/match-score-lab

**Feature 4 -- Pipeline**
Route: /applications
- Kanban board: Saved -> Applied -> Interview -> Offer -> Rejected
- Each card: role, company, date, Match Score, source, notes
- Manual stage movement (drag or button)
- Application count and pipeline stage summary
- Branch: feature/pipeline

**Feature 5 -- Mission Control**
Route: /dashboard
- Career ROI Score (composite metric)
- Active Crew status (5 agents -- show live / paused / inactive)
- Recent activity feed (last 10 actions taken by any agent)
- Quick stats: applications this week, interviews scheduled, open gigs
- Flight Plan summary with edit link
- Branch: feature/mission-control

### Employer Features (from original Phase 7)

**Feature 6 -- Employer Dashboard and Routing**
- Files: phase-07/task-7.1-employer-role.sql, task-7.1-employer-routing.md
- Routes: /employer/dashboard, /employer/edit-profile
- Post-login routing: employer -> /employer/dashboard, job_seeker -> /dashboard, both -> /role-switcher, admin -> /admin/dashboard
- Branch: feature/employer-dashboard

**Feature 7 -- Job Postings (Employer)**
- Files: phase-07/task-7.2-job-postings.sql
- Routes: /employer/job-postings, /employer/job-postings/new, /employer/job-postings/:id
- Branch: feature/employer-jobs

**Feature 8 -- Talent Search (Employer)**
- Files: phase-07/task-7.3-talent-invites.sql
- Routes: /employer/talent-search, /employer/invites
- Branch: feature/talent-search

### UI Requirements

- Sticky left sidebar navigation using exact module names from the canonical table
- Sidebar links (professional): Mission Control, Opportunity Radar, Match Score Lab, Pipeline, Offer Desk, Interview Simulator, Open Market, Skill Store, Flight Plan, Career Profile, Settings, Support Inbox
- Sidebar links (employer): Mission Control, Job Postings, Talent Search, Company Profile, Settings
- Sidebar links (admin): Command Center, The Crew Status, Event Log, Feature Control, System Monitor, Support Inbox
- Clean card-based layout: white cards, soft shadow, 16px radius
- Teal (#00B8A9) for primary actions and active states
- Gold (#F5A623) for gig/income layer elements
- Responsive: single-column on mobile
- Empty states on every screen with a clear next-action CTA

### Phase 7 Output Format
Working feature implementation on feature branches. Each PR to dev. Each feature confirmed working before moving to Phase 8.

---

## PHASE 8 -- Gig Marketplace and Service Catalog (Week 3-4) [DEFERRED]

> **Status: DEFERRED** — This phase is planned but not yet implemented. All specifications below are preserved for future development.

**Purpose:** Build the freelance/gig side of iCareerOS -- Open Market and Skill Store.

**Source:** Original Phases 9 + 10 (tasks 10.1, 10.3) consolidated. These are the marketplace build phases.

### Task 8.1 -- Open Market (Gig Marketplace)
- Files: phase-09/task-9.1-projects.sql (database), phase-09/task-9.2-lovable-prompt.md (UI), phase-09/task-9.3-*.ts (edge functions)
- Deploy gig-service, proposal-service, project-service edge functions
- Proposal retry logic: 3 attempts with exponential backoff (1s / 2s / 4s)
- Route: /open-market
- Branch: feature/open-market

### Task 8.2 -- Skill Store (Service Catalog)
- Files: phase-10/task-10.1-catalog.sql (database), phase-10/task-10.1-lovable-prompt.md (UI)
- Service creation with multiple packages/price tiers
- Buyer and talent order management
- Route: /skill-store
- Branch: feature/skill-store

### Task 8.3 -- Reputation System
- Files: phase-10/task-10.3-reputation.sql
- 1-5 star ratings, written reviews, helpful votes, moderation/reporting
- user_reputation_summary view
- Branch: feature/reputation

### Phase 8 Output Format
Working marketplace on dev. Projects, proposals, contracts, milestones, services, and reputation all functional. Edge functions deployed and healthy.

---

## PHASE 9 -- Automation Layer (Week 4-5) [DEFERRED]

> **Status: DEFERRED** — This phase is planned but not yet implemented. All specifications below are preserved for future development.

**Purpose:** Activate the Crew. Build Autopilot Mode, continuous discovery, smart prioritization, and the full agent control system.

**Source:** New strategy doc Phase 6 + original Phase 10 (tasks 10.2, 10.4) consolidated. Both are automation and infrastructure intelligence features.

### Task 9.1 -- Autopilot Mode (Application Agent Activation)
Three levels controlled from Mission Control and Career Profile:
- Manual: Crew discovers and scores; user applies manually
- Smart: Crew applies automatically above user's Match Score threshold (default 80%); user reviews before submission
- Full Auto: Crew applies to all above threshold without review

Per-application log in Pipeline with agent action timestamp. User can pause from Mission Control.
- Branch: feature/autopilot-mode

### Task 9.2 -- Open Market Proposal Automation
- Application Agent generates tailored proposals for gig listings above threshold
- Proposal queue: review and approve (Smart) or auto-submit (Full Auto)
- Proposal retry queue: 3x with exponential backoff (1s / 2s / 4s)
- Branch: feature/proposal-automation

### Task 9.3 -- Continuous Opportunity Discovery
- Discovery Agent polls on configurable schedule (default: every 2 hours)
- High-fit opportunities trigger push notification and Mission Control badge
- Opportunity Radar auto-refreshes; stale listings (48h+ no activity) auto-archived
- Branch: feature/continuous-discovery

### Task 9.4 -- Smart Prioritization
- Match Agent reranks Opportunity Radar in real time as new opportunities arrive
- Pipeline shows AI-recommended "next best action" per card
- Mission Control shows "Top 3 this week" section
- Branch: feature/smart-prioritization

### Task 9.5 -- Payments (Stripe Connect)
- Files: phase-10/task-10.2-billing-service.ts
- Stripe Connect integration for talent payouts
- Payment intent creation and webhook handling
- Failure rule: maxRetries = 1, immediate admin alert
- Branch: feature/payments

### Task 9.6 -- Self-Healing Recovery
- Files: phase-10/task-10.4-ai-recovery-service.ts, task-10.4-service-health-migration.sql
- Health check loop for all services
- Retry with exponential backoff, fallback activation
- Sentry alerting for critical failures
- Branch: feature/self-healing

### Automation Controls and Transparency
- Every automated action logged to Event Log (/admin/logs in Command Center, surfaced in Mission Control for regular users)
- Full action history per opportunity card in Pipeline
- The Crew Status screen (/admin/agents): each agent's last run, success rate, current state
- Users toggle individual agents on/off from Mission Control settings

### Phase 9 Output Format
Working automation on dev. Autopilot Mode functional at all three levels. Event Log confirmed receiving entries. Payments processing. Self-healing active.

---

## PHASE 10 -- Positioning, Messaging, and i18n (Week 5)

**Purpose:** Create the full messaging system and finalize internationalization.

**Source:** New strategy doc Phase 7 + original Phase 10 task 10.5 consolidated.

### Task 10.1 -- i18n Finalization
- Files: phase-10/task-10.5-i18n-setup.md
- All 4 languages (en, es, fr, de) updated with canonical module names
- LanguageSelector component
- User language preference persistence
- Branch: feature/i18n-finalization

### Task 10.2 -- Taglines (5 options)
Each under 8 words. Each communicates autonomy or operating system -- not job search assistance.

Approved taglines already in use (reference quality bar, do not duplicate):
- "Your career. On autopilot."
- "Stop applying. Start arriving."
- "The operating system for your career."

### Task 10.3 -- Homepage Headline and Sub-headline
- Headline: short, bold, action-oriented, max 8 words
- Sub-headline: 1-2 sentences explaining what the system does concretely, naming at least two specific functions
- Supporting line: 1 sentence, mission-level

### Task 10.4 -- Elevator Pitch (10 seconds / ~30 words)
What iCareerOS is, who it is for, and what it does differently -- in one breath.

### Task 10.5 -- 30-Second Investor Pitch
Structure:
1. The problem (1 sentence)
2. The market (1 sentence -- size and fragmentation)
3. The solution: iCareerOS (2 sentences -- what it is and how it works)
4. The differentiation (1 sentence -- what no other platform does)
5. The ask / traction (1 sentence)

### Task 10.6 -- Differentiation Narrative
Three paragraphs positioned against categories of competitor, not named companies. Do not name any specific platform, product, or company. Reference categories only.

1. iCareerOS vs. traditional job boards -- passive listing aggregators that require the user to do everything manually. Contrast with Discovery Agent, Match Agent, and Application Agent.
2. iCareerOS vs. freelance and gig platforms -- single-purpose marketplaces for one income type. Contrast with Open Market, Skill Store, and Autopilot Mode running both income streams in parallel.
3. iCareerOS vs. career management and tracking tools -- organizational tools that help manage but still require all the work. The distinction: a calendar vs. an assistant. Career management tools are calendars. iCareerOS is the assistant.

### Messaging Rules
- Use iCareerOS as the platform name (never FitCheck, never azjobs)
- Reference canonical module names
- Avoid jargon: no "leverage", no "synergy", no "robust", no "cutting-edge"
- Use present tense and active voice
- Be specific about automation

### Phase 10 Output Format
Structured messaging document with all outputs labeled. Production-ready copy for pitch deck, homepage, and marketing brief. i18n fully updated.

---

## PHASE 11 -- Launch Validation (Week 6)

**Purpose:** Full validation sweep, disaster recovery testing, and production launch.

**Source:** Original Phase 11 (expanded to include final consolidated output from strategy doc).

### Task 11.1 -- Validation Checklist
- Files: phase-11/validation-checklist.md
- Work through every checkbox (500+ items across all phases)
- All validation items must pass
- Branch: feature/validation

### Task 11.2 -- Disaster Recovery
- Files: phase-11/rollback-procedures.md
- Test PITR restore in staging
- Test Vercel frontend rollback
- Test Edge Function rollback
- Document all recovery times
- Run quarterly disaster recovery drill

### Task 11.3 -- Final Consolidated Document
Produce a single consolidated document containing:

1. **Platform Architecture Summary** -- the four layers, the five Crew agents, the module map, the data flow loop
2. **Brand Messaging System** -- all Phase 10 outputs in one block
3. **MVP and Automation Plan** -- Phase 7 and 9 feature list, routes, and agent responsibilities
4. **Investor-Ready Narrative** -- mission, vision, problem, solution, differentiation, traction -- formatted for a seed-stage pitch deck

### Task 11.4 -- Production Deploy
- Deploy to production at icareeros.com
- Verify all routes, all features, all agents
- Monitor Sentry and BetterStack for 48 hours post-launch

### Phase 11 Output
Platform live at icareeros.com. All validation passed. Disaster recovery tested. Consolidated strategy document complete and investor-ready.

---

## Phase Summary

| Phase | Name | Timeline | Source |
|---|---|---|---|
| 1 | Foundation and Rebrand Sweep | Days 1-3 | Original P1 + rebrand |
| 2 | Security Hardening | Days 1-2 | Original P2 |
| 3 | Deployment and CI/CD | Days 3-7 | Original P3 + P4 + P5 |
| 4 | Observability and Code Quality | Week 2 | Original P6 + P8 |
| 5 | Market Intelligence and Career OS Definition | Week 2 | New P1 + P2 |
| 6 | Mission, Vision, and Agent Architecture | Week 2-3 | New P3 + P4 |
| 7 | MVP Build | Week 2-4 | New P5 + Original P7 |
| 8 | Gig Marketplace and Service Catalog | Week 3-4 | Original P9 + P10 partial |
| 9 | Automation Layer | Week 4-5 | New P6 + Original P10 partial |
| 10 | Positioning, Messaging, and i18n | Week 5 | New P7 + Original P10.5 |
| 11 | Launch Validation | Week 6 | Original P11 + Final Output |

---

## What Was Consolidated

| Original 11-Phase Plan | New 7-Phase Strategy Doc | Consolidated Phase |
|---|---|---|
| P1: Foundation | -- | Phase 1 (+ rebrand sweep) |
| P2: Security | -- | Phase 2 |
| P3: Vercel + P4: Supabase + P5: CI/CD | -- | Phase 3 |
| P6: Observability + P8: Event Bus/Quality | -- | Phase 4 |
| -- | P1: Market Intelligence + P2: Career OS Definition | Phase 5 |
| -- | P3: Mission/Vision + P4: Agent Architecture | Phase 6 |
| P7: Two-Sided Marketplace | P5: MVP Build | Phase 7 |
| P9: Gig Marketplace + P10.1/10.3 | -- | Phase 8 |
| -- + P10.2/10.4 | P6: Automation Layer | Phase 9 |
| P10.5: i18n | P7: Positioning and Messaging | Phase 10 |
| P11: Launch Validation | Final Consolidated Output | Phase 11 |

---

## Existing Production Package Files

All files in fitcheck-production/ remain valid and are referenced by their original phase-XX/ paths throughout this document. The phase numbering in this consolidated plan differs from the folder structure -- the mapping above shows which original phase folders correspond to which consolidated phase.

| Consolidated Phase | Uses Files From |
|---|---|
| Phase 1 | phase-01/ |
| Phase 2 | phase-02/ |
| Phase 3 | phase-03/, phase-04/, phase-05/ |
| Phase 4 | phase-06/, phase-08/ |
| Phase 7 | phase-07/ |
| Phase 8 | phase-09/, phase-10/ (10.1, 10.3) |
| Phase 9 | phase-10/ (10.2, 10.4) |
| Phase 10 | phase-10/ (10.5) |
| Phase 11 | phase-11/ |
