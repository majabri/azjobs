

# Plan: AI Career Operating System Upgrade

## What Already Exists (No Rebuild Needed)

- **Career Path Intelligence** component with next-role recommendations and skills-to-learn
- **Interview Prep** edge function (`generate-interview-prep`)
- **Recruiter Assistant** component for drafting replies
- **Feedback Collector** for outcome tracking (no response / interview / offer / rejected)
- **Job Search** with response probability, smart tags ("Apply Now", "Improve First", "Low ROI"), and quality scoring
- **Application Tracker** (Kanban board at /applications)
- **Profile** with skills, experience, career level, target titles, salary range

## What Needs to Be Built

### Phase 1: Career Dashboard & Roadmap (3 steps)

**1a. Career Dashboard page (`/career`)**
- New page showing career goals, salary targets, progression timeline
- Pull data from `job_seeker_profiles` (career level, target titles, salary min/max) and `analysis_history` (score trends over time)
- Add editable career goals (short-term / long-term text fields) to `job_seeker_profiles` table via migration
- Visualize score improvement trend chart using existing analysis history data
- Wire into nav from Dashboard and sidebar

**1b. Career Roadmap Generator**
- Extend existing `career-path-analysis` edge function to return a structured roadmap with timeline milestones (current role -> next role -> target role, with skill requirements at each step)
- New `CareerRoadmap` component rendering a visual step-by-step path with skill gaps and time estimates per stage
- Embed in the new Career Dashboard page

**1c. Database migration**
- Add columns to `job_seeker_profiles`: `career_goals_short`, `career_goals_long`, `salary_target`
- Add route `/career` to App.tsx as a protected route

### Phase 2: Feedback Learning Loop (2 steps)

**2a. Enhanced outcome tracking**
- Extend `FeedbackCollector` to capture more detail: rejection reason (optional text), interview stage reached, time-to-response
- Add columns to `job_applications`: `outcome_detail` (text), `interview_stage` (text), `response_days` (integer)

**2b. Learning-powered improvements**
- Create a new edge function `learning-insights` that queries the user's `job_applications` outcomes and correlates with `analysis_history` scores to surface patterns (e.g., "Jobs where you scored 75+ had 3x interview rate")
- Display insights card on Dashboard showing personalized recommendations based on real outcome data
- Feed outcome data into `calculateResponseProbability` in JobSearch to improve estimates over time

### Phase 3: Interview Simulation System (2 steps)

**3a. Mock Interview Chat**
- New page `/interview-prep` with a chat-based mock interview UI
- Create edge function `mock-interview` that uses streaming AI responses to simulate an interviewer asking role-specific questions, then providing feedback on user answers
- Load job description context from selected analysis history or job search result
- Use SSE streaming for real-time conversation feel

**3b. Answer Feedback & Scoring**
- After each user answer, AI provides structured feedback: strength, improvement area, suggested better answer
- Session summary at end with overall readiness score
- Save mock interview sessions to a new `interview_sessions` table for review

**Database migration**: Create `interview_sessions` table (id, user_id, job_title, messages jsonb, readiness_score integer, created_at) with RLS policies

### Phase 4: Networking & Outreach Engine (2 steps)

**4a. Outreach Message Generator**
- New component `OutreachGenerator` on the Career Dashboard
- Create edge function `generate-outreach` that crafts personalized LinkedIn/email messages based on target company, role, and user profile
- Support message types: cold outreach, warm introduction request, informational interview ask

**4b. Outreach Tracker**
- New `outreach_contacts` table (id, user_id, contact_name, company, role, platform, message_sent, sent_at, response_status, notes, created_at)
- Simple table UI on Career Dashboard to log and track outreach attempts
- Filter by response status (sent, replied, no response)

### Phase 5: Job Decision Engine Enhancement (1 step)

**5a. Composite Job Ranking**
- Extend `JobSearch.tsx` to add a composite "Decision Score" combining: fit score (40%), response probability (30%), effort estimate (30%)
- Effort estimate = inverse of how many gaps need filling (fewer gaps = less effort)
- Add sort-by-decision-score option
- Enhance existing smart tags with "Low ROI" tag for high-effort/low-probability jobs
- Most of this logic already partially exists; this step consolidates and surfaces it more prominently

### Phase 6: Portfolio & Personal Brand (3 steps)

**6a. Portfolio Data Model**
- Migration: Create `user_portfolio_items` table (id, user_id, item_type enum ['project','achievement','case_study'], title, description, url, image_url, tags array, display_order integer, created_at)
- RLS: users manage own items

**6b. Portfolio Editor**
- New section on Profile page (`/profile`) to add/edit/reorder portfolio items
- Support project title, description, URL, tags
- Achievement and case study types with rich text description

**6c. Public Profile Page**
- New public route `/p/:userId` (no auth required)
- Renders user's name, summary, skills, work experience, portfolio items
- Shareable link with copy-to-clipboard
- Add RLS policy for public SELECT on specific fields of `job_seeker_profiles` and `user_portfolio_items`
- Generate OG meta tags for social sharing

---

## Technical Summary

| Phase | New Tables | New Edge Functions | New Pages/Components | Migration Count |
|-------|-----------|-------------------|---------------------|----------------|
| 1 | 0 (alter existing) | 0 (extend existing) | 2 (page + component) | 1 |
| 2 | 0 (alter existing) | 1 | 1 component | 1 |
| 3 | 1 | 1 | 1 page + components | 1 |
| 4 | 1 | 1 | 2 components | 1 |
| 5 | 0 | 0 | 0 (enhance existing) | 0 |
| 6 | 1 | 0 | 2 (editor + public page) | 1 |

**Total**: 3 new tables, 3 new edge functions, ~8 new components/pages, 5 migrations

All phases build on existing auth, profile, analysis engine, and application tracking systems. No rebuilds.

