-- Fix RLS policy for tactical users to create rounds
DROP POLICY IF EXISTS "Taticos can create rounds" ON rounds;

CREATE POLICY "Taticos can create rounds"
ON rounds
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = ANY(ARRAY['admin'::user_role, 'operador'::user_role, 'tatico'::user_role])
  )
);