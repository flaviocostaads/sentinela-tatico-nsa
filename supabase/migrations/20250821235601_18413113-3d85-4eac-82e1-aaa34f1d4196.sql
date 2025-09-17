-- Update all database functions with proper search path security
-- This prevents SQL injection through schema manipulation

-- Update check_admin_role function
CREATE OR REPLACE FUNCTION public.check_admin_role(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = user_uuid AND role = 'admin'::user_role
  );
$$;

-- Update log_audit_event function  
CREATE OR REPLACE FUNCTION public.log_audit_event(p_user_id uuid, p_user_name text, p_action text, p_table_name text, p_record_id uuid DEFAULT NULL::uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id, user_name, action, table_name, record_id, old_values, new_values
  ) VALUES (
    p_user_id, p_user_name, p_action, p_table_name, p_record_id, p_old_values, p_new_values
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Update delete_user_permanently function
CREATE OR REPLACE FUNCTION public.delete_user_permanently(p_user_id uuid, p_admin_user_id uuid, p_admin_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_profile RECORD;
  result_message TEXT;
BEGIN
  -- Check if admin has permission
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = p_admin_user_id 
    AND role = 'admin'::user_role
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Get user profile before deletion
  SELECT * INTO user_profile FROM profiles WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Log the deletion
  PERFORM log_audit_event(
    p_admin_user_id,
    p_admin_name,
    'DELETE',
    'profiles',
    user_profile.id,
    row_to_json(user_profile)::jsonb,
    NULL
  );

  -- Delete from profiles table first
  DELETE FROM profiles WHERE user_id = p_user_id;
  
  -- Delete from auth.users (this requires admin service role)
  -- Note: This will be handled by RLS and cascading deletes
  DELETE FROM auth.users WHERE id = p_user_id;
  
  result_message := 'Usuário ' || user_profile.name || ' foi excluído permanentemente do sistema.';
  
  RETURN result_message;
EXCEPTION
  WHEN OTHERS THEN
    -- If auth deletion fails, we still want to remove from profiles
    DELETE FROM profiles WHERE user_id = p_user_id;
    result_message := 'Usuário ' || COALESCE(user_profile.name, 'desconhecido') || ' foi removido do sistema (perfil removido).';
    RETURN result_message;
END;
$$;

-- Update delete_round_with_audit function
CREATE OR REPLACE FUNCTION public.delete_round_with_audit(p_round_id uuid, p_admin_user_id uuid, p_admin_name text)
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

-- Update update_maintenance_schedule_after_service function
CREATE OR REPLACE FUNCTION public.update_maintenance_schedule_after_service()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the maintenance schedule when a service is completed
  UPDATE public.vehicle_maintenance_schedules
  SET 
    last_service_km = NEW.odometer_reading,
    last_service_date = NEW.start_time,
    next_service_km = CASE 
      WHEN interval_km IS NOT NULL THEN NEW.odometer_reading + interval_km
      ELSE next_service_km
    END,
    next_service_date = CASE 
      WHEN interval_days IS NOT NULL THEN NEW.start_time + INTERVAL '1 day' * interval_days
      ELSE next_service_date
    END,
    updated_at = now()
  WHERE vehicle_id = NEW.vehicle_id 
    AND service_type = NEW.service_type
    AND active = true;
    
  RETURN NEW;
END;
$$;

-- Update delete_incident_with_audit function  
CREATE OR REPLACE FUNCTION public.delete_incident_with_audit(p_incident_id uuid, p_admin_user_id uuid, p_admin_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  incident_record RECORD;
  result_message TEXT;
BEGIN
  -- Check if admin has permission
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = p_admin_user_id 
    AND role = 'admin'::user_role
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir ocorrências';
  END IF;

  -- Get incident details before deletion
  SELECT * INTO incident_record FROM incidents WHERE id = p_incident_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ocorrência não encontrada';
  END IF;

  -- Log the deletion
  PERFORM log_audit_event(
    p_admin_user_id,
    p_admin_name,
    'DELETE_INCIDENT',
    'incidents',
    incident_record.id,
    row_to_json(incident_record)::jsonb,
    NULL
  );

  -- Delete the incident
  DELETE FROM incidents WHERE id = p_incident_id;
  
  result_message := 'Ocorrência "' || incident_record.title || '" foi excluída permanentemente do sistema.';
  
  RETURN result_message;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao excluir ocorrência: %', SQLERRM;
END;
$$;

-- Update preserve_checkpoint_data function
CREATE OR REPLACE FUNCTION public.preserve_checkpoint_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Ensure checklist_items are preserved during updates
  IF NEW.checklist_items IS NULL AND OLD.checklist_items IS NOT NULL THEN
    NEW.checklist_items = OLD.checklist_items;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update update_user_location_timestamp function
CREATE OR REPLACE FUNCTION public.update_user_location_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Desativar localizações antigas do mesmo usuário
  UPDATE user_locations 
  SET is_active = false 
  WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND is_active = true;
  
  RETURN NEW;
END;
$$;

-- Update check_admin_or_operator_role function
CREATE OR REPLACE FUNCTION public.check_admin_or_operator_role(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = user_uuid AND role = ANY (ARRAY['admin'::user_role, 'operador'::user_role])
  );
$$;

-- Update handle_new_user function  
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tatico'::user_role)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    email = NEW.email,
    role = COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tatico'::user_role),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;