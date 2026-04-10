-- Knowledge Base: role-based audiences for support_faq
-- Adds audience column, updates RLS, and seeds comprehensive FAQ content.

-- ─── 1. Add audience column ────────────────────────────────────────────────

ALTER TABLE public.support_faq
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all'
  CONSTRAINT support_faq_audience_check
    CHECK (audience IN ('all', 'job_seeker', 'recruiter', 'admin'));

-- ─── 2. Update existing seed rows to audience='all' (already the default) ──
-- No-op: new default handles existing rows automatically.

-- ─── 3. Replace SELECT policy with role-based one ─────────────────────────

DROP POLICY IF EXISTS "Anyone can view published FAQs" ON public.support_faq;

-- Role-based visibility:
--   • audience='all'          → any authenticated user
--   • audience='job_seeker'   → users whose role is job_seeker
--   • audience='recruiter'    → users whose role is recruiter
--   • audience='admin'        → admins only
-- Cast role::text so the query works whether user_roles.role is text or an enum.
CREATE POLICY "Role-based FAQ visibility"
  ON public.support_faq FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND (
      audience = 'all'
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text = audience
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role::text = 'admin'
      )
    )
  );

-- ─── 4. Seed comprehensive Knowledge Base content ─────────────────────────
-- Existing 6 rows keep audience='all' (default).
-- New rows below are tagged by audience and grouped into functional categories.

INSERT INTO public.support_faq (category, question, answer, display_order, audience) VALUES

-- ══════════════════════════════════════════════════════════════════════════
-- ALL USERS
-- ══════════════════════════════════════════════════════════════════════════

  ('getting_started', 'What is iCareerOS?',
   'iCareerOS is an AI-powered career platform that helps job seekers find, apply, and prepare for jobs — and helps hiring managers source, screen, and interview candidates. Use the sidebar to navigate between features.',
   10, 'all'),

  ('getting_started', 'How do I switch between Job Seeker and Hiring Manager modes?',
   'Click your profile avatar in the top-right corner and select "Switch Mode". Your sidebar navigation will update to show the tools relevant to your selected mode.',
   11, 'all'),

  ('account', 'How do I reset my password?',
   'Click "Forgot Password" on the login page. An email will be sent to your registered address with a secure reset link valid for 60 minutes.',
   12, 'all'),

  ('account', 'How do I update my profile information?',
   'Navigate to Profile in the sidebar. You can update your personal details, contact information, and preferences. Changes are saved automatically.',
   13, 'all'),

  ('account', 'How do I delete my account?',
   'Go to Profile → Settings → Delete Account. This action is permanent and removes all your data including applications, tickets, and saved jobs.',
   14, 'all'),

