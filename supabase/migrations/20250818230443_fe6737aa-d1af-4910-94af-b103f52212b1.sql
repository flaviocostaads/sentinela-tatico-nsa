-- Create audit log table for tracking all system operations
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL, -- CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE
  table_name TEXT NOT NULL, -- users, rounds, vehicles, etc
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'::user_role
));

-- Allow system to insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Create function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_user_name TEXT,
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
) RETURNS UUID 
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

-- Create function to permanently delete a user and log the action
CREATE OR REPLACE FUNCTION public.delete_user_permanently(
  p_user_id UUID,
  p_admin_user_id UUID,
  p_admin_name TEXT
) RETURNS TEXT
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

  -- Delete from profiles table (this will cascade to other tables if needed)
  DELETE FROM profiles WHERE user_id = p_user_id;

  -- Note: We cannot delete from auth.users as it's managed by Supabase
  -- The user will be deactivated in auth but profile removed from our system
  
  result_message := 'Usuário ' || user_profile.name || ' foi excluído permanentemente do sistema.';
  
  RETURN result_message;
END;
$$;