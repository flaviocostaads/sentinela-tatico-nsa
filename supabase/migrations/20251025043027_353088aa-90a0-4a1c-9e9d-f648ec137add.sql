-- FASE 2: Sistema de Configuração de Combustível
-- Adicionar campos de eficiência aos veículos
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS fuel_efficiency NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fuel_efficiency_unit TEXT DEFAULT 'km_per_liter',
ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'gasoline';

COMMENT ON COLUMN vehicles.fuel_efficiency IS 'Consumo médio do veículo (ex: 12.5 km/l)';
COMMENT ON COLUMN vehicles.fuel_efficiency_unit IS 'Unidade: km_per_liter, liter_per_100km, mpg';
COMMENT ON COLUMN vehicles.fuel_type IS 'Tipo: gasoline, diesel, ethanol, electric';

-- Criar tabela de configuração de preços de combustível
CREATE TABLE IF NOT EXISTS fuel_price_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_type TEXT NOT NULL UNIQUE,
  price_per_liter NUMERIC(8,2) NOT NULL CHECK (price_per_liter > 0),
  currency TEXT DEFAULT 'BRL',
  active BOOLEAN DEFAULT true,
  last_updated_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE fuel_price_config IS 'Configuração de preços de combustível por tipo';

-- Inserir valores iniciais
INSERT INTO fuel_price_config (fuel_type, price_per_liter, active) VALUES
  ('gasoline', 5.50, true),
  ('diesel', 6.20, true),
  ('ethanol', 3.80, true),
  ('electric', 0.80, true)
ON CONFLICT (fuel_type) DO NOTHING;

-- RLS Policies para fuel_price_config
ALTER TABLE fuel_price_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fuel prices"
ON fuel_price_config FOR ALL
USING (check_admin_role(auth.uid()));

CREATE POLICY "Users can view active fuel prices"
ON fuel_price_config FOR SELECT
USING (active = true);

-- Trigger para updated_at
CREATE TRIGGER update_fuel_price_config_updated_at
  BEFORE UPDATE ON fuel_price_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- FASE 3: Sistema de Checklist Veicular
-- Tabela de templates de checklist
CREATE TABLE IF NOT EXISTS vehicle_inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'motorcycle', 'truck')),
  items JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN vehicle_inspection_templates.items IS 
'Array de categorias e itens do checklist em formato JSONB';

-- Tabela de inspeções realizadas
CREATE TABLE IF NOT EXISTS vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
  template_id UUID REFERENCES vehicle_inspection_templates(id),
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('pre_shift', 'post_shift', 'maintenance', 'emergency')),
  checklist_data JSONB NOT NULL,
  odometer_reading INTEGER NOT NULL CHECK (odometer_reading >= 0),
  fuel_level NUMERIC(5,2) CHECK (fuel_level >= 0 AND fuel_level <= 100),
  overall_status TEXT NOT NULL CHECK (overall_status IN ('approved', 'approved_with_issues', 'rejected', 'pending_review')),
  issues_reported JSONB,
  notes TEXT,
  signature_data TEXT,
  inspection_date TIMESTAMPTZ DEFAULT now(),
  shift_start_time TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(user_id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle_id ON vehicle_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_inspector_id ON vehicle_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_date ON vehicle_inspections(inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_status ON vehicle_inspections(overall_status);

-- Tabela de fotos de avarias
CREATE TABLE IF NOT EXISTS vehicle_inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
  checklist_item_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  issue_description TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection_id ON vehicle_inspection_photos(inspection_id);

-- RLS Policies
ALTER TABLE vehicle_inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspection_photos ENABLE ROW LEVEL SECURITY;

-- Templates: Admins gerenciam, todos visualizam
CREATE POLICY "Admins manage templates"
ON vehicle_inspection_templates FOR ALL
USING (check_admin_role(auth.uid()));

CREATE POLICY "Users view templates"
ON vehicle_inspection_templates FOR SELECT
USING (active = true);

-- Inspeções: Táticos criam, admins/operadores visualizam
CREATE POLICY "Users create own inspections"
ON vehicle_inspections FOR INSERT
WITH CHECK (inspector_id = auth.uid());

CREATE POLICY "Users view own inspections"
ON vehicle_inspections FOR SELECT
USING (inspector_id = auth.uid() OR check_admin_or_operator_role(auth.uid()));

CREATE POLICY "Admins update inspections"
ON vehicle_inspections FOR UPDATE
USING (check_admin_or_operator_role(auth.uid()));

-- Fotos: Mesmas regras das inspeções
CREATE POLICY "Users manage photos"
ON vehicle_inspection_photos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM vehicle_inspections
    WHERE id = inspection_id
    AND (inspector_id = auth.uid() OR check_admin_or_operator_role(auth.uid()))
  )
);

