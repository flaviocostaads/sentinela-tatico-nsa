-- Update the delete_user_permanently function to properly handle user deletion
CREATE OR REPLACE FUNCTION public.delete_user_permanently(p_user_id uuid, p_admin_user_id uuid, p_admin_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;