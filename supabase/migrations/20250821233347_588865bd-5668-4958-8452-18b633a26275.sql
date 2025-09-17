-- 1) Create helper function to avoid recursion in RLS when checking roles
CREATE OR REPLACE FUNCTION public.check_admin_or_operator_role(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = user_uuid AND role = ANY (ARRAY['admin'::user_role, 'operador'::user_role])
  );
$$;

-- 2) Restrict profiles visibility
-- Remove overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Allow admins and operadores to read all profiles
CREATE POLICY "Admins and operadores can view all profiles"
ON public.profiles
FOR SELECT
USING (public.check_admin_or_operator_role(auth.uid()));

-- Allow users to read only their own profile
CREATE POLICY "Users can view only their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);
