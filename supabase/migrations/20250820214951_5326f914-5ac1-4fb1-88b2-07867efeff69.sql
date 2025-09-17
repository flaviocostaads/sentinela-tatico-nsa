-- Corrigir avisos de segurança - definir search_path nas funções
CREATE OR REPLACE FUNCTION update_user_location_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
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