-- First, let's check the current constraints on the vehicle_maintenance_logs table
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public' 
AND constraint_name LIKE '%vehicle_maintenance_logs%';

-- Check the column details
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'vehicle_maintenance_logs' 
AND table_schema = 'public'
ORDER BY ordinal_position;