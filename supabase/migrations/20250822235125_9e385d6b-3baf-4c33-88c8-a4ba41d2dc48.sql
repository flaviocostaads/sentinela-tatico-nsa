-- Restrict profiles visibility to self and admins only
-- 1) Drop the broad SELECT policy that allowed operadores to view all profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins and operadores can view all profiles'
  ) THEN
    EXECUTE 'DROP POLICY "Admins and operadores can view all profiles" ON public.profiles';
  END IF;
END $$;

-- 2) Create a stricter SELECT policy for admins only
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (check_admin_role(auth.uid()));

-- 3) Ensure the self-view policy remains in place (idempotent create)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view only their own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view only their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;