# iCareerOS Phase 6: Mission, Vision, and Agent Architecture

**Document Status:** Strategic Framework  
**Date:** April 2026  
**Scope:** Mission/Vision definition and product architecture (The Crew Status)

---

## SECTION 1: MISSION AND VISION

### Option A: Category-Defining (Google-style)

**Mission**  
To organize the world's career opportunities, making them universally accessible, personalized, and executable for every individual.

**Vision**  
A world where career growth is no longer limited by geography, networks, or information asymmetry. Every person has an intelligent system that continuously discovers, matches, and secures opportunities aligned with their goals, giving them the freedom to build the career they actually want.

---

### Option B: Practical, User-Focused (Apple-style)

**Mission**  
To give you a personal career operating system that knows your strengths, finds what fits, and handles the work of getting there.

**Vision**  
Your career is no longer a series of disconnected applications and rejections. You have one system that understands you, surfaces the right opportunities, prepares your application in seconds, and learns from every outcome—so you spend your time building skills and relationships, not searching and applying.

---

### Recommended Choice: **Option A (Category-Defining)**

**Rationale**

Option A is recommended as the primary mission and vision framework for iCareerOS. It provides the scope and category clarity required for investor communications while remaining grounded in user value. The framing—"organize the world's career opportunities"—positions iCareerOS alongside category leaders (Google's "organize the world's information") and establishes a market-wide ambition rather than a feature set. The vision explicitly names the barriers we remove (geography, networks, information asymmetry) and articulates the outcome: freedom to build the career one actually wants. This language works across investor pitches, job descriptions, and marketing, and it holds true whether iCareerOS achieves this in 2026 or 2036. Option B is equally valid for product marketing and user onboarding but carries more feature-specific language that may limit its longevity.

---

## SECTION 2: PRODUCT ARCHITECTURE — THE CREW STATUS

The Crew Status is a system of five autonomous agents that collaborate to discover, match, prepare, execute, and learn from career opportunities on behalf of the user. Each agent is responsible for a distinct stage of the opportunity pipeline and operates within a defined input/output contract.

### Agent Specifications

---

#### Agent 1: Discovery Agent

**Purpose**  
Identifies and aggregates career opportunities (jobs, gigs, projects, contracts) from multiple sources, deduplicates, and scores by relevance and recency.

**Inputs**
- Career Profile kernel (skills, experience, location, work preferences)
- Search parameters (job titles, industries, location radius, contract type)
- Historical click and application data

**Outputs**
- Scored opportunity list → Match Agent (for evaluation)
- Deduplicated listings → Opportunity Radar (user-facing feed)
- Metadata: source, freshness, match potential (preliminary)

**Key Behaviors**
- Aggregates from job boards, company career pages, gig platforms, industry-specific marketplaces
- Deduplication logic: filters duplicate listings across sources by title, company, location, description similarity
- Recency weighting: prioritizes newly posted opportunities; deprioritizes stale listings
- Preliminary scoring based on keyword overlap with Career Profile
- Rate limiting and respects robots.txt; manages API quotas across sources
- Tags each listing with source credibility and historical conversion rate

**Operational Constraints**
- Runs on 4-hour refresh cycle (configurable by user)
- Maintains a 30-day rolling window of unique opportunities
- Logs all discovery calls for auditability and Learning Agent feedback

---

#### Agent 2: Match Agent

**Purpose**  
Evaluates semantic fit between user's Career Profile and each opportunity, generating a 0-100 Match Score that predicts likelihood of success (callback, offer, or successful project completion).

**Inputs**
- Opportunity data (job description, required skills, company info, role level, compensation)
- Career Profile kernel (skills, experience, achievements, location, work preferences)
- Historical Match Score data with outcomes (what Match Scores led to callbacks, offers, rejections)

**Outputs**
- Ranked feed with Match Scores → Mission Control (user-facing dashboard)
- Match Score and reasoning → Opportunity Radar (inline with listing)
- Match metadata → Learning Agent (for outcome attribution)

**Key Behaviors**
- Semantic skill matching: maps user's skills and experience to job requirements using embedding-based similarity, not keyword matching alone
- ATS alignment: analyzes whether the opportunity has historically favored candidates with profiles like the user's (industry experience, education level, career trajectory)
- Win-rate weighting: incorporates historical data—users with this profile who applied to jobs like this one achieved a callback X% of the time; adjusts expectation based on recent performance
- Accounts for role level progression (entry-level to director) and skill gaps with explicit "gap analysis" in reasoning
- Filters out poor matches (Match Score < 10) before passing to Resume and Application Agents
- Provides transparent reasoning: "Match Score 78 due to: exact skill match (skills), +2 years industry experience (+5), location mismatch (-8), compensation match (+12)"

**Operational Constraints**
- Matches only opportunities added in the last 30 days (filtering from Discovery Agent)
- Recalculates Match Scores weekly for active opportunities (skills, job market data, or user profile changes)
- Does not apply any bias toward particular industries, companies, or demographics

---

#### Agent 3: Resume Agent

**Purpose**  
Tailors the user's Career Profile and generates application materials (resume, ATS report, cover message) for each matched opportunity, optimized for both applicant tracking systems and human readers.

**Inputs**
- Career Profile (full work history, achievements, skills, certifications, education)
- Job description and company context (from Discovery Agent)
- Match Score data and gap analysis (from Match Agent)
- User preferences: tone (formal, conversational), length, focus areas

**Outputs**
- Tailored resume (PDF, ATS-optimized format)
- ATS compatibility report (keyword density, formatting issues, predicted ATS score)
- Cover message (1-3 sentences, contextually aware)
- Submission checklist (forms, supplemental questions, required documents)

**Key Behaviors**
- Keyword insertion: incorporates job description language into resume experience bullets where truthful and relevant
- Tone matching: adjusts narrative voice based on company culture signals (startup vs. enterprise, formal vs. casual)
- ATS prediction: scans formatted resume for parsing issues, flag keywords that may be dropped by ATS software, provides remediation
- Achievement reordering: prioritizes accomplishments most relevant to the job description (same resume, different order per opportunity)
- Gap messaging: if user lacks key skills or experience, frames existing strengths to bridge the gap and avoids defensive language
- Generates brief, personalized cover message that references specific job description details or company mission
- Completes application forms with career data (name, address, work history) but never auto-fills sensitive fields (salary expectations, visa sponsorship assumptions) without explicit user review

**Operational Constraints**
- Never fabricates experience or skills; only reframes truthfully existing ones
- Respects user's stated non-negotiables (e.g., "do not apply for remote-only roles")
- Stores a version history of all tailored resumes for user audit
- Does not submit anything without explicit user approval or Autopilot Mode override

---

#### Agent 4: Application Agent

**Purpose**  
Executes application and submission workflows autonomously, following the user's Flight Plan (priorities and automation level) and Autopilot Mode settings. Manages forms, proposals, follow-up sequences, and rate limiting.

**Inputs**
- Tailored resume and application materials (from Resume Agent)
- Match Score threshold and Flight Plan (user-set rules: "apply if Match Score > 60")
- Autopilot Mode level: Manual (user approves each application), Smart (agent applies if conditions met, alerts user), Full Auto (agent applies and follows up without intervention)
- Application deadline and preferred submission window

**Outputs**
- Submitted applications logged to Pipeline (with timestamp, materials used, response awaited)
- Proposal text (for gig/contract platforms) → stored in Pipeline
- Follow-up scheduled → Learning Agent, Notification Engine
- Rate-limiting telemetry (applications submitted per day, response time per company)

**Key Behaviors**
- Form parsing: identifies application form fields, auto-fills standard ones (name, email, phone, work history) from Career Profile, flags fields requiring user input
- Proposal generation: writes concise, bespoke proposal for gig platforms (Upwork, Toptal, etc.) tailored to project brief; cites relevant experience
- Submission sequencing: respects daily/weekly application limits, throttles to appear human, avoids submitting to same company rapid-fire
- Follow-up scheduling: sets reminders to follow up after 5-7 days if no response; generates contextual follow-up message referencing the original application
- Error handling and retry: if a form submission fails, retries up to 2 times with backoff; logs error for user review
- Respects application windows: does not submit after application deadline; alerts user if submission window is closing
- Maintains an audit log: what was submitted, when, to whom, what materials were used

**Operational Constraints**
- Manual Mode: requires explicit user approval before submitting any application
- Smart Mode: auto-applies if Match Score > user's threshold AND application is within deadline window; notifies user post-submission
- Full Auto Mode: applies immediately upon Match Score evaluation; notifies user in bulk (weekly summary)
- Never submits without a tailored resume and clear user intent (direct request or Flight Plan rule)
- Rate limits: max 5 applications per day per user account (configurable); respects platform-specific rate limits (Workable, Lever, etc.)
- Does not make promises on behalf of the user (e.g., "I can start tomorrow") without explicit user confirmation

---

#### Agent 5: Learning Agent

**Purpose**  
Learns from application outcomes, user feedback, and market data to continuously improve Match Scores, skill gap recommendations, Flight Plan effectiveness, and Career Profile quality.

**Inputs**
- Application outcomes (callback, phone screen, interview, offer, rejection, no response)
- User feedback on opportunities (e.g., "rejected because I lacked X skill", "took the job at Company Y")
- Offer Desk salary data (historical compensation for similar roles, locations, company sizes)
- Skill Radar gap data (market demand for skills user lacks; trending skills in target industries)
- Opportunity metadata from Pipeline (where we applied, Match Scores given, actual results)
- User engagement signals (which opportunities user clicked, saved, or requested feedback on)

**Outputs**
- Updated Match Score weights and model refinements → Match Agent (improves future predictions)
- Skill gap recommendations and learning paths → Opportunity Radar, Mission Control
- Flight Plan adjustments (suggested threshold changes based on outcome data) → Flight Plan editor
- Career XP triggers (milestones: "After X offers, you've unlocked Advanced Resume Tailoring")
- Insights dashboard: "Your last 10 applications had Match Scores 72-85; 3 interviews scheduled" (conversion metrics by score band)

**Key Behaviors**
- Outcome attribution: correlates application outcomes with Match Scores, Match Agent reasoning, Resume changes, and other signals; identifies what predicted success
- Historical win-rate update: if users with Match Scores 70-75 have a 35% callback rate, but your cohort has 42%, adjusts model; tracks cohort-specific patterns
- Skill gap analysis: analyzes all rejections with feedback; extracts "top 5 skill gaps blocking you" and surfaces learning resources (courses, projects, certifications)
- A/B tracking: if two resume versions were tested, tracks which performed better; recommends style adjustments
- Compensation insights: benchmarks user's previous salary against market data; alerts user if applying to roles significantly below market or their history
- Flight Plan recommendations: "Your 50-point threshold is too low (14% callback rate). Consider raising to 60. Or, you're very selective (threshold 80) but have strong outcomes (40% callback rate)—consider slightly lower threshold to increase volume."
- Career trajectory recalibration: detects if user is applying to roles misaligned with their expressed goals; suggests re-prioritization
- Privacy-first: aggregates insights at cohort level (10+ users); never shares individual user data across users

**Operational Constraints**
- Learning cycles run weekly (batch updates to Match Agent) and real-time (immediate feedback on new outcomes)
- Maintains at least 3 months of user-specific outcome data before adjusting Match Score weights significantly (avoid overfitting to noise)
- All model updates are logged and reversible; user can view "why your Match Scores changed"
- Does not make changes to Career Profile without explicit user approval
- Does not recommend users accept or reject opportunities; only surfaces information and probabilities

---

### Agent Interaction Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                     Career Profile Kernel                        │
│    (skills, experience, achievements, preferences, location)     │
│              [continuously updated by Learning Agent]            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              Discovery Agent                                      │
│    Aggregates opportunities from multiple sources                 │
│    Deduplicates, scores by relevance and recency                 │
│              → Outputs: Opportunity List                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│               Match Agent                                         │
│    Evaluates semantic fit, predicts success (0-100 score)        │
│    Incorporates historical win-rate data                         │
│              → Outputs: Ranked Opportunities with Match Scores   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              Resume Agent                                         │
│    Tailors Career Profile per opportunity                        │
│    Generates ATS-optimized resume, cover message                 │
│              → Outputs: Application Materials                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│            Application Agent                                      │
│    Executes submission workflows (forms, proposals, follow-ups)  │
│    Respects Autopilot Mode and Flight Plan                       │
│              → Outputs: Submissions Logged to Pipeline           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│             Learning Agent                                        │
│    Ingests outcomes, user feedback, market data                  │
│    Refines Match Scores, skill gaps, Flight Plan                 │
│              → Outputs: Career Profile Updates                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
     [Career Profile Kernel — Now Smarter]
     [Loop Repeats: Discovery → Match → Resume → Apply → Learn]
```

---

### Data Flow Matrix

| Agent | Reads From | Writes To |
|-------|-----------|-----------|
| **Discovery Agent** | Career Profile (keywords, preferences) | Opportunity List (to Match Agent), Opportunity Radar (deduplicated feed), Agent telemetry (source performance) |
| **Match Agent** | Opportunity List, Career Profile, Historical Match/Outcome data | Ranked Feed with Match Scores (to Mission Control), Match metadata (to Learning Agent), Opportunity Radar (inline scores) |
| **Resume Agent** | Career Profile, Job Description, Match Score + Gap Analysis, User preferences | Tailored Resume (PDF/text), ATS Report, Cover Message, Resume version history |
| **Application Agent** | Tailored Resume, Match Score threshold, Flight Plan rules, Autopilot Mode setting | Pipeline (logged submissions), Notification Engine (post-submission alerts), Follow-up schedule (to Learning Agent) |
| **Learning Agent** | Pipeline (outcomes per application), User feedback events, Offer Desk data, Skill Radar data, Engagement signals | Updated Match Weights (to Match Agent), Skill gap recommendations (to UI), Flight Plan suggestions, Career XP events, Insights dashboard |

---

### Cross-Agent Data Contracts

**Career Profile Kernel**  
Central source of truth. All agents read; Learning Agent writes updates with user approval.

- Fields: skills (with proficiency levels), work history, achievements, education, certifications, location, availability, preferences (industry, role level, work type, compensation range)
- Update frequency: Learning Agent proposes changes weekly; user approves changes before they propagate
- Versioning: all changes logged with rationale and timestamp

**Opportunity Data**  
Standardized schema across all sources (job boards, company sites, gig platforms).

- Fields: title, company, description, required skills, role level, location, salary (if posted), posted date, application deadline, platform/source
- Enrichment: Discovery Agent adds source credibility score, application method metadata, company info (size, industry, hiring velocity)

**Match Score and Reasoning**  
Structured output from Match Agent shared across Resume, Application, and Learning Agents.

- Fields: overall score (0-100), category breakdowns (skill match %, experience fit %, location %, compensation %, ATS alignment %), reasoning (human-readable explanation)
- Historical tracking: Match Agent stores all scores per opportunity; Learning Agent uses to validate predictions against outcomes

**Pipeline Events**  
Immutable log of all applications, outcomes, and feedback.

- Events: application_submitted, application_received_error, callback_received, no_response (30 days), interview_scheduled, interview_completed, offer_received, offer_declined, job_accepted, feedback_provided
- Metadata: timestamp, Match Score at time of application, application materials used, Autopilot Mode, user action (if any)
- Access: Learning Agent consumes for outcome attribution; user reviews in Pipeline view; never deleted (audit trail)

---

## SECTION 3: OPERATIONAL INTEGRATION

### Autopilot Modes

**Manual**: User reviews and approves each step. Default for first 30 days.  
**Smart**: Agent follows user's Flight Plan rules; notifies user post-action.  
**Full Auto**: Agent independently applies, follows up, escalates exceptions. User reviews weekly digest.

### Flight Plan

User-defined rules engine:
- "Apply if Match Score > 70 and posted < 7 days ago"
- "Do not apply to fully remote roles"
- "Do not apply if company has rejected us in last 60 days"
- "Prioritize roles in [list of companies]"
- Maximum 5 applications per day

Learning Agent suggests rule refinements based on outcome data.

### Mission Control Dashboard

Real-time view of:
- Opportunities discovered today
- Ranked opportunities by Match Score and recency
- Applications in flight (submitted, awaiting response)
- Skill gaps and learning recommendations
- Flight Plan health (rule effectiveness, outcomes by score band)
- Weekly digest from Learning Agent

---

## SECTION 4: SUCCESS METRICS

**Agent Performance**
- Discovery: coverage (opportunities per day), deduplication accuracy (false positive < 2%)
- Match: prediction accuracy (Match Scores correlate to outcomes; R² > 0.65 within 3 months)
- Resume: submission success (forms completed, ATS scores trending up), user approval rate
- Application: submission rate (applications submitted per eligible opportunity), follow-up conversion (callback rate post-follow-up)
- Learning: model improvement (Match Score accuracy increases month-over-month), user engagement (users adopt skill gap recommendations)

**User Outcomes**
- Application volume (applications per user per month)
- Callback rate (percent of applications receiving response)
- Interview booking rate (percent of callbacks converting to interviews)
- Offer rate (percent of user applications resulting in offer)
- Career progression (salary, role level, satisfaction at job acceptance)

---

## SECTION 5: ROADMAP PRIORITIES (Phase 6–7)

**Phase 6 (Now)**
- Launch Discovery Agent with 3 major job board integrations (Indeed, LinkedIn, company career pages)
- Launch Match Agent with baseline semantic matching and historical win-rate modeling
- MVP Resume Agent (template-based tailoring; ATS score prediction)
- Manual mode Application Agent (user approves each application; logs to Pipeline)
- Basic Learning Agent (outcome attribution, skill gap extraction)

**Phase 7 (Next)**
- Expand Discovery Agent to 10+ sources (gig platforms, industry-specific boards, recruiter feeds)
- Refine Match Agent with A/B tested weights; improve win-rate prediction
- Smart Resume Agent (generative cover letters, tone matching)
- Smart + Full Auto Application Agent (Flight Plan rules, Autopilot Modes)
- Advanced Learning Agent (salary benchmarking, career trajectory recommendations, model confidence scoring)

---

**End of Document**
