-- Restrict vehicles read access to authenticated users only
-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON public.vehicles;

-- Recreate the policy scoped to authenticated users only
CREATE POLICY "Authenticated users can view vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (true);
