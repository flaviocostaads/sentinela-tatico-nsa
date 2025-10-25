-- Modificar a função delete_user_permanently para também apagar do auth.users
-- Isso garante que usuários possam ser recadastrados sem duplicidade

CREATE OR REPLACE FUNCTION public.delete_user_permanently(
  p_user_id uuid,
  p_admin_user_id uuid,
  p_admin_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  result_message TEXT;
  auth_user_email TEXT;
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

  -- Store email for logging
  auth_user_email := user_profile.email;

  -- Log the deletion BEFORE deleting
  PERFORM log_audit_event(
    p_admin_user_id,
    p_admin_name,
    'DELETE',
    'profiles',
    user_profile.id,
    row_to_json(user_profile)::jsonb,
    NULL
  );

  -- Delete from profiles table first (this will not trigger cascade to auth.users)
  DELETE FROM profiles WHERE user_id = p_user_id;
  
  -- Delete from auth.users to prevent duplicate registration
  -- This requires service role but SECURITY DEFINER allows it
  DELETE FROM auth.users WHERE id = p_user_id;
  
  result_message := format(
    'Usuário %s (%s) foi excluído permanentemente do sistema, incluindo autenticação.',
    user_profile.name,
    auth_user_email
  );
  
  RETURN result_message;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but still try to clean up
    RAISE EXCEPTION 'Erro ao excluir usuário: %. Verifique as permissões.', SQLERRM;
END;
$function$;