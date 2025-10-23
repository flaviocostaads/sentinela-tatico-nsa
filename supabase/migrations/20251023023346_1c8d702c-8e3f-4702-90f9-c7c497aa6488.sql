-- Criar função para obter o último odômetro de um veículo considerando todas as fontes
CREATE OR REPLACE FUNCTION get_last_vehicle_odometer(p_vehicle_id UUID)
RETURNS TABLE (
  km INTEGER,
  source TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_odometers AS (
    -- Odometer records
    SELECT 
      odometer_reading as km,
      record_type as source,
      recorded_at
    FROM odometer_records
    WHERE vehicle_id = p_vehicle_id
    
    UNION ALL
    
    -- Fuel logs
    SELECT 
      odometer_reading as km,
      'abastecimento' as source,
      created_at as recorded_at
    FROM vehicle_fuel_logs
    WHERE vehicle_id = p_vehicle_id
    
    UNION ALL
    
    -- Maintenance logs  
    SELECT 
      odometer_reading as km,
      'manutencao' as source,
      start_time as recorded_at
    FROM vehicle_maintenance_logs
    WHERE vehicle_id = p_vehicle_id
    
    UNION ALL
    
    -- Rounds (initial odometer)
    SELECT 
      initial_odometer as km,
      'ronda_inicial' as source,
      start_time as recorded_at
    FROM rounds
    WHERE vehicle_id = p_vehicle_id
    AND initial_odometer IS NOT NULL
    
    UNION ALL
    
    -- Rounds (final odometer)
    SELECT 
      final_odometer as km,
      'ronda_final' as source,
      end_time as recorded_at
    FROM rounds
    WHERE vehicle_id = p_vehicle_id
    AND final_odometer IS NOT NULL
  )
  SELECT a.km, a.source, a.recorded_at
  FROM all_odometers a
  ORDER BY a.km DESC, a.recorded_at DESC
  LIMIT 1;
END;
$$;

-- Criar view materializada para histórico completo de odômetros
CREATE MATERIALIZED VIEW IF NOT EXISTS vehicle_odometer_history AS
WITH all_records AS (
  -- Odometer records
  SELECT 
    vehicle_id,
    odometer_reading as km,
    record_type as source,
    recorded_at,
    user_id,
    round_id,
    NULL::text as notes
  FROM odometer_records
  
  UNION ALL
  
  -- Fuel logs
  SELECT 
    vehicle_id,
    odometer_reading as km,
    'abastecimento' as source,
    created_at as recorded_at,
    created_by as user_id,
    round_id,
    CONCAT('Abastecimento: ', fuel_amount, 'L - R$', COALESCE(fuel_cost::text, '0')) as notes
  FROM vehicle_fuel_logs
  
  UNION ALL
  
  -- Maintenance logs
  SELECT 
    vehicle_id,
    odometer_reading as km,
    CONCAT('manutencao_', maintenance_type) as source,
    start_time as recorded_at,
    created_by as user_id,
    round_id,
    CONCAT(service_type, ': ', description) as notes
  FROM vehicle_maintenance_logs
  
  UNION ALL
  
  -- Rounds (initial)
  SELECT 
    vehicle_id,
    initial_odometer as km,
    'ronda_inicial' as source,
    start_time as recorded_at,
    user_id,
    id as round_id,
    'Início de ronda' as notes
  FROM rounds
  WHERE initial_odometer IS NOT NULL
  
  UNION ALL
  
  -- Rounds (final)
  SELECT 
    vehicle_id,
    final_odometer as km,
    'ronda_final' as source,
    end_time as recorded_at,
    user_id,
    id as round_id,
    'Fim de ronda' as notes
  FROM rounds
  WHERE final_odometer IS NOT NULL
)
SELECT 
  vehicle_id,
  km,
  source,
  recorded_at,
  user_id,
  round_id,
  notes,
  LAG(km) OVER (PARTITION BY vehicle_id ORDER BY recorded_at) as previous_km,
  km - LAG(km) OVER (PARTITION BY vehicle_id ORDER BY recorded_at) as km_diff
FROM all_records
ORDER BY vehicle_id, recorded_at DESC;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_history_vehicle_date 
ON vehicle_odometer_history(vehicle_id, recorded_at DESC);

-- Criar função para refresh da view
CREATE OR REPLACE FUNCTION refresh_vehicle_odometer_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY vehicle_odometer_history;
  RETURN NULL;
END;
$$;

-- Criar triggers para atualizar a view automaticamente
DROP TRIGGER IF EXISTS refresh_odometer_history_on_odometer_insert ON odometer_records;
CREATE TRIGGER refresh_odometer_history_on_odometer_insert
AFTER INSERT OR UPDATE OR DELETE ON odometer_records
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_vehicle_odometer_history();

DROP TRIGGER IF EXISTS refresh_odometer_history_on_fuel_insert ON vehicle_fuel_logs;
CREATE TRIGGER refresh_odometer_history_on_fuel_insert
AFTER INSERT OR UPDATE OR DELETE ON vehicle_fuel_logs
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_vehicle_odometer_history();

DROP TRIGGER IF EXISTS refresh_odometer_history_on_maintenance_insert ON vehicle_maintenance_logs;
CREATE TRIGGER refresh_odometer_history_on_maintenance_insert
AFTER INSERT OR UPDATE OR DELETE ON vehicle_maintenance_logs
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_vehicle_odometer_history();

DROP TRIGGER IF EXISTS refresh_odometer_history_on_round_insert ON rounds;
CREATE TRIGGER refresh_odometer_history_on_round_insert
AFTER INSERT OR UPDATE OR DELETE ON rounds
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_vehicle_odometer_history();

-- Criar função para validar odômetro antes de inserir
CREATE OR REPLACE FUNCTION validate_odometer_reading(
  p_vehicle_id UUID,
  p_new_km INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_km INTEGER;
  v_last_source TEXT;
  v_last_date TIMESTAMP WITH TIME ZONE;
  v_result JSONB;
BEGIN
  -- Buscar último odômetro
  SELECT km, source, recorded_at 
  INTO v_last_km, v_last_source, v_last_date
  FROM get_last_vehicle_odometer(p_vehicle_id);
  
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
$$;

-- Permitir acesso às funções para usuários autenticados
GRANT EXECUTE ON FUNCTION get_last_vehicle_odometer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_odometer_reading(UUID, INTEGER) TO authenticated;
GRANT SELECT ON vehicle_odometer_history TO authenticated;