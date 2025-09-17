-- Restrict access to sensitive location data in user_locations
-- 1) Drop overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all locations" ON public.user_locations;

-- 2) Allow admins and operadores to view all locations
CREATE POLICY "Admins and operadores can view all locations"
ON public.user_locations
FOR SELECT
USING (public.check_admin_or_operator_role(auth.uid()));

-- 3) Allow users to view only their own location history
CREATE POLICY "Users can view their own locations"
ON public.user_locations
FOR SELECT
USING (auth.uid() = user_id);

-- 4) Allow users assigned to a round to view locations for that round (operational need)
CREATE POLICY "Users assigned to a round can view round locations"
ON public.user_locations
FOR SELECT
USING (
  round_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.round_assignments ra
    WHERE ra.round_id = user_locations.round_id
      AND ra.user_id = auth.uid()
  )
);