-- ══════════════════════════════════════════════════════════════════════════
-- JOB SEEKER
-- ══════════════════════════════════════════════════════════════════════════

  -- Dashboard
  ('seeker_dashboard', 'What does the Job Seeker Dashboard show?',
   'Your dashboard gives you a real-time overview of your job search activity: recent job matches, pending applications, upcoming interviews, and AI recommendations based on your profile.',
   100, 'job_seeker'),

  ('seeker_dashboard', 'Why are my dashboard metrics not updating?',
   'Dashboard data refreshes automatically every few minutes. If metrics appear stale, try refreshing the page. If the issue persists, submit a support ticket.',
   101, 'job_seeker'),

  -- Analyze Job
  ('seeker_analyze_job', 'How do I analyze a job posting?',
   'Go to "Analyze Job" in the sidebar. Paste the job description into the text box and click Analyze. The AI will compare it against your profile and produce a match score, matched skills, skill gaps, and tailored improvement tips.',
   110, 'job_seeker'),

  ('seeker_analyze_job', 'What does the fit score mean?',
   'The fit score (0–100) shows how well your profile aligns with the job requirements. Scores above 70 indicate a strong match. The breakdown highlights matched skills and gaps so you can prioritize improvements.',
   111, 'job_seeker'),

  ('seeker_analyze_job', 'Can I analyze multiple jobs at once?',
   'You can analyze one job at a time. After each analysis, results are saved in your Applications tracker so you can compare across jobs later.',
   112, 'job_seeker'),

  -- Find Jobs
  ('seeker_find_jobs', 'How do I search for jobs?',
   'Go to "Find Jobs", enter a job title and optionally a location or remote preference, then click Search. Results are ranked by relevance to your profile.',
   120, 'job_seeker'),

  ('seeker_find_jobs', 'How do I filter job results?',
   'Use the filter panel on the left to narrow by location, job type (full-time/part-time/contract), salary range, experience level, and date posted.',
   121, 'job_seeker'),

  ('seeker_find_jobs', 'Can I save jobs to apply later?',
   'Yes. Click the bookmark icon on any job card to save it. Saved jobs appear in your Applications tracker with status "Saved".',
   122, 'job_seeker'),

  ('seeker_find_jobs', 'Why am I not seeing jobs in my area?',
   'Make sure your location is set correctly in your Profile. You can also check the "Remote" filter to include remote positions. Try broadening your search terms if results are sparse.',
   123, 'job_seeker'),

  -- Applications
  ('seeker_applications', 'How do I track my applications?',
   'Go to "Applications" in the sidebar to see all your saved and applied jobs. Each entry shows current status (Saved, Applied, Interviewing, Offered, Rejected).',
   130, 'job_seeker'),

  ('seeker_applications', 'How do I update the status of an application?',
   'Open an application card and use the Status dropdown to change it. You can also add notes and expected follow-up dates to stay organised.',
   131, 'job_seeker'),

  ('seeker_applications', 'Can I add applications I submitted outside of iCareerOS?',
   'Yes. Click "Add Application" in the Applications page, enter the job title, company, and any details you want to track.',
   132, 'job_seeker'),

  -- Offers
  ('seeker_offers', 'Where do I manage job offers?',
   'Go to "Offers" in the sidebar. Any offer extended through the platform appears here. You can review compensation details, deadlines, and accept or decline.',
   140, 'job_seeker'),

  ('seeker_offers', 'How does the AI salary negotiation advice work?',
   'On an offer detail page, click "Negotiation Strategy". The AI analyses market data and your experience to suggest a counter-offer range and talking points.',
   141, 'job_seeker'),

  -- Career
  ('seeker_career', 'What is the Career section?',
   'Career provides AI-powered long-term planning tools: career path projections, skill gap analysis, salary trajectory forecasting, and learning recommendations tailored to your goals.',
   150, 'job_seeker'),

  ('seeker_career', 'How do I explore career paths?',
   'In Career → Career Path Analysis, enter your current role and target role. The AI maps out intermediate steps, required skills, and estimated timelines.',
   151, 'job_seeker'),

  ('seeker_career', 'How does salary projection work?',
   'Salary Projection in the Career section models your earning potential based on your skills, experience, industry trends, and location. Results update as you add skills to your profile.',
   152, 'job_seeker'),

  -- Interview Prep
  ('seeker_interview_prep', 'How do I prepare for an interview using iCareerOS?',
   'Go to "Interview Prep" and select the job you are interviewing for. The AI generates likely interview questions based on the job description and your profile, plus model answers and coaching tips.',
   160, 'job_seeker'),

  ('seeker_interview_prep', 'What is the Mock Interview feature?',
   'Mock Interview simulates a live interview session. The AI asks questions, listens to your text or voice responses, and provides real-time feedback on content, clarity, and confidence.',
   161, 'job_seeker'),

  ('seeker_interview_prep', 'Can I practice for technical interviews?',
   'Yes. When generating interview prep, select "Technical" as the interview type. The AI will include role-specific technical and behavioural questions.',
   162, 'job_seeker'),

  -- Auto Apply
  ('seeker_auto_apply', 'What is Auto Apply?',
   'Auto Apply is an AI agent that automatically finds and applies to jobs matching your profile and preferences. It runs on a schedule you configure and reports results on your dashboard.',
   170, 'job_seeker'),

  ('seeker_auto_apply', 'How do I configure Auto Apply?',
   'Go to "Auto Apply" → Settings. Set your target job titles, preferred locations, salary range, and maximum applications per day. The agent will only apply to jobs that meet your criteria.',
   171, 'job_seeker'),

  ('seeker_auto_apply', 'How do I pause or stop Auto Apply?',
   'In "Auto Apply" → Settings, toggle the "Active" switch off. Ongoing applications in progress will complete, but no new ones will start.',
   172, 'job_seeker'),

  ('seeker_auto_apply', 'Can I review applications before they are submitted?',
   'Yes. Set the automation mode to "Review Before Apply" in settings. The agent will queue applications for your approval before submitting.',
   173, 'job_seeker'),

  -- Profile
  ('seeker_profile', 'How do I build my job seeker profile?',
   'Go to Profile in the sidebar. Complete all sections: Personal Info, Work Experience, Education, Skills, and Career Preferences. A complete profile improves your match scores and Auto Apply results.',
   180, 'job_seeker'),

  ('seeker_profile', 'How do I import my resume into my profile?',
   'In Profile → Resume, click "Upload Resume". The AI will parse your resume and auto-fill your work experience, education, and skills. Review and correct any errors.',
   181, 'job_seeker'),

  ('seeker_profile', 'How do I generate a cover letter?',
   'From any job listing or the Analyze Job page, click "Generate Cover Letter". The AI drafts a tailored cover letter based on the job description and your profile. You can edit it before using it.',
   182, 'job_seeker'),

