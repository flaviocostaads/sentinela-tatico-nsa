-- Create storage bucket for odometer photos
INSERT INTO storage.buckets (id, name, public) VALUES ('odometer-photos', 'odometer-photos', false);

-- Create odometer_records table
CREATE TABLE public.odometer_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id uuid REFERENCES public.rounds(id),
  vehicle_id uuid REFERENCES public.vehicles(id),
  user_id uuid NOT NULL,
  odometer_reading integer NOT NULL,
  photo_url text NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('start', 'end', 'maintenance', 'fuel')),
  recorded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.odometer_records ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own odometer records" 
ON public.odometer_records 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all odometer records" 
ON public.odometer_records 
FOR SELECT 
USING (true);

-- Storage policies for odometer photos
CREATE POLICY "Users can upload their own odometer photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'odometer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view odometer photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'odometer-photos');