-- Create enum types
CREATE TYPE public.user_role AS ENUM ('admin', 'operador', 'tatico');
CREATE TYPE public.vehicle_type AS ENUM ('car', 'motorcycle');
CREATE TYPE public.round_status AS ENUM ('pending', 'active', 'completed', 'incident');
CREATE TYPE public.incident_type AS ENUM ('security', 'maintenance', 'emergency', 'other');
CREATE TYPE public.incident_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.checkpoint_status AS ENUM ('completed', 'skipped', 'delayed');

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'tatico',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checkpoints table
CREATE TABLE public.checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  qr_code TEXT UNIQUE,
  geofence_radius INTEGER DEFAULT 50,
  order_index INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rounds table
CREATE TABLE public.rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle vehicle_type NOT NULL,
  status round_status NOT NULL DEFAULT 'pending',
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  start_odometer INTEGER,
  end_odometer INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create route_points table for GPS tracking
CREATE TABLE public.route_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checkpoint_visits table
CREATE TABLE public.checkpoint_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  visit_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration INTEGER NOT NULL DEFAULT 0,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  status checkpoint_status NOT NULL DEFAULT 'completed'
);

-- Create photos table
CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
  checkpoint_visit_id UUID REFERENCES public.checkpoint_visits(id) ON DELETE CASCADE,
  incident_id UUID,
  url TEXT NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  type incident_type NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  description TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  priority incident_priority NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for photos incidents
ALTER TABLE public.photos ADD CONSTRAINT photos_incident_id_fkey 
FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Create RLS policies for clients (admins and operadores can manage)
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operadores can manage clients" ON public.clients FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'operador'))
);

-- Create RLS policies for checkpoints
CREATE POLICY "Authenticated users can view checkpoints" ON public.checkpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and operadores can manage checkpoints" ON public.checkpoints FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'operador'))
);

-- Create RLS policies for rounds
CREATE POLICY "Users can view all rounds" ON public.rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Taticos can create and update their own rounds" ON public.rounds FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Taticos can update their own rounds" ON public.rounds FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins and operadores can manage all rounds" ON public.rounds FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'operador'))
);

-- Create RLS policies for route_points
CREATE POLICY "Users can view route points" ON public.route_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create route points for their rounds" ON public.route_points FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.rounds WHERE id = round_id AND user_id = auth.uid())
);

-- Create RLS policies for checkpoint_visits
CREATE POLICY "Users can view checkpoint visits" ON public.checkpoint_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create visits for their rounds" ON public.checkpoint_visits FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.rounds WHERE id = round_id AND user_id = auth.uid())
);

-- Create RLS policies for photos
CREATE POLICY "Users can view photos" ON public.photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can upload photos for their rounds" ON public.photos FOR INSERT TO authenticated WITH CHECK (
  round_id IS NULL OR EXISTS (SELECT 1 FROM public.rounds WHERE id = round_id AND user_id = auth.uid())
);

-- Create RLS policies for incidents
CREATE POLICY "Users can view incidents" ON public.incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create incidents for their rounds" ON public.incidents FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.rounds WHERE id = round_id AND user_id = auth.uid())
);

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tatico'::user_role)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rounds_updated_at BEFORE UPDATE ON public.rounds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();