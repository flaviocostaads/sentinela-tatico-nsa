-- Fix security vulnerability: Restrict admin/operator access to location data
-- Remove overly permissive policy that allows unrestricted access to all location data
DROP POLICY IF EXISTS "Admins and operators can view all locations for monitoring" ON public.user_locations;

-- Create time-based and purpose-limited policies for location data access

-- 1. Admins and operators can only view recent location data (last 24 hours) for users with active rounds
CREATE POLICY "Admins can view recent locations for active operations only" 
ON public.user_locations 
FOR SELECT 
USING (
  check_admin_or_operator_role(auth.uid()) 
  AND recorded_at >= (now() - interval '24 hours')
  AND (
    -- Only for users with active rounds in the last 24 hours
    EXISTS (
      SELECT 1 
      FROM public.rounds r 
      WHERE r.user_id = user_locations.user_id 
      AND r.status = 'active'
      AND r.start_time >= (now() - interval '24 hours')
    )
    OR
    -- Or if there's an active emergency incident requiring location monitoring
    EXISTS (
      SELECT 1 
      FROM public.incidents i
      JOIN public.rounds r ON r.id = i.round_id
      WHERE r.user_id = user_locations.user_id 
      AND i.status = 'open'
      AND i.priority IN ('high', 'critical')
      AND i.reported_at >= (now() - interval '24 hours')
    )
  )
);

-- 2. Admins can view location data for audit purposes (limited to last 7 days)
CREATE POLICY "Admins can view location data for audit purposes" 
ON public.user_locations 
FOR SELECT 
USING (
  check_admin_role(auth.uid()) 
  AND recorded_at >= (now() - interval '7 days')
);

-- 3. Emergency override: Critical incidents allow broader location access
CREATE POLICY "Emergency location access for critical incidents" 
ON public.user_locations 
FOR SELECT 
USING (
  check_admin_or_operator_role(auth.uid()) 
  AND EXISTS (
    SELECT 1 
    FROM public.incidents i
    WHERE i.status = 'open'
    AND i.priority = 'critical'
    AND i.reported_at >= (now() - interval '2 hours')
  )
  AND recorded_at >= (now() - interval '2 hours')
);