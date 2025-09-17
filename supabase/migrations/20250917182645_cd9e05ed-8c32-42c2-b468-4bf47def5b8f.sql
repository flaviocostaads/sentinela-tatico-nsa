-- CRITICAL SECURITY FIXES: Implement Role-Based Data Access Control

-- 1. Fix rounds table - restrict access to assigned users only
DROP POLICY IF EXISTS "Users can view all rounds" ON public.rounds;
CREATE POLICY "Users can view assigned rounds only" 
ON public.rounds 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  check_admin_or_operator_role(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM round_assignments ra 
    WHERE ra.round_id = rounds.id AND ra.user_id = auth.uid()
  )
);

-- 2. Fix incidents table - restrict to incidents from user's rounds
DROP POLICY IF EXISTS "Authenticated users can view incidents" ON public.incidents;
CREATE POLICY "Users can view incidents from assigned rounds" 
ON public.incidents 
FOR SELECT 
USING (
  check_admin_or_operator_role(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM rounds r 
    WHERE r.id = incidents.round_id AND (
      r.user_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM round_assignments ra 
        WHERE ra.round_id = r.id AND ra.user_id = auth.uid()
      )
    )
  )
);

-- 3. Fix user_locations table - users only see their own + admins/operators see all for monitoring
DROP POLICY IF EXISTS "Admins and operators can view all locations" ON public.user_locations;
DROP POLICY IF EXISTS "Round assigned users can view round locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can view own locations only" ON public.user_locations;

CREATE POLICY "Users can view own locations" 
ON public.user_locations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins and operators can view all locations for monitoring" 
ON public.user_locations 
FOR SELECT 
USING (check_admin_or_operator_role(auth.uid()));

-- 4. Fix checkpoints table - restrict to assigned clients only
DROP POLICY IF EXISTS "Authenticated users can view checkpoints" ON public.checkpoints;
CREATE POLICY "Users can view checkpoints for assigned clients" 
ON public.checkpoints 
FOR SELECT 
USING (
  check_admin_or_operator_role(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM rounds r 
    JOIN round_assignments ra ON ra.round_id = r.id
    WHERE r.client_id = checkpoints.client_id 
    AND ra.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM rounds r 
    WHERE r.client_id = checkpoints.client_id 
    AND r.user_id = auth.uid()
  )
);

-- 5. Fix clients table - restrict to assigned clients
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
CREATE POLICY "Users can view assigned clients only" 
ON public.clients 
FOR SELECT 
USING (
  check_admin_or_operator_role(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM rounds r 
    JOIN round_assignments ra ON ra.round_id = r.id
    WHERE r.client_id = clients.id 
    AND ra.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM rounds r 
    WHERE r.client_id = clients.id 
    AND r.user_id = auth.uid()
  )
);

-- 6. Fix vehicles table - restrict to operators and admins only
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON public.vehicles;
CREATE POLICY "Only operators and admins can view vehicles" 
ON public.vehicles 
FOR SELECT 
USING (check_admin_or_operator_role(auth.uid()));

-- 7. Fix notification_templates - restrict management to admins only
DROP POLICY IF EXISTS "Users can view active templates" ON public.notification_templates;
CREATE POLICY "Only admins can view notification templates" 
ON public.notification_templates 
FOR SELECT 
USING (check_admin_role(auth.uid()));

-- 8. Secure route_points - users only see their own routes
DROP POLICY IF EXISTS "Users can view route points" ON public.route_points;
CREATE POLICY "Users can view route points from assigned rounds" 
ON public.route_points 
FOR SELECT 
USING (
  check_admin_or_operator_role(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM rounds r 
    WHERE r.id = route_points.round_id AND (
      r.user_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM round_assignments ra 
        WHERE ra.round_id = r.id AND ra.user_id = auth.uid()
      )
    )
  )
);

-- 9. Secure checkpoint_visits - users only see visits from their rounds
DROP POLICY IF EXISTS "Users can view checkpoint visits" ON public.checkpoint_visits;
CREATE POLICY "Users can view checkpoint visits from assigned rounds" 
ON public.checkpoint_visits 
FOR SELECT 
USING (
  check_admin_or_operator_role(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM rounds r 
    WHERE r.id = checkpoint_visits.round_id AND (
      r.user_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM round_assignments ra 
        WHERE ra.round_id = r.id AND ra.user_id = auth.uid()
      )
    )
  )
);

-- 10. Secure photos - users only see photos from their rounds/incidents
DROP POLICY IF EXISTS "Users can view photos" ON public.photos;
CREATE POLICY "Users can view photos from assigned rounds" 
ON public.photos 
FOR SELECT 
USING (
  check_admin_or_operator_role(auth.uid()) OR
  (round_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM rounds r 
    WHERE r.id = photos.round_id AND (
      r.user_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM round_assignments ra 
        WHERE ra.round_id = r.id AND ra.user_id = auth.uid()
      )
    )
  )) OR
  (incident_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM incidents i
    JOIN rounds r ON r.id = i.round_id 
    WHERE i.id = photos.incident_id AND (
      r.user_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM round_assignments ra 
        WHERE ra.round_id = r.id AND ra.user_id = auth.uid()
      )
    )
  ))
);