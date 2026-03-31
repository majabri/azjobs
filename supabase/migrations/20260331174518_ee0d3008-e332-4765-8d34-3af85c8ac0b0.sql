CREATE OR REPLACE FUNCTION public.resolve_admin_email(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email
  FROM public.profiles p
  INNER JOIN public.user_roles r ON r.user_id = p.user_id AND r.role = 'admin'
  WHERE p.username ILIKE _username
  LIMIT 1
$$;