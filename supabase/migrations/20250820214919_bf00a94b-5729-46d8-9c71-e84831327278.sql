-- Adicionar suporte para checklists expandidos nos checkpoints
ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS checklist_items JSONB DEFAULT '[]';

-- Adicionar tabela para tracking de localização em tempo real
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  round_id UUID NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  accuracy NUMERIC NULL,
  speed NUMERIC NULL,
  heading NUMERIC NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS on user_locations
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- Policies for user_locations
CREATE POLICY "Users can insert their own location" 
ON user_locations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all locations" 
ON user_locations 
FOR SELECT 
USING (true);

-- Adicionar campos para controle de checklist no round
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS checklist_completed BOOLEAN DEFAULT false;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS route_map_data JSONB DEFAULT '{}';

-- Adicionar trigger para atualizar timestamp de localização
CREATE OR REPLACE FUNCTION update_user_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Desativar localizações antigas do mesmo usuário
  UPDATE user_locations 
  SET is_active = false 
  WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_location_update_trigger
  AFTER INSERT ON user_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_location_timestamp();

-- Habilitar realtime para user_locations
ALTER TABLE user_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE user_locations;