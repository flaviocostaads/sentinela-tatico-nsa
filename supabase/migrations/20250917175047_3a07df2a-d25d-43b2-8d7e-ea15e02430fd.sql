-- Remove all existing policies and create a more secure, single policy approach
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Create a single, comprehensive SELECT policy that clearly restricts access
CREATE POLICY "Secure profile access - own data or admin"
ON public.profiles
FOR SELECT
USING (
  -- Users can view their own profile OR user is admin
  auth.uid() = user_id OR check_admin_role(auth.uid())
);

-- Create a secure UPDATE policy - users can only update their own profile
CREATE POLICY "Users can update own profile only"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create a secure INSERT policy - only admins can create profiles
CREATE POLICY "Only admins can create profiles"
ON public.profiles
FOR INSERT
WITH CHECK (check_admin_role(auth.uid()));

-- Create a secure DELETE policy - only admins can delete profiles
CREATE POLICY "Only admins can delete profiles"
ON public.profiles
FOR DELETE
USING (check_admin_role(auth.uid()));