-- ══════════════════════════════════════════════════════════════════════════
-- HIRING MANAGER / RECRUITER
-- ══════════════════════════════════════════════════════════════════════════

  -- Candidate Screener
  ('recruiter_screener', 'What is the Candidate Screener?',
   'The Candidate Screener uses AI to evaluate incoming applicants against your job requirements. It scores each candidate on skills match, experience, and culture indicators — so you focus on the strongest fits.',
   200, 'recruiter'),

  ('recruiter_screener', 'How do I set screening criteria?',
   'Open a job posting and go to the Screening tab. Define required skills, minimum years of experience, must-have qualifications, and any knockout questions. The AI applies these to all applicants automatically.',
   201, 'recruiter'),

  ('recruiter_screener', 'Can I bulk-review candidates?',
   'Yes. In the Screener list view, select multiple candidates and use bulk actions to advance, reject, or tag them. Bulk decisions are logged for compliance.',
   202, 'recruiter'),

  -- Candidates Database
  ('recruiter_candidates', 'What is the Candidates Database?',
   'The Candidates Database is your searchable repository of all candidates who have applied to your postings or been sourced through the platform. Use filters to find candidates by skill, location, status, or score.',
   210, 'recruiter'),

  ('recruiter_candidates', 'How do I search for candidates?',
   'Use the search bar at the top of Candidates Database and add filters (skills, location, experience, status). Boolean search is supported (e.g., "Python AND Django NOT PHP").',
   211, 'recruiter'),

  ('recruiter_candidates', 'How do I add notes to a candidate profile?',
   'Open a candidate profile and click "Add Note". Notes are visible to all team members in your organization and are timestamped.',
   212, 'recruiter'),

  ('recruiter_candidates', 'Can I export candidate data?',
   'Yes. Select candidates using checkboxes then click Export → CSV or PDF. Exported data respects your organization''s data-use agreements.',
   213, 'recruiter'),

  -- Job Postings
  ('recruiter_job_postings', 'How do I create a job posting?',
   'Go to "Job Postings" → Create New. Fill in the job title, description, requirements, location, and compensation range. The AI can assist with writing and optimising the description for search visibility.',
   220, 'recruiter'),

  ('recruiter_job_postings', 'How do I publish or unpublish a job posting?',
   'In Job Postings, open the posting and toggle the "Published" switch. Published jobs are visible to job seekers; unpublished jobs are draft-only and not searchable.',
   221, 'recruiter'),

  ('recruiter_job_postings', 'How do I track applicants for a specific posting?',
   'Open a job posting and click the "Applicants" tab. You will see a pipeline view of all applicants grouped by stage (Applied, Screened, Interview, Offer, Hired, Rejected).',
   222, 'recruiter'),

  ('recruiter_job_postings', 'Can I duplicate an existing job posting?',
   'Yes. In the job posting list, click the ⋯ menu on any posting and select Duplicate. This creates a draft copy you can edit before publishing.',
   223, 'recruiter'),

  -- Interview Scheduling
  ('recruiter_interview_scheduling', 'How do I schedule an interview?',
   'Open a candidate''s profile or their application, click "Schedule Interview", choose the interview type (phone, video, on-site), select available time slots, and send the invite. The candidate receives an email with calendar options.',
   230, 'recruiter'),

  ('recruiter_interview_scheduling', 'Can I set up an interview panel?',
   'Yes. When creating an interview, add multiple interviewers from your team. The system will find overlapping availability and suggest shared time slots.',
   231, 'recruiter'),

  ('recruiter_interview_scheduling', 'How do I send interview reminders?',
   'Reminders are sent automatically 24 hours and 1 hour before each scheduled interview. You can configure additional reminder times in Settings → Interview Preferences.',
   232, 'recruiter'),

  ('recruiter_interview_scheduling', 'Where do I see the interview scorecard after the session?',
   'After an interview, each interviewer is prompted to complete a scorecard. Results are aggregated in the candidate''s profile under the "Interviews" tab.',
   233, 'recruiter'),

