-- Fix RLS policies for fuel logs and maintenance logs to allow tatico and operador profiles
-- Update fuel logs policy
DROP POLICY IF EXISTS "Users can create fuel logs for their rounds" ON vehicle_fuel_logs;

CREATE POLICY "Taticos and operadores can create fuel logs"
ON vehicle_fuel_logs FOR INSERT
USING (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('tatico', 'operador', 'admin')
  )
);

-- Update maintenance logs policy  
DROP POLICY IF EXISTS "Users can create maintenance logs for their rounds" ON vehicle_maintenance_logs;

CREATE POLICY "Taticos and operadores can create maintenance logs"
ON vehicle_maintenance_logs FOR INSERT  
USING (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('tatico', 'operador', 'admin')
  )
);

-- Add UPDATE and DELETE policies for fuel logs (admin only)
CREATE POLICY "Admins can update fuel logs"
ON vehicle_fuel_logs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete fuel logs"
ON vehicle_fuel_logs FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Add UPDATE and DELETE policies for maintenance logs (admin only)
CREATE POLICY "Admins can update maintenance logs"
ON vehicle_maintenance_logs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete maintenance logs"  
ON vehicle_maintenance_logs FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Fix incidents RLS policy
DROP POLICY IF EXISTS "Users can create incidents for their rounds" ON incidents;

CREATE POLICY "Taticos can create incidents"
ON incidents FOR INSERT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('tatico', 'operador', 'admin')
  )
);