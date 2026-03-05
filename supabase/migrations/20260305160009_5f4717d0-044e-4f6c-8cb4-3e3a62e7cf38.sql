ALTER TABLE public.job_applications 
ADD COLUMN follow_up_date timestamp with time zone DEFAULT NULL,
ADD COLUMN follow_up_notes text DEFAULT '',
ADD COLUMN followed_up boolean NOT NULL DEFAULT false;