-- Triggers
CREATE TRIGGER update_vehicle_inspection_templates_updated_at
  BEFORE UPDATE ON vehicle_inspection_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir templates padrão
INSERT INTO vehicle_inspection_templates (name, vehicle_type, items, active) VALUES
(
  'Checklist Padrão - Moto',
  'motorcycle',
  '[
    {
      "category": "motor",
      "categoryLabel": "Motor",
      "items": [
        {"id": "oil_level", "name": "Nível de óleo do motor", "required": true},
        {"id": "oil_leaks", "name": "Vazamentos visíveis", "required": true},
        {"id": "belt", "name": "Correia dentada", "required": false}
      ]
    },
    {
      "category": "tires",
      "categoryLabel": "Pneus",
      "items": [
        {"id": "tire_pressure", "name": "Pressão adequada (frente e trás)", "required": true},
        {"id": "tire_tread", "name": "Profundidade do sulco", "required": true},
        {"id": "tire_wear", "name": "Desgaste irregular", "required": false}
      ]
    },
    {
      "category": "electrical",
      "categoryLabel": "Elétrica",
      "items": [
        {"id": "headlight", "name": "Farol alto/baixo", "required": true},
        {"id": "turn_signals", "name": "Setas (frente e trás)", "required": true},
        {"id": "brake_light", "name": "Luz de freio", "required": true},
        {"id": "horn", "name": "Buzina", "required": true}
      ]
    },
    {
      "category": "brakes",
      "categoryLabel": "Freios",
      "items": [
        {"id": "front_brake", "name": "Freio dianteiro", "required": true},
        {"id": "rear_brake", "name": "Freio traseiro", "required": true},
        {"id": "brake_fluid", "name": "Fluido de freio", "required": false}
      ]
    },
    {
      "category": "safety",
      "categoryLabel": "Segurança",
      "items": [
        {"id": "mirrors", "name": "Retrovisores ajustados", "required": true},
        {"id": "helmet", "name": "Capacete em boas condições", "required": true},
        {"id": "first_aid", "name": "Kit primeiros socorros", "required": false},
        {"id": "documents", "name": "Documentação do veículo", "required": true}
      ]
    }
  ]'::jsonb,
  true
),
(
  'Checklist Padrão - Carro',
  'car',
  '[
    {
      "category": "motor",
      "categoryLabel": "Motor",
      "items": [
        {"id": "oil_level", "name": "Nível de óleo do motor", "required": true},
        {"id": "coolant", "name": "Nível de água do radiador", "required": true},
        {"id": "leaks", "name": "Vazamentos visíveis", "required": true},
        {"id": "belt", "name": "Correia dentada", "required": false},
        {"id": "battery", "name": "Bateria (cabos e terminais)", "required": true}
      ]
    },
    {
      "category": "tires",
      "categoryLabel": "Pneus",
      "items": [
        {"id": "tire_pressure", "name": "Pressão adequada (4 pneus + estepe)", "required": true},
        {"id": "tire_tread", "name": "Profundidade do sulco", "required": true},
        {"id": "tire_wear", "name": "Desgaste irregular", "required": false},
        {"id": "wheel_nuts", "name": "Porcas de roda apertadas", "required": true}
      ]
    },
    {
      "category": "electrical",
      "categoryLabel": "Elétrica",
      "items": [
        {"id": "headlights", "name": "Faróis (alto/baixo)", "required": true},
        {"id": "turn_signals", "name": "Setas (frente e trás)", "required": true},
        {"id": "brake_lights", "name": "Luzes de freio", "required": true},
        {"id": "reverse_light", "name": "Luz de ré", "required": true},
        {"id": "horn", "name": "Buzina", "required": true},
        {"id": "wipers", "name": "Limpador de para-brisa", "required": true}
      ]
    },
    {
      "category": "brakes",
      "categoryLabel": "Freios",
      "items": [
        {"id": "service_brake", "name": "Freio de serviço", "required": true},
        {"id": "parking_brake", "name": "Freio de mão", "required": true},
        {"id": "brake_fluid", "name": "Fluido de freio", "required": true}
      ]
    },
    {
      "category": "safety",
      "categoryLabel": "Segurança",
      "items": [
        {"id": "seatbelts", "name": "Cintos de segurança (todos)", "required": true},
        {"id": "mirrors", "name": "Retrovisores ajustados", "required": true},
        {"id": "fire_extinguisher", "name": "Extintor de incêndio (validade)", "required": true},
        {"id": "warning_triangle", "name": "Triângulo de sinalização", "required": true},
        {"id": "jack", "name": "Macaco e chave de roda", "required": true},
        {"id": "first_aid", "name": "Kit primeiros socorros", "required": false},
        {"id": "documents", "name": "Documentação do veículo", "required": true}
      ]
    }
  ]'::jsonb,
  true
);