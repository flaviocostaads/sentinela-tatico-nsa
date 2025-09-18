-- Fix vehicles policies with correct enum values
DROP POLICY IF EXISTS "Users can view active vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can manage vehicles" ON vehicles;
DROP POLICY IF EXISTS "Only operators and admins can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins and operadores can manage vehicles" ON vehicles;

-- Create corrected policy for vehicles access
CREATE POLICY "Users can view active vehicles for tactical operations"
ON vehicles
FOR SELECT
USING (
  active = true AND (
    auth.uid() IN (
      SELECT user_id FROM profiles 
      WHERE role IN ('admin', 'operador', 'tatico')
    )
  )
);

-- Allow admins and operators to manage vehicles
CREATE POLICY "Admins and operators can manage vehicles"
ON vehicles
FOR ALL
USING (
  auth.uid() IN (
    SELECT user_id FROM profiles WHERE role IN ('admin', 'operador')
  )
);