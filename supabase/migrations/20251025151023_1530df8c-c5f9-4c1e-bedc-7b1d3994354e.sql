-- Criar tabela para armazenar cálculos de custo de ronda
CREATE TABLE cost_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  calculation_name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  created_by UUID NOT NULL,
  
  -- Dados do Veículo
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'motorcycle')),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  fuel_type TEXT NOT NULL,
  fuel_price_per_liter NUMERIC(8,2) NOT NULL,
  fuel_efficiency NUMERIC(5,2) NOT NULL,
  
  -- Dados da Operação
  distance_base_to_client NUMERIC(10,2) NOT NULL,
  rounds_per_day INTEGER NOT NULL CHECK (rounds_per_day > 0),
  time_per_round NUMERIC(5,2) NOT NULL,
  days_per_month INTEGER NOT NULL CHECK (days_per_month > 0 AND days_per_month <= 31),
  
  -- Custos
  tactical_salary NUMERIC(10,2) NOT NULL,
  hourly_rate NUMERIC(10,2),
  other_monthly_costs NUMERIC(10,2) DEFAULT 0,
  profit_margin NUMERIC(5,2) DEFAULT 30.00,
  
  -- Resultados Calculados
  daily_distance NUMERIC(10,2) NOT NULL,
  monthly_distance NUMERIC(10,2) NOT NULL,
  daily_fuel_cost NUMERIC(10,2) NOT NULL,
  monthly_fuel_cost NUMERIC(10,2) NOT NULL,
  daily_labor_cost NUMERIC(10,2) NOT NULL,
  monthly_labor_cost NUMERIC(10,2) NOT NULL,
  total_monthly_cost NUMERIC(10,2) NOT NULL,
  suggested_price NUMERIC(10,2) NOT NULL,
  
  -- Dados Geográficos
  base_location JSONB,
  client_location JSONB,
  route_geometry JSONB,
  
  -- Metadata
  notes TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent_to_client', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_cost_calculations_client_id ON cost_calculations(client_id);
CREATE INDEX idx_cost_calculations_created_by ON cost_calculations(created_by);
CREATE INDEX idx_cost_calculations_status ON cost_calculations(status);
CREATE INDEX idx_cost_calculations_created_at ON cost_calculations(created_at DESC);

-- RLS Policies
ALTER TABLE cost_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and operators can manage calculations"
ON cost_calculations FOR ALL
USING (check_admin_or_operator_role(auth.uid()));

CREATE POLICY "Users can view own calculations"
ON cost_calculations FOR SELECT
USING (created_by = auth.uid() OR check_admin_or_operator_role(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_cost_calculations_updated_at
  BEFORE UPDATE ON cost_calculations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();