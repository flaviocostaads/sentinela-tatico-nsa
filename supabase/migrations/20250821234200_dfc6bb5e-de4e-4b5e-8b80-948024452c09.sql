-- Tighten access to user_locations with time-based controls

-- 1) Helper function to check assignment without risking recursion
CREATE OR REPLACE FUNCTION public.is_user_assigned_to_round(p_round_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.round_assignments ra
    WHERE ra.round_id = p_round_id
      AND ra.user_id = p_user_id
  );
$$;

-- 2) Replace broad round-access policy with time-bounded version
DROP POLICY IF EXISTS "Users assigned to a round can view round locations" ON public.user_locations;

CREATE POLICY "Round-assigned users can view recent round locations"
ON public.user_locations
FOR SELECT
USING (
  round_id IS NOT NULL
  AND recorded_at >= (now() - interval '24 hours')
  AND public.is_user_assigned_to_round(round_id, auth.uid())
);

-- Keep existing policies:
--  - INSERT: "Users can insert their own location"
--  - SELECT: "Admins and operadores can view all locations"
--  - SELECT: "Users can view their own locations"