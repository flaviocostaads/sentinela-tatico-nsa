-- Criar tabela de veículos para gerenciamento completo
CREATE TABLE public.vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_plate text NOT NULL UNIQUE,
  brand text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  type vehicle_type NOT NULL,
  initial_odometer integer NOT NULL DEFAULT 0,
  current_odometer integer NOT NULL DEFAULT 0,
  fuel_capacity numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

-- Atualizar tabela de rounds para referenciar veículos
ALTER TABLE public.rounds 
ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id),
ADD COLUMN initial_odometer integer,
ADD COLUMN final_odometer integer;

-- Habilitar RLS na tabela de veículos
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para veículos
CREATE POLICY "Authenticated users can view vehicles" 
ON public.vehicles 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and operadores can manage vehicles" 
ON public.vehicles 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role IN ('admin', 'operador')
));

-- Tabela para registro de abastecimentos
CREATE TABLE public.vehicle_fuel_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  round_id uuid REFERENCES public.rounds(id),
  fuel_amount numeric NOT NULL,
  fuel_cost numeric,
  odometer_reading integer NOT NULL,
  fuel_station text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id)
);

-- Habilitar RLS na tabela de abastecimentos
ALTER TABLE public.vehicle_fuel_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para abastecimentos
CREATE POLICY "Users can create fuel logs for their rounds" 
ON public.vehicle_fuel_logs 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND 
  (round_id IS NULL OR EXISTS (
    SELECT 1 FROM rounds 
    WHERE rounds.id = vehicle_fuel_logs.round_id 
    AND rounds.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can view fuel logs" 
ON public.vehicle_fuel_logs 
FOR SELECT 
USING (true);

-- Trigger para atualizar updated_at nos veículos
CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir alguns veículos de exemplo
INSERT INTO public.vehicles (license_plate, brand, model, year, type, initial_odometer, current_odometer, fuel_capacity) VALUES
('ABC-1234', 'Toyota', 'Corolla', 2022, 'car', 0, 15000, 55.0),
('XYZ-9876', 'Honda', 'CG 160', 2023, 'motorcycle', 0, 8500, 16.0),
('DEF-5678', 'Chevrolet', 'Onix', 2021, 'car', 0, 22000, 44.0);