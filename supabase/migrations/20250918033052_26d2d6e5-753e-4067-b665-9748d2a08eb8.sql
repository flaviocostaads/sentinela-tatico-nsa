-- Add new RLS policy to allow tactical users to view clients from active round templates
CREATE POLICY "Tactical users can view clients from active round templates" 
ON public.clients 
FOR SELECT 
USING (
  check_admin_or_operator_role(auth.uid()) OR
  (EXISTS ( 
    SELECT 1
    FROM rounds r
    JOIN round_template_checkpoints rtc ON rtc.template_id = r.template_id
    WHERE rtc.client_id = clients.id
      AND r.user_id = auth.uid()
      AND r.status IN ('pending', 'active')
  )) OR
  (EXISTS ( 
    SELECT 1
    FROM (rounds r
      JOIN round_assignments ra ON ra.round_id = r.id)
    WHERE r.client_id = clients.id 
      AND ra.user_id = auth.uid()
  )) OR 
  (EXISTS ( 
    SELECT 1
    FROM rounds r
    WHERE r.client_id = clients.id 
      AND r.user_id = auth.uid()
  ))
);