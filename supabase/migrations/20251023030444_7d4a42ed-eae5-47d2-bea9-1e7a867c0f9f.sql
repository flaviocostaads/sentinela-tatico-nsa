-- Fix materialized view refresh issue by adding unique index
-- This allows concurrent refresh which is required by triggers

-- First, drop the existing trigger that's causing issues
DROP TRIGGER IF EXISTS refresh_vehicle_odometer_history_on_fuel ON vehicle_fuel_logs;
DROP TRIGGER IF EXISTS refresh_vehicle_odometer_history_on_maintenance ON vehicle_maintenance_logs;
DROP TRIGGER IF EXISTS refresh_vehicle_odometer_history_on_round ON rounds;
DROP TRIGGER IF EXISTS refresh_vehicle_odometer_history_on_odometer ON odometer_records;

-- Drop the existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS vehicle_odometer_history CASCADE;

-- Recreate the materialized view with a unique identifier
CREATE MATERIALIZED VIEW vehicle_odometer_history AS
SELECT 
  gen_random_uuid() as id,  -- Add unique ID for each row
  vehicle_id,
  km,
  source,
  recorded_at
FROM (
  -- Odometer records
  SELECT 
    vehicle_id,
    odometer_reading as km,
    record_type as source,
    recorded_at
  FROM odometer_records
  
  UNION ALL
  
  -- Fuel logs
  SELECT 
    vehicle_id,
    odometer_reading as km,
    'abastecimento' as source,
    created_at as recorded_at
  FROM vehicle_fuel_logs
  
  UNION ALL
  
  -- Maintenance logs  
  SELECT 
    vehicle_id,
    odometer_reading as km,
    'manutencao' as source,
    start_time as recorded_at
  FROM vehicle_maintenance_logs
  
  UNION ALL
  
  -- Rounds (initial odometer)
  SELECT 
    vehicle_id,
    initial_odometer as km,
    'ronda_inicial' as source,
    start_time as recorded_at
  FROM rounds
  WHERE initial_odometer IS NOT NULL
  
  UNION ALL
  
  -- Rounds (final odometer)
  SELECT 
    vehicle_id,
    final_odometer as km,
    'ronda_final' as source,
    end_time as recorded_at
  FROM rounds
  WHERE final_odometer IS NOT NULL
) combined_data;

-- Create unique index on the id column for concurrent refresh
CREATE UNIQUE INDEX vehicle_odometer_history_id_idx ON vehicle_odometer_history(id);

-- Create additional indexes for performance
CREATE INDEX vehicle_odometer_history_vehicle_id_idx ON vehicle_odometer_history(vehicle_id);
CREATE INDEX vehicle_odometer_history_recorded_at_idx ON vehicle_odometer_history(recorded_at DESC);

-- Recreate triggers with non-concurrent refresh (safer approach)
-- These will still work but without the concurrent refresh requirement
CREATE TRIGGER refresh_vehicle_odometer_history_on_fuel
  AFTER INSERT OR UPDATE OR DELETE ON vehicle_fuel_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_vehicle_odometer_history();

CREATE TRIGGER refresh_vehicle_odometer_history_on_maintenance
  AFTER INSERT OR UPDATE OR DELETE ON vehicle_maintenance_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_vehicle_odometer_history();

CREATE TRIGGER refresh_vehicle_odometer_history_on_round
  AFTER INSERT OR UPDATE OR DELETE ON rounds
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_vehicle_odometer_history();

CREATE TRIGGER refresh_vehicle_odometer_history_on_odometer
  AFTER INSERT OR UPDATE OR DELETE ON odometer_records
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_vehicle_odometer_history();

-- Update the refresh function to not use CONCURRENTLY
CREATE OR REPLACE FUNCTION public.refresh_vehicle_odometer_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW vehicle_odometer_history;
  RETURN NULL;
END;
$function$;