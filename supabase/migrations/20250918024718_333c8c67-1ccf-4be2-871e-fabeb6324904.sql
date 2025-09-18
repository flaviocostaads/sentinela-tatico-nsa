-- Allow tactical users to view template checkpoints for their assigned rounds
CREATE POLICY "Tactical users can view template checkpoints for their rounds" 
ON public.round_template_checkpoints 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.rounds r 
    WHERE r.template_id = round_template_checkpoints.template_id 
    AND r.user_id = auth.uid()
    AND r.status IN ('pending', 'active')
  )
);