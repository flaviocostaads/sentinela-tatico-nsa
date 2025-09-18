-- Enable RLS on vehicles table and create appropriate policies
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view vehicles for their role" ON vehicles;
DROP POLICY IF EXISTS "Admins and operators can view all vehicles" ON vehicles;

-- Create policy for vehicles access - operators and tacticals can view all active vehicles
CREATE POLICY "Users can view active vehicles"
ON vehicles
FOR SELECT
USING (
  active = true AND (
    auth.uid() IN (
      SELECT user_id FROM profiles 
      WHERE role IN ('admin', 'operator', 'tatico')
    )
  )
);

-- Allow admins to manage vehicles
CREATE POLICY "Admins can manage vehicles"
ON vehicles
FOR ALL
USING (
  auth.uid() IN (
    SELECT user_id FROM profiles WHERE role = 'admin'
  )
);