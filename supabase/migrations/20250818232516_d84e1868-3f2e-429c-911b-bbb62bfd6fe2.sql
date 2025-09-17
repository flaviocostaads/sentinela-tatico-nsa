-- Create vehicle maintenance logs table
CREATE TABLE public.vehicle_maintenance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL,
  round_id UUID NULL,
  created_by UUID NOT NULL,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('preventive', 'corrective', 'emergency')),
  service_type TEXT NOT NULL, -- 'fuel', 'tire_change', 'oil_change', 'repair', 'inspection', 'other'
  description TEXT NOT NULL,
  location TEXT,
  odometer_reading INTEGER NOT NULL,
  cost NUMERIC(10,2) NULL,
  parts_replaced TEXT[] NULL,
  service_provider TEXT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view maintenance logs" 
ON public.vehicle_maintenance_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create maintenance logs for their rounds" 
ON public.vehicle_maintenance_logs 
FOR INSERT 
WITH CHECK (
  (auth.uid() = created_by) AND 
  (round_id IS NULL OR EXISTS (
    SELECT 1 FROM rounds 
    WHERE rounds.id = vehicle_maintenance_logs.round_id 
    AND rounds.user_id = auth.uid()
  ))
);

-- Create vehicle maintenance schedules table
CREATE TABLE public.vehicle_maintenance_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  interval_km INTEGER NULL, -- Interval in kilometers
  interval_days INTEGER NULL, -- Interval in days
  last_service_km INTEGER NULL,
  last_service_date TIMESTAMP WITH TIME ZONE NULL,
  next_service_km INTEGER NULL,
  next_service_date TIMESTAMP WITH TIME ZONE NULL,
  is_overdue BOOLEAN GENERATED ALWAYS AS (
    (next_service_km IS NOT NULL AND (
      SELECT current_odometer FROM vehicles WHERE id = vehicle_id
    ) >= next_service_km) OR
    (next_service_date IS NOT NULL AND next_service_date <= now())
  ) STORED,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view maintenance schedules" 
ON public.vehicle_maintenance_schedules 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and operadores can manage maintenance schedules" 
ON public.vehicle_maintenance_schedules 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role IN ('admin', 'operador')
));

-- Create triggers for updated_at
CREATE TRIGGER update_vehicle_maintenance_logs_updated_at
  BEFORE UPDATE ON public.vehicle_maintenance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicle_maintenance_schedules_updated_at
  BEFORE UPDATE ON public.vehicle_maintenance_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update maintenance schedules after service
CREATE OR REPLACE FUNCTION public.update_maintenance_schedule_after_service()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;