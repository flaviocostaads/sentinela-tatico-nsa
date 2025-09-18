-- Remove the overly permissive policy that allows all authenticated users to view template checkpoints
DROP POLICY IF EXISTS "Authenticated users can view template checkpoints" ON public.round_template_checkpoints;

-- Create a more restrictive policy that only allows authorized personnel to view template checkpoints
CREATE POLICY "Only authorized personnel can view template checkpoints" 
ON public.round_template_checkpoints 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = ANY (ARRAY['admin'::user_role, 'operador'::user_role])
  )
);