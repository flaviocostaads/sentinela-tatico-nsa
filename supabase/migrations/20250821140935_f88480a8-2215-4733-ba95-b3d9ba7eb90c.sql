-- Create function to delete a round and all its related data with audit logging
CREATE OR REPLACE FUNCTION public.delete_round_with_audit(
  p_round_id uuid,
  p_admin_user_id uuid,
  p_admin_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  round_record RECORD;
  result_message TEXT;
  visits_count INTEGER;
  incidents_count INTEGER;
  photos_count INTEGER;
  route_points_count INTEGER;
BEGIN
  -- Check if admin has permission
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = p_admin_user_id 
    AND role = 'admin'::user_role
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir rondas';
  END IF;

  -- Get round details before deletion
  SELECT * INTO round_record FROM rounds WHERE id = p_round_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ronda não encontrada';
  END IF;

  -- Count related records for audit
  SELECT COUNT(*) INTO visits_count FROM checkpoint_visits WHERE round_id = p_round_id;
  SELECT COUNT(*) INTO incidents_count FROM incidents WHERE round_id = p_round_id;
  SELECT COUNT(*) INTO photos_count FROM photos WHERE round_id = p_round_id;
  SELECT COUNT(*) INTO route_points_count FROM route_points WHERE round_id = p_round_id;

  -- Delete related records (in correct order due to foreign keys)
  DELETE FROM checkpoint_visits WHERE round_id = p_round_id;
  DELETE FROM incidents WHERE round_id = p_round_id;
  DELETE FROM photos WHERE round_id = p_round_id;
  DELETE FROM route_points WHERE round_id = p_round_id;
  DELETE FROM odometer_records WHERE round_id = p_round_id;
  DELETE FROM vehicle_fuel_logs WHERE round_id = p_round_id;
  DELETE FROM vehicle_maintenance_logs WHERE round_id = p_round_id;
  DELETE FROM round_assignments WHERE round_id = p_round_id;
  
  -- Finally delete the round itself
  DELETE FROM rounds WHERE id = p_round_id;

  -- Log the deletion with summary of deleted items
  PERFORM log_audit_event(
    p_admin_user_id,
    p_admin_name,
    'DELETE_ROUND',
    'rounds',
    round_record.id,
    jsonb_build_object(
      'round', row_to_json(round_record),
      'deleted_visits', visits_count,
      'deleted_incidents', incidents_count,
      'deleted_photos', photos_count,
      'deleted_route_points', route_points_count
    ),
    NULL
  );

  result_message := format(
    'Ronda %s foi excluída completamente. Removidos: %s visitas, %s incidentes, %s fotos, %s pontos de rota.',
    round_record.id,
    visits_count,
    incidents_count,
    photos_count,
    route_points_count
  );
  
  RETURN result_message;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao excluir ronda: %', SQLERRM;
END;
$$;