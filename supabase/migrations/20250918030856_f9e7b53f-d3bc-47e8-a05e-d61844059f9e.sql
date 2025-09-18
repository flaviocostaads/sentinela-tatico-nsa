-- Drop existing potentially weak RLS policy
DROP POLICY IF EXISTS "Secure profile access - own data or admin" ON public.profiles;

-- Create a more restrictive and secure RLS policy for profile access
CREATE POLICY "Secure profile access - authenticated users only"
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  -- Users can only see their own profile data
  auth.uid() = user_id
  -- OR they are a verified admin (using security definer function)
  OR check_admin_role(auth.uid())
);

-- Ensure no public access to profiles - only authenticated users
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles 
FOR ALL
TO anon
USING (false);

-- Create more restrictive INSERT policy 
DROP POLICY IF EXISTS "Only admins can create profiles" ON public.profiles;
CREATE POLICY "Secure profile creation - admins only"
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Only admins can create new profiles
  check_admin_role(auth.uid())
);

-- Create more restrictive UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile only" ON public.profiles;  
CREATE POLICY "Secure profile updates - own data or admin"
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (
  -- Users can update their own profile OR admins can update any profile
  auth.uid() = user_id OR check_admin_role(auth.uid())
)
WITH CHECK (
  -- Same conditions for the updated data
  auth.uid() = user_id OR check_admin_role(auth.uid())
);

-- Create more restrictive DELETE policy
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
CREATE POLICY "Secure profile deletion - admins only"
ON public.profiles 
FOR DELETE 
TO authenticated
USING (
  -- Only admins can delete profiles
  check_admin_role(auth.uid())
);

-- Add additional security: Ensure auth.uid() is never null for profile operations
-- This prevents any potential bypasses
CREATE OR REPLACE FUNCTION public.ensure_authenticated_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure user is properly authenticated for any profile operation
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for profile operations';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to ensure authentication on all profile operations
DROP TRIGGER IF EXISTS ensure_profile_auth ON public.profiles;
CREATE TRIGGER ensure_profile_auth
  BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_authenticated_user();