-- Fix the circular dependency issue with check_admin_role function and profiles RLS policies

-- First, drop the existing policies that have circular dependencies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Recreate the check_admin_role function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.check_admin_role(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = user_uuid AND role = 'admin'::user_role
  );
$$;

-- Now recreate the admin policies with the properly defined function
-- Admins can view all profiles (but only if they are actually admins)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (check_admin_role(auth.uid()));

-- Admins can manage all profiles (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
USING (check_admin_role(auth.uid()));

-- Ensure the function owner has the right permissions
GRANT EXECUTE ON FUNCTION public.check_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_role(uuid) TO anon;