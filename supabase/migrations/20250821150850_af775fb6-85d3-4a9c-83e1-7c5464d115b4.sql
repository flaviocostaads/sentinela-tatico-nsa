-- Create function to delete incidents with audit logging for admins only
CREATE OR REPLACE FUNCTION public.delete_incident_with_audit(
  p_incident_id uuid, 
  p_admin_user_id uuid, 
  p_admin_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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