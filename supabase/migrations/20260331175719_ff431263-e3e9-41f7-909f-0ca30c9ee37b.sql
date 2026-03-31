
-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all job_seeker_profiles
CREATE POLICY "Admins can view all job seeker profiles"
ON public.job_seeker_profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all job_applications
CREATE POLICY "Admins can view all applications"
ON public.job_applications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all analysis_history
CREATE POLICY "Admins can view all analyses"
ON public.analysis_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all job_postings
CREATE POLICY "Admins can view all job postings"
ON public.job_postings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all interview_schedules
CREATE POLICY "Admins can view all interview schedules"
ON public.interview_schedules FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
