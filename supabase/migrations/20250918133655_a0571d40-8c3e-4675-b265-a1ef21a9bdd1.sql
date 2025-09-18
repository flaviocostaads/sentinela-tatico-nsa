-- Fix security vulnerability: Restrict round_templates access to admin/operator roles only
-- Drop the overly permissive policy that allows any authenticated user to view templates
DROP POLICY IF EXISTS "Authenticated users can view active round templates" ON public.round_templates;

-- Create a new secure policy that only allows admin and operator roles to view templates
CREATE POLICY "Only authorized personnel can view round templates" 
ON public.round_templates 
FOR SELECT 
USING (check_admin_or_operator_role(auth.uid()));

-- Add a specific policy for tactical users to view only templates assigned to their active rounds
CREATE POLICY "Tactical users can view templates for assigned rounds only" 
ON public.round_templates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM rounds r 
    WHERE r.template_id = round_templates.id 
      AND (r.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM round_assignments ra 
        WHERE ra.round_id = r.id AND ra.user_id = auth.uid()
      ))
      AND r.status IN ('pending', 'active')
  )
);