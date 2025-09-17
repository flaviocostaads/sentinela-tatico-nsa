-- Add investigation and resolution fields to incidents table
ALTER TABLE public.incidents 
ADD COLUMN investigation_report TEXT,
ADD COLUMN investigation_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN investigated_by UUID REFERENCES auth.users(id),
ADD COLUMN resolution_comment TEXT,
ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN resolved_by UUID REFERENCES auth.users(id);

-- Update incidents policies to allow status updates by authorized users
DROP POLICY IF EXISTS "Taticos can create incidents" ON public.incidents;
DROP POLICY IF EXISTS "Users can view incidents" ON public.incidents;

-- Allow creating incidents for authorized users
CREATE POLICY "Authorized users can create incidents"
ON public.incidents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['tatico'::user_role, 'operador'::user_role, 'admin'::user_role])
  )
);

-- Allow viewing incidents for authenticated users
CREATE POLICY "Authenticated users can view incidents"
ON public.incidents
FOR SELECT
TO authenticated
USING (true);

-- Allow updating incidents for admins and operadores
CREATE POLICY "Admins and operadores can update incidents"
ON public.incidents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['operador'::user_role, 'admin'::user_role])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = ANY (ARRAY['operador'::user_role, 'admin'::user_role])
  )
);