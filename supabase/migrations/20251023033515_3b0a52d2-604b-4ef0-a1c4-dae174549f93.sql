-- Simplify get_last_vehicle_odometer to use the materialized view
DROP FUNCTION IF EXISTS get_last_vehicle_odometer(uuid);

CREATE OR REPLACE FUNCTION get_last_vehicle_odometer(p_vehicle_id uuid)
RETURNS TABLE(km integer, source text, recorded_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    voh.km,
    voh.source,
    voh.recorded_at
  FROM vehicle_odometer_history voh
  WHERE voh.vehicle_id = p_vehicle_id
  ORDER BY voh.km DESC, voh.recorded_at DESC
  LIMIT 1;
$function$;

-- Simplify validate_odometer_reading as well
DROP FUNCTION IF EXISTS validate_odometer_reading(uuid, integer);

CREATE OR REPLACE FUNCTION validate_odometer_reading(p_vehicle_id uuid, p_new_km integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_km INTEGER;
  v_last_source TEXT;
  v_last_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Buscar último odômetro da view materializada
  SELECT voh.km, voh.source, voh.recorded_at
  INTO v_last_km, v_last_source, v_last_date
  FROM vehicle_odometer_history voh
  WHERE voh.vehicle_id = p_vehicle_id
  ORDER BY voh.km DESC, voh.recorded_at DESC
  LIMIT 1;
  
  -- Se não houver registro anterior, permitir
  IF v_last_km IS NULL THEN
    RETURN jsonb_build_object(
      'valid', true,
      'message', 'Primeiro registro de odômetro para este veículo'
    );
  END IF;
  
  -- Validar se novo km é maior
  IF p_new_km < v_last_km THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error_code', 'KM_LESS_THAN_LAST',
      'message', format(
        'Valor informado (%s km) é menor que o último registro (%s km) em %s, fonte: %s',
        p_new_km,
        v_last_km,
        to_char(v_last_date, 'DD/MM/YYYY HH24:MI'),
        v_last_source
      ),
      'last_km', v_last_km,
      'last_source', v_last_source,
      'last_date', v_last_date
    );
  END IF;
  
  -- Validação OK
  RETURN jsonb_build_object(
    'valid', true,
    'message', format('Odômetro válido. Diferença: %s km', p_new_km - v_last_km),
    'km_diff', p_new_km - v_last_km,
    'last_km', v_last_km
  );
END;
$function$;