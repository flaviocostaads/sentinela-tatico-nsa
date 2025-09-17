-- Restrict public read access to odometer_records
-- 1) Remove overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all odometer records" ON public.odometer_records;

-- 2) Allow admins and operadores (supervisors) to view all odometer records
CREATE POLICY "Admins and operadores can view all odometer records"
ON public.odometer_records
FOR SELECT
USING (public.check_admin_or_operator_role(auth.uid()));

-- 3) Allow users to view only their own odometer records
CREATE POLICY "Users can view their own odometer records"
ON public.odometer_records
FOR SELECT
USING (auth.uid() = user_id);
