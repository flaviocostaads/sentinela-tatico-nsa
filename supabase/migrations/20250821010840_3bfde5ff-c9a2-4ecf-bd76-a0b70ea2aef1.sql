-- Fix the tactical user policy to use user_id instead of profiles.id
DROP POLICY IF EXISTS "Taticos can create rounds" ON public.rounds;

CREATE POLICY "Taticos can create rounds"
ON public.rounds
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('admin', 'operador', 'tatico')
  )
);