-- ══════════════════════════════════════════════════════════════════════════
-- ADMIN
-- ══════════════════════════════════════════════════════════════════════════

  -- Support Tickets (admin)
  ('admin_support_tickets', 'How do I manage support tickets as an admin?',
   'Go to Admin → Support Tickets. You can view all open, in-progress, and resolved tickets. Use the filter bar to sort by priority, status, or date. Click a ticket to open the conversation thread and respond.',
   300, 'admin'),

  ('admin_support_tickets', 'How do I resolve or close a ticket?',
   'Open the ticket, add a final response if needed, then change the status to Resolved or Closed using the status dropdown at the top of the ticket detail.',
   301, 'admin'),

  -- System Health (admin)
  ('admin_system_health', 'How do I monitor system health?',
   'Go to Admin → System Health. The dashboard shows real-time status of all platform services (API, database, AI agents, email). Any degraded or failing services are highlighted in red.',
   310, 'admin'),

  ('admin_system_health', 'How do I view agent run history?',
   'Go to Admin → Agent Runs. You can filter by status (completed, failed, running) and date range. Click any run to see detailed logs and output.',
   311, 'admin'),

  ('admin_system_health', 'What do I do if the job queue is backed up?',
   'Go to Admin → Queue. You can see queued, running, failed, and cancelled jobs. Failed jobs can be retried individually or in bulk from the queue view.',
   312, 'admin'),

  -- Users / Roles (admin)
  ('admin_users_roles', 'How do I manage user roles?',
   'Go to Admin → Users. Use the role selector on each user row to change their role (job_seeker, recruiter, admin). Role changes take effect immediately.',
   320, 'admin'),

  ('admin_users_roles', 'How do I create a new user account?',
   'In Admin → Users, click "Create User". Enter the email, full name, initial password, and role. The user will receive a welcome email with login instructions.',
   321, 'admin'),

  ('admin_users_roles', 'How do I disable or delete a user account?',
   'In Admin → Users, click the ⋯ menu next to the user and choose Disable or Delete. Disabled accounts cannot log in but data is preserved. Deletion is permanent.',
   322, 'admin'),

  ('admin_users_roles', 'How do I view the audit log?',
   'Go to Admin → Audit Log to see a full history of administrative actions including role changes, account deletions, and console commands, with timestamps and actor IDs.',
   323, 'admin');
