
-- Customer feedback survey responses table
CREATE TABLE public.customer_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('job_seeker', 'hiring_manager', 'both')),
  email TEXT,
  phone TEXT,
  wants_callback BOOLEAN NOT NULL DEFAULT false,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_surveys ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can submit a survey
CREATE POLICY "Anyone can insert surveys"
ON public.customer_surveys
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read surveys
CREATE POLICY "Admins can view all surveys"
ON public.customer_surveys
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete surveys
CREATE POLICY "Admins can delete surveys"
ON public.customer_surveys
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
