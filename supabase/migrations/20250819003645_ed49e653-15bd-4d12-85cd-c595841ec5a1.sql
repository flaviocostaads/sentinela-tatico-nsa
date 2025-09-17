-- Fix the trigger function to properly handle user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tatico'::user_role)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    email = NEW.email,
    role = COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tatico'::user_role);
  RETURN NEW;
END;
$$;

-- Create a table to store round assignments to multiple tactics
CREATE TABLE IF NOT EXISTS public.round_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(round_id, user_id)
);

-- Enable RLS on round_assignments
ALTER TABLE public.round_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for round_assignments
CREATE POLICY "Admins and operadores can manage round assignments"
ON public.round_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'operador')
  )
);

CREATE POLICY "Users can view their own assignments"
ON public.round_assignments
FOR SELECT
USING (auth.uid() = user_id);

-- Add shift_type to round_templates for day/night differentiation
ALTER TABLE public.round_templates 
ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN NOT NULL DEFAULT false;

-- Add signature requirement tracking to rounds
ALTER TABLE public.rounds
ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN NOT NULL DEFAULT false;